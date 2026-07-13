"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useClusterStore } from "../../stores/cluster-store";
import { useResourceCacheStore } from "../../stores/resource-cache-store";
import { type KubeliError, toKubeliError, getErrorMessage } from "../../types/errors";
import { pSettledWithLimit, MAX_CONCURRENT_NS_REQUESTS } from "./utils";
import type { UseK8sResourcesOptions, UseK8sResourcesReturn } from "./types";

/**
 * Hook for resources with optional namespace parameter (different signature).
 * Some Tauri commands accept namespace as a direct parameter instead of ListOptions.
 */
export function useOptionalNamespaceResource<T>(
  displayName: string,
  listFn: (namespace?: string) => Promise<T[]>,
  options: UseK8sResourcesOptions = {}
): UseK8sResourcesReturn<T> {
  const isConnected = useClusterStore((s) => s.isConnected);
  const selectedNamespaces = useClusterStore((s) => s.selectedNamespaces);
  const namespaceSource = useClusterStore((s) => s.namespaceSource);
  const configuredNamespaces = useClusterStore((s) => s.namespaces);
  const isMultiNs = !options.namespace && selectedNamespaces.length > 1;
  const isConfiguredAllNs = namespaceSource === "configured" && !options.namespace && selectedNamespaces.length === 0;
  const namespace = options.namespace ?? (selectedNamespaces.length === 1 ? selectedNamespaces[0] : "");
  const getCache = useResourceCacheStore((s) => s.getCache);
  const setCache = useResourceCacheStore((s) => s.setCache);
  const cacheKey = `${displayName}:${options.namespace ?? (isConfiguredAllNs ? `configured:${configuredNamespaces.slice().sort().join(",")}` : isMultiNs ? selectedNamespaces.slice().sort().join(",") : namespace)}`;

  const [data, setData] = useState<T[]>(() => getCache<T>(cacheKey));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<KubeliError | null>(null);
  // Generation counter: a stale (older, slower) refresh must not overwrite
  // the state written by a newer one
  const refreshSeq = useRef(0);

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    const seq = ++refreshSeq.current;
    setIsLoading(true);
    setError(null);
    try {
      let result: T[];
      if (isConfiguredAllNs && configuredNamespaces.length > 0) {
        // Configured mode "All Namespaces": fetch each namespace individually
        const outcomes = await pSettledWithLimit(
          configuredNamespaces.map((ns) => () => listFn(ns)),
          MAX_CONCURRENT_NS_REQUESTS
        );
        result = [];
        const errors: string[] = [];
        outcomes.forEach((outcome, i) => {
          if (outcome.status === "fulfilled") {
            result.push(...outcome.value);
          } else {
            errors.push(`${configuredNamespaces[i]}: ${getErrorMessage(outcome.reason)}`);
          }
        });
        if (errors.length > 0 && result.length === 0) {
          throw new Error(`Failed to fetch ${displayName}: ${errors.join("; ")}`);
        }
      } else if (isMultiNs) {
        // Multi-namespace: fetch each namespace individually to avoid
        // 403 from Api::all() on RBAC-restricted clusters
        const outcomes = await pSettledWithLimit(
          selectedNamespaces.map((ns) => () => listFn(ns)),
          MAX_CONCURRENT_NS_REQUESTS
        );
        result = [];
        const errors: string[] = [];
        outcomes.forEach((outcome, i) => {
          if (outcome.status === "fulfilled") {
            result.push(...outcome.value);
          } else {
            errors.push(`${selectedNamespaces[i]}: ${getErrorMessage(outcome.reason)}`);
          }
        });
        if (errors.length > 0 && result.length === 0) {
          throw new Error(`Failed to fetch ${displayName}: ${errors.join("; ")}`);
        }
      } else {
        result = await listFn(namespace || undefined);
      }
      // A newer refresh superseded this one - drop the stale result
      if (seq !== refreshSeq.current) return;
      setData(result);
      setCache(cacheKey, result);
    } catch (e) {
      if (seq !== refreshSeq.current) return;
      setError(toKubeliError(e));
    } finally {
      if (seq === refreshSeq.current) {
        setIsLoading(false);
      }
    }
  }, [isConnected, namespace, isMultiNs, isConfiguredAllNs, configuredNamespaces, selectedNamespaces, listFn, displayName, cacheKey, setCache]);

  // Reset data from cache when cache key changes (e.g. namespace switch)
  useEffect(() => {
    setData(getCache<T>(cacheKey));
  }, [cacheKey, getCache]);

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
