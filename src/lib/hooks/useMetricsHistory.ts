"use client";

import { useEffect, useState, useCallback } from "react";
import { useClusterStore } from "../stores/cluster-store";
import { getPodMetrics } from "../tauri/commands";
import type { PodMetrics } from "../types";

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

function pushSnapshot(key: string, snapshot: MetricsSnapshot): void {
  const arr = getHistory(key);
  arr.push(snapshot);
  if (arr.length > MAX_POINTS) {
    arr.shift();
  }
}

/** Clear all history (e.g. on cluster disconnect) */
export function clearMetricsHistory() {
  historyStore.clear();
}

/** Small random jitter (±5%) so the initial 2-point sparkline isn't a flat line */
function jitterValue(value: number): number {
  return Math.round(value * (1 + (Math.random() - 0.5) * 0.1));
}

/** Seed history from bulk pod metrics (e.g. from table polling).
 *  Deduplicates by skipping if the last snapshot is within 5s.
 *  On first seed for a pod, adds a synthetic historical point so
 *  sparklines render immediately (they need >= 2 data points). */
export function seedHistoryFromBulkMetrics(metrics: PodMetrics[]) {
  const now = Math.floor(Date.now() / 1000);
  for (const m of metrics) {
    const key = `${m.namespace}/${m.name}`;
    const history = getHistory(key);
    const last = history.at(-1);
    if (last && now - last.timestamp < 5) continue;

    // First time seeing this pod: seed a synthetic point 10s in the past
    // so the sparkline has 2 points and renders immediately
    if (history.length === 0) {
      pushSnapshot(key, {
        timestamp: now - 10,
        cpuNanoCores: jitterValue(m.total_cpu_nano_cores),
        memoryBytes: jitterValue(m.total_memory_bytes),
      });
    }

    pushSnapshot(key, { timestamp: now, cpuNanoCores: m.total_cpu_nano_cores, memoryBytes: m.total_memory_bytes });
  }
}

/** Non-reactive read of history for a pod key ("namespace/podName").
 *  Returns the current snapshot array (or empty). */
export function getHistorySnapshot(key: string): MetricsSnapshot[] {
  return historyStore.get(key) || [];
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
        pushSnapshot(key, {
          timestamp: Math.floor(Date.now() / 1000),
          cpuNanoCores: match.total_cpu_nano_cores,
          memoryBytes: match.total_memory_bytes,
        });
        setHistory([...getHistory(key)]);
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
