"use client";

import { create } from "zustand";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  getPodLogs,
  streamPodLogs,
  stopLogStream,
  getPodContainers,
} from "../tauri/commands";
import type { LogEntry, LogOptions, LogEvent, PodInfo, WatchEvent } from "../types";
import { type KubeliError, toKubeliError, getErrorMessage } from "../types/errors";
import { useUIStore } from "./ui-store";

export interface LogTabState {
  logs: LogEntry[];
  isStreaming: boolean;
  isLoading: boolean;
  error: KubeliError | null;
  containers: string[];
  selectedContainer: string | null;
  streamId: string | null;
  scrollTop: number;
  autoScroll: boolean;
}

function defaultLogTabState(): LogTabState {
  return {
    logs: [],
    isStreaming: false,
    isLoading: false,
    error: null,
    containers: [],
    selectedContainer: null,
    streamId: null,
    scrollTop: 0,
    autoScroll: true,
  };
}

interface LogStoreState {
  logTabs: Record<string, LogTabState>;

  initLogTab(tabId: string, ns: string, pod: string): Promise<void>;
  startStream(
    tabId: string,
    ns: string,
    pod: string,
    container?: string | null,
    tailLines?: number
  ): Promise<void>;
  stopStream(tabId: string): Promise<void>;
  fetchLogs(
    tabId: string,
    ns: string,
    pod: string,
    opts?: Partial<LogOptions>
  ): Promise<void>;
  cleanupLogTab(tabId: string): void;
  clearLogs(tabId: string): void;
  setSelectedContainer(tabId: string, container: string | null): void;
  setScrollTop(tabId: string, scrollTop: number): void;
  setAutoScroll(tabId: string, autoScroll: boolean): void;
}

// External state not in Zustand (no re-renders needed)
// Monotonic ID for stable React keys across ring-buffer trims.
let logSeq = 0;
const stampSeq = (entry: LogEntry): LogEntry => ({ ...entry, seq: ++logSeq });

const listeners = new Map<string, UnlistenFn>();
// Tabs with a startStream call in flight - isStreaming only turns true after
// an await, so this synchronous marker is what stops rapid double-starts
const startingStreams = new Set<string>();
const pendingLogs = new Map<string, LogEntry[]>();
const flushTimers = new Map<string, ReturnType<typeof setTimeout>>();
const podWatchers = new Map<string, () => void>();

const podWatchInfo = new Map<string, PodWatchInfo>();

interface PodWatchInfo {
  namespace: string;
  podName: string;
}

/** Mark a log tab as errored because its pod disappeared. */
function markPodGone(
  tabId: string,
  pod: string,
  set: (fn: (s: LogStoreState) => Partial<LogStoreState>) => void
) {
  set((s) => {
    const t = s.logTabs[tabId];
    if (!t) return {};
    return {
      logTabs: {
        ...s.logTabs,
        [tabId]: {
          ...t,
          error: toKubeliError(`Pod ${pod} not found (deleted?)`),
          isStreaming: false,
        },
      },
    };
  });
  stopPodWatcher(tabId);
}

// Watch-based pod-existence tracking: a Deleted watch event flags the tab
// instead of polling the API every 2 s per open log tab.
async function startPodWatcher(
  tabId: string,
  ns: string,
  pod: string,
  set: (fn: (s: LogStoreState) => Partial<LogStoreState>) => void
) {
  stopPodWatcher(tabId);
  podWatchInfo.set(tabId, { namespace: ns, podName: pod });

  const watchId = `log-pod-${tabId}-${Date.now()}`;
  try {
    const { watchPods, stopWatch } = await import("../tauri/commands");
    const unlisten = await listen<WatchEvent<PodInfo>>(
      `pods-watch-${watchId}`,
      (event) => {
        const we = event.payload;
        if (we.type === "Deleted") {
          const p = we.data as PodInfo;
          if (p.name === pod) markPodGone(tabId, pod, set);
        } else if (we.type === "Restarted") {
          // Watch resynced - pod may have vanished while we were not looking
          const all = we.data as PodInfo[];
          if (!all.some((p) => p.name === pod)) markPodGone(tabId, pod, set);
        }
      }
    );
    podWatchers.set(tabId, () => {
      unlisten();
      stopWatch(watchId).catch(() => {});
    });
    await watchPods(watchId, ns);
  } catch {
    // Watch unavailable - the log stream itself will surface errors
  }
}

function stopPodWatcher(tabId: string) {
  const cleanup = podWatchers.get(tabId);
  if (cleanup) {
    cleanup();
    podWatchers.delete(tabId);
  }
  podWatchInfo.delete(tabId);
}

function getMaxLines(): number {
  return useUIStore.getState().settings.logRetentionLines;
}

