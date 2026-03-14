"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  listPods,
  listDeployments,
  streamPodLogs,
  stopLogStream,
  watchPods,
  stopWatch,
} from "../tauri/commands";
import type { LogEntry, LogOptions, LogEvent, PodInfo, WatchEvent } from "../types";
import { type KubeliError, toKubeliError } from "../types/errors";
import { useUIStore } from "../stores/ui-store";

/**
 * Explicit text + bg color pairs to avoid Tailwind purge issues.
 */
export const POD_COLOR_PAIRS = [
  { text: "text-blue-400", bg: "bg-blue-400" },
  { text: "text-green-400", bg: "bg-green-400" },
  { text: "text-yellow-400", bg: "bg-yellow-400" },
  { text: "text-purple-400", bg: "bg-purple-400" },
  { text: "text-pink-400", bg: "bg-pink-400" },
  { text: "text-cyan-400", bg: "bg-cyan-400" },
  { text: "text-orange-400", bg: "bg-orange-400" },
  { text: "text-emerald-400", bg: "bg-emerald-400" },
  { text: "text-rose-400", bg: "bg-rose-400" },
  { text: "text-indigo-400", bg: "bg-indigo-400" },
  { text: "text-teal-400", bg: "bg-teal-400" },
  { text: "text-amber-400", bg: "bg-amber-400" },
] as const;

export interface PodColorEntry {
  text: string;
  bg: string;
}

export interface UseDeploymentLogsReturn {
  logs: LogEntry[];
  pods: PodInfo[];
  podColorMap: Map<string, PodColorEntry>;
  isLoading: boolean;
  isStreaming: boolean;
  error: KubeliError | null;
  selectedPods: Set<string>;
  togglePodFilter: (podName: string) => void;
  showAllPods: () => void;
  startStream: (tailLines?: number) => Promise<void>;
  stopStream: () => Promise<void>;
  clearLogs: () => void;
  refreshPods: () => Promise<void>;
}

/**
 * Hook that aggregates logs from all pods belonging to a deployment.
 * Uses the Kubernetes watch API to keep the pod list in sync in real-time.
 */
