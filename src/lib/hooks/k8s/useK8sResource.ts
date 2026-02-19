"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useClusterStore } from "../../stores/cluster-store";
import { useResourceCacheStore } from "../../stores/resource-cache-store";
import { stopWatch } from "../../tauri/commands";
import type { ListOptions, WatchEvent } from "../../types";
import type { UseK8sResourcesOptions, UseK8sResourcesReturn, ResourceHookConfig } from "./types";

/**
 * Core hook for fetching and managing Kubernetes resources.
 * This is the internal implementation used by all resource-specific hooks.
 */
export function useK8sResource<T>(
  config: ResourceHookConfig<T>,
  options: UseK8sResourcesOptions = {}
): UseK8sResourcesReturn<T> {
  const { isConnected, selectedNamespaces } = useClusterStore();
  const isMultiNs = !options.namespace && selectedNamespaces.length > 1;
  const namespace = options.namespace ?? (selectedNamespaces.length === 1 ? selectedNamespaces[0] : "");
  const { getCache, setCache } = useResourceCacheStore();
  const cacheKey = `${config.displayName}:${options.namespace ?? (isMultiNs ? selectedNamespaces.slice().sort().join(",") : namespace)}`;

  const [data, setData] = useState<T[]>(() => getCache<T>(cacheKey));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [watchId, setWatchId] = useState<string | null>(null);
  const watchRetryUntilRef = useRef<number | null>(null);
  const watchNamespaceRef = useRef<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      let result: T[];

      if (config.clusterScoped) {
        // Cluster-scoped resources don't need namespace
        result = await config.listFn({});
      } else if (isMultiNs) {
        // Multi-namespace: fetch all, then filter client-side
        result = await config.listFn({});
        const nsSet = new Set(selectedNamespaces);
        result = result.filter((item) => {
          const ns = (item as unknown as { namespace?: string }).namespace;
          return ns != null && nsSet.has(ns);
        });
      } else {
        // Single or all namespaces
        const listOptions: ListOptions = namespace ? { namespace } : {};
        result = await config.listFn(listOptions);
      }

      // Apply post-processing if defined
      if (config.postProcess) {
        result = config.postProcess(result);
      }

      setData(result);
      setCache(cacheKey, result);
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to fetch ${config.displayName}`);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, namespace, isMultiNs, selectedNamespaces, config, cacheKey, setCache]);

  const startWatch = useCallback(async () => {
    if (!isConnected || watchId || !config.supportsWatch) return;

    const id = `${config.displayName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
    setWatchId(id);
    setError(null);

    try {
      await config.watchFn!(id, namespace || undefined);
      watchNamespaceRef.current = namespace || undefined;
      setIsWatching(true);
      watchRetryUntilRef.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start watch");
      setIsWatching(false);
      setWatchId(null);
      watchRetryUntilRef.current = Date.now() + 5000;
    }
  }, [isConnected, watchId, namespace, config.displayName, config.supportsWatch, config.watchFn]);

  const stopWatchFn = useCallback(async () => {
    if (!watchId) return;
    try {
      await stopWatch(watchId);
      setIsWatching(false);
      setWatchId(null);
      watchRetryUntilRef.current = null;
    } catch (e) {
      console.error("Failed to stop watch:", e);
    }
  }, [watchId]);

  // Listen for watch events
  useEffect(() => {
    if (!watchId || !config.supportsWatch) return;

    let unlisten: UnlistenFn;
    const prefix = config.watchEventPrefix || "pods";

    // Helper to safely get uid from an item (only used for watchable resources)
    const getUid = (item: T): string | undefined => {
      return (item as unknown as { uid?: string }).uid;
    };

    const setupListener = async () => {
      unlisten = await listen<WatchEvent<T>>(`${prefix}-watch-${watchId}`, (event) => {
        const watchEvent = event.payload;

        setData((prev) => {
          switch (watchEvent.type) {
            case "Added": {
              const newItem = watchEvent.data as T;
              const newUid = getUid(newItem);
              const index = prev.findIndex((item) => getUid(item) === newUid);
              if (index === -1) return [...prev, newItem];
              const next = [...prev];
              next[index] = newItem;
              return next;
            }
            case "Modified": {
              const modifiedItem = watchEvent.data as T;
              const modifiedUid = getUid(modifiedItem);
              const index = prev.findIndex((item) => getUid(item) === modifiedUid);
              if (index === -1) return [...prev, modifiedItem];
              const next = [...prev];
              next[index] = modifiedItem;
              return next;
            }
            case "Deleted": {
              const deletedItem = watchEvent.data as T;
              const deletedUid = getUid(deletedItem);
              return prev.filter((item) => getUid(item) !== deletedUid);
            }
            case "Restarted": {
              return watchEvent.data as T[];
            }
            case "Error": {
              const message =
                typeof watchEvent.data === "string" ? watchEvent.data : "Watch error";
              setError(message);
              setIsWatching(false);
              setWatchId(null);
              watchRetryUntilRef.current = Date.now() + 5000;
              if (watchId) {
                stopWatch(watchId).catch(() => {});
              }
              return prev;
            }
            default:
              return prev;
          }
        });
      });
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [watchId, config.supportsWatch, config.watchEventPrefix]);

  // Reset data from cache when cache key changes (e.g. namespace switch)
  useEffect(() => {
    setData(getCache<T>(cacheKey));
  }, [cacheKey, getCache]);

  // Initial fetch
  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  // Auto-refresh
  useEffect(() => {
    if (!options.autoRefresh || !isConnected || isWatching) return;
    const interval = setInterval(
      refresh,
      options.refreshInterval || config.defaultRefreshInterval || 30000
    );
    return () => clearInterval(interval);
  }, [
    options.autoRefresh,
    options.refreshInterval,
    isConnected,
    refresh,
    isWatching,
    config.defaultRefreshInterval,
  ]);

  // Restart watch when namespace changes
  useEffect(() => {
    if (!isWatching || !watchId || !config.supportsWatch) return;

    const currentWatchNs = watchNamespaceRef.current;
    const targetNs = namespace || undefined;

    // If namespace hasn't changed, nothing to do
    if (currentWatchNs === targetNs) return;

    // Namespace changed while watching — stop the current watch.
    // The auto-watch effect will restart it with the new namespace.
    const restart = async () => {
      try {
        await stopWatch(watchId);
      } catch {
        // Watch may already be stopped
      }
      setIsWatching(false);
      setWatchId(null);
    };

    restart();
  }, [namespace, isWatching, watchId, config.supportsWatch]);

  // Auto-start watch if enabled
  useEffect(() => {
    if (!options.autoWatch || !isConnected || isWatching || watchId || isLoading) return;
    if (!config.supportsWatch) return;

    const retryUntil = watchRetryUntilRef.current;
    const delay = retryUntil && retryUntil > Date.now() ? retryUntil - Date.now() : 500;

    const timer = setTimeout(() => {
      startWatch();
    }, delay);

    return () => clearTimeout(timer);
  }, [options.autoWatch, isConnected, isWatching, isLoading, watchId, config.supportsWatch, startWatch]);

  // Cleanup watch on unmount
  useEffect(() => {
    return () => {
      if (watchId) {
        stopWatch(watchId).catch(console.error);
      }
    };
  }, [watchId]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch,
    stopWatchFn,
    isWatching,
  };
}

/**
 * Simplified hook for cluster-scoped resources (no namespace)
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
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listFn();
      setData(result);
      setCache(cacheKey, result);
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to fetch ${displayName}`);
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

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

/**
 * Hook for resources with optional namespace parameter (different signature)
 */
export function useOptionalNamespaceResource<T>(
  displayName: string,
  listFn: (namespace?: string) => Promise<T[]>,
  options: UseK8sResourcesOptions = {}
): UseK8sResourcesReturn<T> {
  const { isConnected, selectedNamespaces } = useClusterStore();
  const isMultiNs = !options.namespace && selectedNamespaces.length > 1;
  const namespace = options.namespace ?? (selectedNamespaces.length === 1 ? selectedNamespaces[0] : "");
  const { getCache, setCache } = useResourceCacheStore();
  const cacheKey = `${displayName}:${options.namespace ?? (isMultiNs ? selectedNamespaces.slice().sort().join(",") : namespace)}`;

  const [data, setData] = useState<T[]>(() => getCache<T>(cacheKey));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      let result: T[];
      if (isMultiNs) {
        // Multi-namespace: fetch all, then filter client-side
        result = await listFn(undefined);
        const nsSet = new Set(selectedNamespaces);
        result = result.filter((item) => {
          const ns = (item as unknown as { namespace?: string }).namespace;
          return ns != null && nsSet.has(ns);
        });
      } else {
        result = await listFn(namespace || undefined);
      }
      setData(result);
      setCache(cacheKey, result);
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to fetch ${displayName}`);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, namespace, isMultiNs, selectedNamespaces, listFn, displayName, cacheKey, setCache]);

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

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}
