"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  listPods,
  listDeployments,
  listStatefulsets,
  listDaemonsets,
  listReplicasets,
  listJobs,
  streamPodLogs,
  stopLogStream,
  watchPods,
  stopWatch,
} from "../tauri/commands";
import type { LogEntry, LogOptions, LogEvent, PodInfo, WatchEvent } from "../types";
import { type KubeliError, toKubeliError } from "../types/errors";
import { useUIStore } from "../stores/ui-store";
import { stampSeq } from "../stores/log-seq";

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

/**
 * A drop this soon after the previous retry means reconnecting is not working,
 * so stop instead of hammering the API server.
 */
const RESUBSCRIBE_COOLDOWN_MS = 30_000;

export interface PodColorEntry {
  text: string;
  bg: string;
}

/**
 * Workload types whose pods can be aggregated into a single log view.
 *
 * CronJobs own no pods directly, only Jobs, so they take a second resolution
 * hop through their children (see WORKLOAD_LISTERS).
 */
export const AGGREGATED_LOG_WORKLOADS = [
  "deployment",
  "statefulset",
  "daemonset",
  "replicaset",
  "job",
  "cronjob",
] as const;

export type WorkloadLogKind = (typeof AGGREGATED_LOG_WORKLOADS)[number];

export function supportsAggregatedLogs(resourceType: string): resourceType is WorkloadLogKind {
  return (AGGREGATED_LOG_WORKLOADS as readonly string[]).includes(resourceType);
}

/** Human-readable kind, used in AI prompts and view titles */
export const WORKLOAD_KIND_LABELS: Record<WorkloadLogKind, string> = {
  deployment: "Deployment",
  statefulset: "StatefulSet",
  daemonset: "DaemonSet",
  replicaset: "ReplicaSet",
  job: "Job",
  cronjob: "CronJob",
};

/**
 * Label carrying a Job's controller UID, newest spelling first. Kubernetes
 * moved it to the `batch.kubernetes.io` prefix in 1.27; older clusters only
 * set the bare key.
 */
const CONTROLLER_UID_KEYS = ["batch.kubernetes.io/controller-uid", "controller-uid"] as const;

/**
 * Resolves a CronJob to the pod selector covering all of its Jobs.
 *
 * Each Job carries its own `controller-uid` selector, so the union is a
 * set-based query over that one label. That keeps a CronJob a single-selector
 * workload like every other kind, so pod listing and the watch stay untouched.
 * The Job history is already bounded server-side by the CronJob's
 * successful/failedJobsHistoryLimit, so every owned Job can be included.
 *
 * ponytail: a Job created by a later cron run is not followed live. Re-resolving
 * (refreshPods, or restarting the stream) picks the new Job up for the pod list
 * and the streams, but the pod watch keeps the selector it was started with —
 * the hook hands it over once and never restarts it. Reopening the view is what
 * actually resyncs everything. Following new Jobs live needs the watch to be
 * restarted under the new selector; deferred until it is actually asked for.
 */
async function cronjobSelectors(
  namespace: string,
): Promise<Array<{ name: string; selector_query: string }>> {
  const jobs = await listJobs({ namespace });
  const byCronjob = new Map<string, { key: string; uids: string[] }>();

  for (const job of jobs) {
    if (job.owner_kind !== "CronJob" || !job.owner_name) continue;
    // Only the controller-uid form collapses into one set-based query; a Job
    // with a hand-written selector is skipped rather than silently widening
    // the query to unrelated pods. Kubernetes moved this label to the
    // batch.kubernetes.io prefix in 1.27, so the query has to use whichever
    // key the cluster actually set — querying the other one matches nothing.
    const key = CONTROLLER_UID_KEYS.find((k) => job.selector[k]);
    if (!key) continue;
    const group = byCronjob.get(job.owner_name);
    if (group) {
      group.uids.push(job.selector[key]);
    } else {
      byCronjob.set(job.owner_name, { key, uids: [job.selector[key]] });
    }
  }

  return [...byCronjob].map(([name, { key, uids }]) => ({
    name,
    selector_query: `${key} in (${uids.join(",")})`,
  }));
}