export function useDeploymentLogs(
  deploymentName: string,
  namespace: string,
): UseDeploymentLogsReturn {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pods, setPods] = useState<PodInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<KubeliError | null>(null);
  const [selectedPods, setSelectedPods] = useState<Set<string>>(new Set());

  const activeStreamIds = useRef<string[]>([]);
  const activeListeners = useRef<UnlistenFn[]>([]);
  const pendingLogsRef = useRef<LogEntry[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const selectorRef = useRef<Record<string, string>>({});
  // Stable color assignment - remembers colors for pods that have disappeared
  const colorAssignmentsRef = useRef(new Map<string, PodColorEntry>());
  const nextColorIndexRef = useRef(0);

  // Pod color map - assigns stable colors, never forgets a pod
  const podColorMap = useMemo(() => {
    const assignments = colorAssignmentsRef.current;
    for (const pod of pods) {
      if (!assignments.has(pod.name)) {
        assignments.set(pod.name, POD_COLOR_PAIRS[nextColorIndexRef.current % POD_COLOR_PAIRS.length]);
        nextColorIndexRef.current++;
      }
    }
    return new Map(assignments);
  }, [pods]);

  const togglePodFilter = useCallback((podName: string) => {
    setSelectedPods((prev) => {
      const next = new Set(prev);
      if (next.has(podName)) {
        next.delete(podName);
      } else {
        next.add(podName);
      }
      // If all pods are selected individually, reset to "all" (empty set)
      if (next.size >= pods.length) {
        return new Set();
      }
      return next;
    });
  }, [pods.length]);

  const showAllPods = useCallback(() => {
    setSelectedPods(new Set());
  }, []);

  const getMaxLines = useCallback(() => {
    return useUIStore.getState().settings.logRetentionLines;
  }, []);

  const flushPending = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    const batch = pendingLogsRef.current.splice(0);
    if (batch.length === 0 || !mountedRef.current) return;

    const maxLines = getMaxLines();
    setLogs((prev) => {
      const next = [...prev, ...batch];
      next.sort((a, b) => {
        if (!a.timestamp && !b.timestamp) return 0;
        if (!a.timestamp) return -1;
        if (!b.timestamp) return 1;
        return a.timestamp.localeCompare(b.timestamp);
      });
      if (next.length > maxLines) {
        next.splice(0, next.length - maxLines);
      }
      return next;
    });
  }, [getMaxLines]);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      flushPending();
    }, 150);
  }, [flushPending]);

  /** Check if a pod matches the deployment's selector */
  const podMatchesSelector = useCallback((pod: PodInfo): boolean => {
    const selector = selectorRef.current;
    if (!selector || Object.keys(selector).length === 0) return false;
    return Object.entries(selector).every(
      ([k, v]) => pod.labels && pod.labels[k] === v
    );
  }, []);

  // Fetch deployment selector + initial pod list
  const fetchPods = useCallback(async () => {
    try {
      const deployments = await listDeployments({ namespace });
      const deployment = deployments.find((d) => d.name === deploymentName);
      if (!deployment) {
        if (mountedRef.current) {
          setError(toKubeliError(`Deployment ${deploymentName} not found`));
        }
        return [];
      }

      selectorRef.current = deployment.selector;

      const labelSelector = Object.entries(deployment.selector)
        .map(([k, v]) => `${k}=${v}`)
        .join(",");

      if (!labelSelector) {
        if (mountedRef.current) setPods([]);
        return [];
      }

      const podList = await listPods({ namespace, label_selector: labelSelector });
      const activePods = podList.filter(
        (p) => p.phase === "Running" || p.phase === "Pending"
      );
      if (mountedRef.current) {
        setPods(activePods);
      }
      return activePods;
    } catch (e) {
      if (mountedRef.current) {
        setError(toKubeliError(e));
      }
      return [];
    }
  }, [namespace, deploymentName]);

  const stopAllStreams = useCallback(async () => {
    const streamIds = [...activeStreamIds.current];
    activeStreamIds.current = [];

    for (const id of streamIds) {
      try {
        await stopLogStream(id);
      } catch {
        // Stream may already be stopped
      }
    }

    for (const unlisten of activeListeners.current) {
      unlisten();
    }
    activeListeners.current = [];

    flushPending();

    if (mountedRef.current) {
      setIsStreaming(false);
    }
  }, [flushPending]);

  const startStream = useCallback(
    async (tailLines = 100) => {
      if (isStreaming) {
        await stopAllStreams();
      }

      setIsLoading(true);
      setError(null);

      try {
        const currentPods = await fetchPods();
        if (currentPods.length === 0) {
          setIsLoading(false);
          return;
        }

        const streamIds: string[] = [];
        const listeners: UnlistenFn[] = [];
        let startedCount = 0;

        for (const pod of currentPods) {
          const streamId = `deploy-logs-${namespace}-${deploymentName}-${pod.name}-${Date.now()}`;
          streamIds.push(streamId);

          const eventName = `log-stream-${streamId}`;

          const unlisten = await listen<LogEvent>(eventName, (event) => {
            const logEvent = event.payload;

            switch (logEvent.type) {
              case "Line":
                pendingLogsRef.current.push(logEvent.data);
                scheduleFlush();
                break;
              case "Error":
                flushPending();
                console.error(`Stream error for pod ${pod.name}:`, logEvent.data);
                break;
              case "Started":
                startedCount++;
                if (startedCount === currentPods.length && mountedRef.current) {
                  setIsStreaming(true);
                  setIsLoading(false);
                }
                break;
              case "Stopped": {
                const idx = activeStreamIds.current.indexOf(streamId);
                if (idx !== -1) {
                  activeStreamIds.current.splice(idx, 1);
                }
                if (activeStreamIds.current.length === 0 && mountedRef.current) {
                  flushPending();
                  setIsStreaming(false);
                }
                break;
              }
            }
          });

          listeners.push(unlisten);

          const logOptions: LogOptions = {
            namespace,
            pod_name: pod.name,
            follow: true,
            timestamps: true,
            tail_lines: tailLines,
          };

          await streamPodLogs(streamId, logOptions);
        }

        activeStreamIds.current = streamIds;
        activeListeners.current = listeners;
      } catch (e) {
        if (mountedRef.current) {
          setError(toKubeliError(e));
          setIsLoading(false);
          setIsStreaming(false);
        }
      }
    },
    [isStreaming, stopAllStreams, fetchPods, namespace, deploymentName, scheduleFlush, flushPending]
  );

  const clearLogs = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    pendingLogsRef.current = [];
    setLogs([]);
    setError(null);
  }, []);

  const refreshPods = useCallback(async () => {
    await fetchPods();
  }, [fetchPods]);

  // Initial fetch + pod watch for real-time badge updates
  useEffect(() => {
    mountedRef.current = true;
    fetchPods();

    const watchId = `deploy-pods-${namespace}-${deploymentName}-${Date.now()}`;
    let watchUnlisten: UnlistenFn | null = null;

    const setupWatch = async () => {
      try {
        // Listen for pod watch events
        watchUnlisten = await listen<WatchEvent<PodInfo>>(
          `pods-watch-${watchId}`,
          (event) => {
            if (!mountedRef.current) return;
            const watchEvent = event.payload;

            setPods((prev) => {
              switch (watchEvent.type) {
                case "Added": {
                  const pod = watchEvent.data as PodInfo;
                  if (!podMatchesSelector(pod)) return prev;
                  if (pod.phase !== "Running" && pod.phase !== "Pending") return prev;
                  // Don't add duplicates
                  if (prev.some((p) => p.uid === pod.uid)) {
                    return prev.map((p) => p.uid === pod.uid ? pod : p);
                  }
                  return [...prev, pod];
                }
                case "Modified": {
                  const pod = watchEvent.data as PodInfo;
                  if (!podMatchesSelector(pod)) {
                    // No longer matches selector - remove
                    return prev.filter((p) => p.uid !== pod.uid);
                  }
                  if (pod.phase !== "Running" && pod.phase !== "Pending") {
                    // No longer active - remove
                    return prev.filter((p) => p.uid !== pod.uid);
                  }
                  const idx = prev.findIndex((p) => p.uid === pod.uid);
                  if (idx === -1) return [...prev, pod];
                  const next = [...prev];
                  next[idx] = pod;
                  return next;
                }
                case "Deleted": {
                  const pod = watchEvent.data as PodInfo;
                  return prev.filter((p) => p.uid !== pod.uid);
                }
                case "Restarted": {
                  const allPods = watchEvent.data as PodInfo[];
                  return allPods.filter(
                    (p) => podMatchesSelector(p) && (p.phase === "Running" || p.phase === "Pending")
                  );
                }
                default:
                  return prev;
              }
            });
          }
        );

        // Start the watch
        await watchPods(watchId, namespace);
      } catch {
        // Watch failed - no fallback needed, initial fetch already loaded pods
      }
    };

    setupWatch();

    return () => {
      mountedRef.current = false;
      // Stop pod watch
      watchUnlisten?.();
      stopWatch(watchId).catch(() => {});
      // Stop all log streams
      const streamIds = [...activeStreamIds.current];
      activeStreamIds.current = [];
      for (const id of streamIds) {
        stopLogStream(id).catch(() => {});
      }
      for (const unlisten of activeListeners.current) {
        unlisten();
      }
      activeListeners.current = [];
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, [fetchPods, namespace, deploymentName, podMatchesSelector]);

  return {
    logs,
    pods,
    podColorMap,
    isLoading,
    isStreaming,
    error,
    selectedPods,
    togglePodFilter,
    showAllPods,
    startStream,
    stopStream: stopAllStreams,
    clearLogs,
    refreshPods,
  };
}
