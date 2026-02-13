"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useClusterStore } from "../stores/cluster-store";
import {
  getNodeMetrics,
  getPodMetrics,
  getClusterMetricsSummary,
  checkMetricsServer,
} from "../tauri/commands";
import type {
  NodeMetrics,
  PodMetrics,
  ClusterMetricsSummary,
} from "../types";

interface UseMetricsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  /** Faster interval for the first few polls to build sparkline data quickly */
  initialRefreshInterval?: number;
}

interface UseClusterMetricsReturn {
  summary: ClusterMetricsSummary | null;
  isLoading: boolean;
  error: string | null;
  metricsAvailable: boolean;
  refresh: () => Promise<void>;
}

interface UseNodeMetricsReturn {
  data: NodeMetrics[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface UsePodMetricsReturn {
  data: PodMetrics[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useClusterMetrics(options: UseMetricsOptions = {}): UseClusterMetricsReturn {
  const [summary, setSummary] = useState<ClusterMetricsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metricsAvailable, setMetricsAvailable] = useState(false);
  const { isConnected } = useClusterStore();

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getClusterMetricsSummary();
      setSummary(result);
      setMetricsAvailable(result.metrics_available);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Failed to fetch cluster metrics";
      setError(errorMsg);
      // Check if it's a metrics server availability issue
      if (errorMsg.includes("Metrics server not available")) {
        setMetricsAvailable(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 15000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    summary,
    isLoading,
    error,
    metricsAvailable,
    refresh,
  };
}

export function useNodeMetrics(options: UseMetricsOptions = {}): UseNodeMetricsReturn {
  const [data, setData] = useState<NodeMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useClusterStore();

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getNodeMetrics();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch node metrics");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 15000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
  };
}

export function usePodMetrics(
  namespace?: string,
  options: UseMetricsOptions = {}
): UsePodMetricsReturn {
  const [data, setData] = useState<PodMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, currentNamespace } = useClusterStore();
  const ns = namespace ?? currentNamespace;
  const pollCount = useRef(0);

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getPodMetrics(ns || undefined);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch pod metrics");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, ns]);

  useEffect(() => {
    if (isConnected) {
      pollCount.current = 0;
      refresh();
    }
  }, [isConnected, refresh]);

  // Burst-then-normal polling: fast initial polls to build sparkline data
  // quickly with real values, then settle to normal interval.
  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;

    const burstMs = options.initialRefreshInterval;
    const normalMs = options.refreshInterval || 15000;
    const BURST_POLLS = burstMs ? 3 : 0;
    let timer: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      const ms = pollCount.current < BURST_POLLS ? burstMs! : normalMs;
      timer = setTimeout(() => {
        pollCount.current++;
        refresh();
        scheduleNext();
      }, ms);
    };

    scheduleNext();
    return () => clearTimeout(timer);
  }, [options.autoRefresh, options.refreshInterval, options.initialRefreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
  };
}

export function useMetricsAvailability(): { available: boolean; checking: boolean } {
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(true);
  const { isConnected } = useClusterStore();

  useEffect(() => {
    if (!isConnected) {
      setChecking(false);
      setAvailable(false);
      return;
    }

    const check = async () => {
      setChecking(true);
      try {
        const result = await checkMetricsServer();
        setAvailable(result);
      } catch {
        setAvailable(false);
      } finally {
        setChecking(false);
      }
    };

    check();
  }, [isConnected]);

  return { available, checking };
}