/**
 * Every supported workload exposes its complete Kubernetes label selector as
 * `selector_query`, so resolving its pods only differs by which lister to call.
 * CronJobs are the exception: they resolve through their Jobs first.
 */
const WORKLOAD_LISTERS: Record<
  WorkloadLogKind,
  (namespace: string) => Promise<Array<{ name: string; selector_query: string }>>
> = {
  deployment: (namespace) => listDeployments({ namespace }),
  statefulset: (namespace) => listStatefulsets({ namespace }),
  daemonset: (namespace) => listDaemonsets({ namespace }),
  replicaset: (namespace) => listReplicasets({ namespace }),
  job: (namespace) => listJobs({ namespace }),
  cronjob: cronjobSelectors,
};

export interface UseWorkloadLogsReturn {
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
 * Hook that aggregates logs from all pods belonging to a workload.
 * Uses the Kubernetes watch API to keep the pod list in sync in real-time.
 */
export function useWorkloadLogs(
  workloadName: string,
  namespace: string,
  kind: WorkloadLogKind = "deployment",
): UseWorkloadLogsReturn {
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
  const selectorQueryRef = useRef("");
  // Pod roster mirror, so the Ended handler can tell a rotated-away pod from a
  // pod that is still supposed to be streaming
  const podsRef = useRef<PodInfo[]>([]);
  // Last timestamp seen per pod, to resume a resubscribe without refetching
  const lastTimestampRef = useRef(new Map<string, string>());
  // When each pod was last auto-resubscribed; guards against a reconnect loop
  const resubscribedRef = useRef(new Map<string, number>());
  // Lets a resubscribe drop the dead stream's listener without leaking it
  const unlistenByStreamRef = useRef(new Map<string, UnlistenFn>());
  // Disambiguates stream IDs created within the same millisecond
  const nextStreamSeqRef = useRef(0);
  // Stable color assignment - remembers colors for pods that have disappeared
  const colorAssignmentsRef = useRef(new Map<string, PodColorEntry>());
  const nextColorIndexRef = useRef(0);

  podsRef.current = pods;

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
    const cmp = (a: LogEntry, b: LogEntry) => {
      if (!a.timestamp && !b.timestamp) return 0;
      if (!a.timestamp) return -1;
      if (!b.timestamp) return 1;
      return a.timestamp.localeCompare(b.timestamp);
    };
    setLogs((prev) => {
      // prev is already sorted - only sort the incoming batch, then merge.
      // Full re-sort per flush is O(n log n) on the whole buffer and made
      // busy multi-pod streams CPU-bound.
      batch.sort(cmp);
      const next: LogEntry[] = [];
      let i = 0;
      let j = 0;
      while (i < prev.length && j < batch.length) {
        next.push(cmp(prev[i], batch[j]) <= 0 ? prev[i++] : batch[j++]);
      }
      while (i < prev.length) next.push(prev[i++]);
      while (j < batch.length) next.push(batch[j++]);
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

  // Fetch workload selector + initial pod list
  const fetchPods = useCallback(async () => {
    try {
      const workloads = await WORKLOAD_LISTERS[kind](namespace);
      const workload = workloads.find((w) => w.name === workloadName);
      if (!workload) {
        // A CronJob resolves through its Jobs, so "no match" here just means it
        // has no Jobs left (between runs, or history already collected) — an
        // empty log view, not a missing workload.
        if (mountedRef.current) {
          if (kind === "cronjob") {
            selectorQueryRef.current = "";
            setPods([]);
          } else {
            setError(
              toKubeliError(`${WORKLOAD_KIND_LABELS[kind]} ${workloadName} not found`)
            );
          }
        }
        return [];
      }

      const labelSelector = workload.selector_query;
      selectorQueryRef.current = labelSelector;

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
  }, [namespace, workloadName, kind]);

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
    unlistenByStreamRef.current.clear();

    flushPending();

    if (mountedRef.current) {
      setIsStreaming(false);
    }
  }, [flushPending]);

  /**
   * Subscribes to one pod's log stream. `onStarted` only fires for the initial
   * fan-out, where it counts down to isStreaming; a resubscribe passes nothing.
   */
  const subscribePod = useCallback(
    async (
      podName: string,
      logOptions: Omit<LogOptions, "namespace" | "pod_name">,
      onStarted?: () => void,
    ): Promise<{ streamId: string; unlisten: UnlistenFn }> => {
      // Counter, not just Date.now(): a resubscribe can land in the same
      // millisecond as the stream it replaces, and two live streams sharing an
      // ID would share one event channel and one stop handle.
      const streamId = `workload-logs-${kind}-${namespace}-${workloadName}-${podName}-${Date.now()}-${nextStreamSeqRef.current++}`;
      const unlisten = await listen<LogEvent>(`log-stream-${streamId}`, (event) => {
        const logEvent = event.payload;

        switch (logEvent.type) {
          case "Line":
            rememberTimestamp(podName, logEvent.data.timestamp);
            pendingLogsRef.current.push(stampSeq(logEvent.data));
            scheduleFlush();
            break;
          case "Lines":
            rememberTimestamp(podName, logEvent.data.at(-1)?.timestamp);
            pendingLogsRef.current.push(...logEvent.data.map(stampSeq));
            scheduleFlush();
            break;
          case "Error":
            flushPending();
            console.error(`Stream error for pod ${podName}:`, logEvent.data);
            break;
          case "Ended":
            flushPending();
            handleStreamEnded(podName, streamId, logEvent.data.reason ?? null);
            break;
          case "Started":
            onStarted?.();
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

      unlistenByStreamRef.current.set(streamId, unlisten);
      await streamPodLogs(streamId, { namespace, pod_name: podName, ...logOptions });
      return { streamId, unlisten };
    },
    // handleStreamEnded/rememberTimestamp only read refs, so the first-render
    // closures stay correct and do not belong in the dep list
    [kind, namespace, workloadName, scheduleFlush, flushPending],
  );

  const subscribePodRef = useRef(subscribePod);
  subscribePodRef.current = subscribePod;

  function rememberTimestamp(podName: string, timestamp: string | null | undefined) {
    if (timestamp) lastTimestampRef.current.set(podName, timestamp);
  }

  /**
   * A stream ending is routine here: replicas finish or get replaced by a
   * rolling update while the others keep streaming. It is only a real drop when
   * the backend reports a reason AND the pod is still on the roster — then the
   * view would silently go quiet, so resubscribe from the last line seen.
   * A clean end (reason null) means the container itself stopped producing.
   */
  function handleStreamEnded(podName: string, streamId: string, reason: string | null) {
    if (!reason || !mountedRef.current) return;
    if (!podsRef.current.some((p) => p.name === podName)) return;
    // Guard against a reconnect loop, not against retrying ever again: only a
    // drop that follows hard on the heels of the last retry means reconnecting
    // is not working. A stream that ran fine for a while has earned another try.
    const lastRetry = resubscribedRef.current.get(podName);
    if (lastRetry !== undefined && Date.now() - lastRetry < RESUBSCRIBE_COOLDOWN_MS) {
      console.warn(`Log stream for pod ${podName} dropped again, not retrying: ${reason}`);
      return;
    }
    resubscribedRef.current.set(podName, Date.now());

    const lastTimestamp = lastTimestampRef.current.get(podName);
    // One second of overlap is cheaper than a missing line.
    const sinceSeconds = lastTimestamp
      ? Math.max(1, Math.ceil((Date.now() - new Date(lastTimestamp).getTime()) / 1000) + 1)
      : undefined;

    void (async () => {
      try {
        const { streamId: newId, unlisten } = await subscribePodRef.current(
          podName,
          {
            follow: true,
            timestamps: true,
            since_seconds: sinceSeconds,
            tail_lines: sinceSeconds === undefined ? 100 : undefined,
          },
          // The dead stream's Stopped event arrives before this one is
          // registered and can drop the roster to empty, clearing isStreaming.
          // Restore it once the replacement is live, or the view claims to be
          // stopped while lines keep arriving.
          () => {
            if (mountedRef.current) setIsStreaming(true);
          },
        );
        if (!mountedRef.current) {
          unlisten();
          stopLogStream(newId).catch(() => {});
          return;
        }
        // Retire the dead stream: its listener would otherwise outlive it
        const dead = unlistenByStreamRef.current.get(streamId);
        if (dead) {
          dead();
          unlistenByStreamRef.current.delete(streamId);
          const listenerIdx = activeListeners.current.indexOf(dead);
          if (listenerIdx !== -1) activeListeners.current.splice(listenerIdx, 1);
        }
        const idx = activeStreamIds.current.indexOf(streamId);
        if (idx !== -1) activeStreamIds.current.splice(idx, 1);
        activeStreamIds.current.push(newId);
        activeListeners.current.push(unlisten);
      } catch (e) {
        console.error(`Failed to resubscribe log stream for pod ${podName}:`, e);
      }
    })();
  }

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

        resubscribedRef.current.clear();

        const streamIds: string[] = [];
        const listeners: UnlistenFn[] = [];
        let startedCount = 0;

        const onStarted = () => {
          startedCount++;
          if (startedCount === currentPods.length && mountedRef.current) {
            setIsStreaming(true);
            setIsLoading(false);
          }
        };

        for (const pod of currentPods) {
          if (!mountedRef.current) break;
          const { streamId, unlisten } = await subscribePod(
            pod.name,
            { follow: true, timestamps: true, tail_lines: tailLines },
            onStarted,
          );
          streamIds.push(streamId);
          listeners.push(unlisten);
        }

        activeStreamIds.current = streamIds;
        activeListeners.current = listeners;

        // Unmounted while streams were starting - the effect cleanup already
        // ran with empty refs, so tear everything down here
        if (!mountedRef.current) {
          await stopAllStreams();
        }
      } catch (e) {
        if (mountedRef.current) {
          setError(toKubeliError(e));
          setIsLoading(false);
          setIsStreaming(false);
        }
      }
    },
    [isStreaming, stopAllStreams, fetchPods, subscribePod]
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
    const watchId = `workload-pods-${kind}-${namespace}-${workloadName}-${Date.now()}`;
    let watchUnlisten: UnlistenFn | null = null;
    let cancelled = false;

    const setupWatch = async () => {
      try {
        await fetchPods();
        if (cancelled || !selectorQueryRef.current) return;

        // Listen for pod watch events
        const unlisten = await listen<WatchEvent<PodInfo>>(
          `pods-watch-${watchId}`,
          (event) => {
            if (!mountedRef.current) return;
            const watchEvent = event.payload;

            setPods((prev) => {
              switch (watchEvent.type) {
                case "Added": {
                  const pod = watchEvent.data as PodInfo;
                  if (pod.phase !== "Running" && pod.phase !== "Pending") return prev;
                  // Don't add duplicates
                  if (prev.some((p) => p.uid === pod.uid)) {
                    return prev.map((p) => p.uid === pod.uid ? pod : p);
                  }
                  return [...prev, pod];
                }
                case "Modified": {
                  const pod = watchEvent.data as PodInfo;
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
                    (p) => p.phase === "Running" || p.phase === "Pending"
                  );
                }
                default:
                  return prev;
              }
            });
          }
        );

        // Cleanup ran while listen() was pending - drop the listener now
        if (cancelled) {
          unlisten();
          return;
        }
        watchUnlisten = unlisten;

        // Start the watch
        await watchPods(watchId, namespace, selectorQueryRef.current);

        // Cleanup ran while watchPods() was pending - its stopWatch was a
        // no-op back then, so stop the watch here
        if (cancelled) {
          stopWatch(watchId).catch(() => {});
        }
      } catch {
        // Watch failed - no fallback needed, initial fetch already loaded pods
      }
    };

    setupWatch();

    return () => {
      cancelled = true;
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
  }, [fetchPods, namespace, workloadName, kind]);

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
