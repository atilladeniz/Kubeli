"use client";

import { useCallback, useEffect, useState } from "react";
import { useClusterStore } from "../../stores/cluster-store";
import { useResourceCacheStore } from "../../stores/resource-cache-store";
import { type KubeliError, toKubeliError } from "../../types/errors";
import type { UseK8sResourcesOptions, UseK8sResourcesReturn } from "./types";

/**
 * Simplified hook for cluster-scoped resources (no namespace).
 * Used for Nodes, Namespaces, ClusterRoles, PVs, etc.
 */
export function useClusterScopedResource<T>(
  displayName: string,
  listFn: () => Promise<T[]>,
  options: UseK8sResourcesOptions = {}
): UseK8sResourcesReturn<T> {
  const { isConnected } = useClusterStore();
  const { getCache, setCache } = useResourceCacheStore();
  const cacheKey = `${displayName}:`;

  const [data, setData] = useState<T[]>(() => getCache<T>(cacheKey));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<KubeliError | null>(null);

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listFn();
      setData(result);
      setCache(cacheKey, result);
    } catch (e) {
      setError(toKubeliError(e));
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, listFn, displayName, cacheKey, setCache]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  const retry = useCallback(async () => {
    setError(null);
    await refresh();
  }, [refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    retry,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}
