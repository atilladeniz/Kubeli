"use client";

import { useEffect, useState, useCallback } from "react";
import { useClusterStore } from "../stores/cluster-store";
import { getPodMetrics } from "../tauri/commands";

/** A single metrics snapshot for a pod */
export interface MetricsSnapshot {
  timestamp: number; // unix seconds
  cpuNanoCores: number;
  memoryBytes: number;
}

/** Max data points to keep per pod (5 min at 10s interval = 30 points) */
const MAX_POINTS = 30;
const POLL_INTERVAL = 10_000; // 10 seconds

/**
 * In-memory store for metrics history.
 * Keyed by "namespace/podName" -> array of snapshots.
 * Lives outside React to persist across component remounts within a session.
 */
const historyStore = new Map<string, MetricsSnapshot[]>();

function getHistory(key: string): MetricsSnapshot[] {
  let arr = historyStore.get(key);
  if (!arr) {
    arr = [];
    historyStore.set(key, arr);
  }
  return arr;
}

function pushSnapshot(key: string, snapshot: MetricsSnapshot): MetricsSnapshot[] {
  const arr = getHistory(key);
  arr.push(snapshot);
  if (arr.length > MAX_POINTS) {
    arr.shift();
  }
  return [...arr];
}

/** Clear all history (e.g. on cluster disconnect) */
export function clearMetricsHistory() {
  historyStore.clear();
}

/**
 * Hook that polls pod metrics and accumulates history over the session.
 * Returns the history array for the specified pod.
 */
export function useMetricsHistory(
  podName: string,
  namespace: string,
): MetricsSnapshot[] {
  const { isConnected } = useClusterStore();
  const key = `${namespace}/${podName}`;
  const [history, setHistory] = useState<MetricsSnapshot[]>(() => [...getHistory(key)]);

  const poll = useCallback(async () => {
    if (!isConnected) return;
    try {
      const result = await getPodMetrics(namespace, podName);
      const match = result.find(
        (m) => m.name === podName && m.namespace === namespace,
      );
      if (match) {
        const updated = pushSnapshot(key, {
          timestamp: Math.floor(Date.now() / 1000),
          cpuNanoCores: match.total_cpu_nano_cores,
          memoryBytes: match.total_memory_bytes,
        });
        setHistory(updated);
      }
    } catch {
      // Silently ignore polling errors
    }
  }, [isConnected, podName, namespace, key]);

  useEffect(() => {
    // Use setTimeout(0) for initial poll to avoid synchronous setState in effect
    const initial = setTimeout(poll, 0);
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [poll]);

  return history;
}