function flushPending(tabId: string, set: (fn: (s: LogStoreState) => Partial<LogStoreState>) => void) {
  const timer = flushTimers.get(tabId);
  if (timer) {
    clearTimeout(timer);
    flushTimers.delete(tabId);
  }

  const pending = pendingLogs.get(tabId);
  if (!pending || pending.length === 0) return;

  const batch = pending.splice(0);
  const maxLines = getMaxLines();

  set((s) => {
    const tab = s.logTabs[tabId];
    if (!tab) return {};

    const nextLogs = [...tab.logs, ...batch];
    if (nextLogs.length > maxLines) {
      nextLogs.splice(0, nextLogs.length - maxLines);
    }

    return {
      logTabs: { ...s.logTabs, [tabId]: { ...tab, logs: nextLogs } },
    };
  });
}

function scheduleFlush(tabId: string, set: (fn: (s: LogStoreState) => Partial<LogStoreState>) => void) {
  if (flushTimers.has(tabId)) return;
  flushTimers.set(
    tabId,
    setTimeout(() => {
      flushTimers.delete(tabId);
      flushPending(tabId, set);
    }, 150)
  );
}

export const useLogStore = create<LogStoreState>((set, get) => ({
  logTabs: {},

  async initLogTab(tabId, ns, pod) {
    // No-op if tab already exists (re-mount)
    if (get().logTabs[tabId]) return;

    set((s) => ({
      logTabs: { ...s.logTabs, [tabId]: defaultLogTabState() },
    }));

    try {
      const containerList = await getPodContainers(ns, pod);
      const selected = containerList.length > 0 ? containerList[0] : null;
      set((s) => {
        const tab = s.logTabs[tabId];
        if (!tab) return {};
        return {
          logTabs: {
            ...s.logTabs,
            [tabId]: { ...tab, containers: containerList, selectedContainer: selected },
          },
        };
      });
    } catch (e) {
      const msg = getErrorMessage(e);
      if (msg.includes("NotFound") || msg.includes("not found")) {
        set((s) => {
          const tab = s.logTabs[tabId];
          if (!tab) return {};
          return {
            logTabs: {
              ...s.logTabs,
              [tabId]: { ...tab, error: toKubeliError(e) },
            },
          };
        });
        return;
      }
    }

    // Watch pod existence (Deleted event flags the tab)
    startPodWatcher(tabId, ns, pod, set);
  },

  async startStream(tabId, ns, pod, container, tailLines) {
    const tab = get().logTabs[tabId];
    if (!tab || tab.isStreaming || startingStreams.has(tabId)) return;
    startingStreams.add(tabId);

    // Stop existing stream if any
    if (tab.streamId) {
      await get().stopStream(tabId);
    }

    const streamId = `logs-${ns}-${pod}-${Date.now()}`;
    const effectiveContainer = container ?? tab.selectedContainer;

    set((s) => ({
      logTabs: {
        ...s.logTabs,
        [tabId]: { ...s.logTabs[tabId], streamId, error: null },
      },
    }));

    pendingLogs.set(tabId, []);

    try {
      const eventName = `log-stream-${streamId}`;
      const unlisten = await listen<LogEvent>(eventName, (event) => {
        const logEvent = event.payload;

        switch (logEvent.type) {
          case "Line": {
            let pending = pendingLogs.get(tabId);
            if (!pending) {
              pending = [];
              pendingLogs.set(tabId, pending);
            }
            pending.push(stampSeq(logEvent.data));
            scheduleFlush(tabId, set);
            break;
          }
          case "Lines": {
            let pending = pendingLogs.get(tabId);
            if (!pending) {
              pending = [];
              pendingLogs.set(tabId, pending);
            }
            for (const entry of logEvent.data) {
              pending.push(stampSeq(entry));
            }
            scheduleFlush(tabId, set);
            break;
          }
          case "Error":
            flushPending(tabId, set);
            set((s) => {
              const t = s.logTabs[tabId];
              if (!t) return {};
              return {
                logTabs: {
                  ...s.logTabs,
                  [tabId]: { ...t, error: logEvent.data, isStreaming: false },
                },
              };
            });
            break;
          case "Started":
            set((s) => {
              const t = s.logTabs[tabId];
              if (!t) return {};
              return {
                logTabs: {
                  ...s.logTabs,
                  [tabId]: { ...t, isStreaming: true },
                },
              };
            });
            break;
          case "Stopped":
            flushPending(tabId, set);
            set((s) => {
              const t = s.logTabs[tabId];
              if (!t) return {};
              return {
                logTabs: {
                  ...s.logTabs,
                  [tabId]: { ...t, isStreaming: false, streamId: null },
                },
              };
            });
            break;
        }
      });

      listeners.set(tabId, unlisten);

      const logOptions: LogOptions = {
        namespace: ns,
        pod_name: pod,
        container: effectiveContainer || undefined,
        follow: true,
        timestamps: true,
        tail_lines: tailLines ?? 100,
      };

      await streamPodLogs(streamId, logOptions);
    } catch (e) {
      set((s) => {
        const t = s.logTabs[tabId];
        if (!t) return {};
        return {
          logTabs: {
            ...s.logTabs,
            [tabId]: { ...t, error: toKubeliError(e), isStreaming: false, streamId: null },
          },
        };
      });
      listeners.get(tabId)?.();
      listeners.delete(tabId);
    } finally {
      startingStreams.delete(tabId);
    }
  },

  async stopStream(tabId) {
    const tab = get().logTabs[tabId];
    if (!tab?.streamId) return;

    try {
      await stopLogStream(tab.streamId);
    } catch (e) {
      console.error("Failed to stop stream:", e);
    } finally {
      flushPending(tabId, set);
      listeners.get(tabId)?.();
      listeners.delete(tabId);
      pendingLogs.delete(tabId);

      set((s) => {
        const t = s.logTabs[tabId];
        if (!t) return {};
        return {
          logTabs: {
            ...s.logTabs,
            [tabId]: { ...t, isStreaming: false, streamId: null },
          },
        };
      });
    }
  },

  async fetchLogs(tabId, ns, pod, opts) {
    const tab = get().logTabs[tabId];
    if (!tab) return;

    set((s) => ({
      logTabs: {
        ...s.logTabs,
        [tabId]: { ...s.logTabs[tabId], isLoading: true, error: null },
      },
    }));

    try {
      const maxLines = getMaxLines();
      const logOptions: LogOptions = {
        namespace: ns,
        pod_name: pod,
        container: tab.selectedContainer || undefined,
        timestamps: true,
        tail_lines: opts?.tail_lines ?? 500,
        ...opts,
      };

      const fetchedLogs = await getPodLogs(logOptions);

      // Clear pending
      const timer = flushTimers.get(tabId);
      if (timer) {
        clearTimeout(timer);
        flushTimers.delete(tabId);
      }
      pendingLogs.delete(tabId);

      const nextLogs = fetchedLogs.slice(-maxLines).map(stampSeq);

      set((s) => {
        const t = s.logTabs[tabId];
        if (!t) return {};
        return {
          logTabs: {
            ...s.logTabs,
            [tabId]: { ...t, logs: nextLogs, isLoading: false },
          },
        };
      });
    } catch (e) {
      set((s) => {
        const t = s.logTabs[tabId];
        if (!t) return {};
        return {
          logTabs: {
            ...s.logTabs,
            [tabId]: { ...t, error: toKubeliError(e), isLoading: false },
          },
        };
      });
    }
  },

  cleanupLogTab(tabId) {
    const tab = get().logTabs[tabId];
    if (!tab) return;

    // Stop stream
    if (tab.streamId) {
      stopLogStream(tab.streamId).catch(console.error);
    }
    listeners.get(tabId)?.();
    listeners.delete(tabId);

    const timer = flushTimers.get(tabId);
    if (timer) clearTimeout(timer);
    flushTimers.delete(tabId);
    pendingLogs.delete(tabId);
    stopPodWatcher(tabId);

    set((s) => {
      const { [tabId]: _, ...rest } = s.logTabs;
      return { logTabs: rest };
    });
  },

  clearLogs(tabId) {
    const timer = flushTimers.get(tabId);
    if (timer) {
      clearTimeout(timer);
      flushTimers.delete(tabId);
    }
    pendingLogs.delete(tabId);

    set((s) => {
      const tab = s.logTabs[tabId];
      if (!tab) return {};
      return {
        logTabs: {
          ...s.logTabs,
          [tabId]: { ...tab, logs: [], error: null },
        },
      };
    });
  },

  setSelectedContainer(tabId, container) {
    set((s) => {
      const tab = s.logTabs[tabId];
      if (!tab) return {};
      return {
        logTabs: {
          ...s.logTabs,
          [tabId]: { ...tab, selectedContainer: container },
        },
      };
    });
  },

  setScrollTop(tabId, scrollTop) {
    set((s) => {
      const tab = s.logTabs[tabId];
      if (!tab) return {};
      return {
        logTabs: {
          ...s.logTabs,
          [tabId]: { ...tab, scrollTop },
        },
      };
    });
  },

  setAutoScroll(tabId, autoScroll) {
    set((s) => {
      const tab = s.logTabs[tabId];
      if (!tab) return {};
      return {
        logTabs: {
          ...s.logTabs,
          [tabId]: { ...tab, autoScroll },
        },
      };
    });
  },
}));
