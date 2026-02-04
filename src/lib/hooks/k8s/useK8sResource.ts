"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useClusterStore } from "../../stores/cluster-store";
import { watchPods, stopWatch } from "../../tauri/commands";
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
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [watchId, setWatchId] = useState<string | null>(null);
  const watchRetryUntilRef = useRef<number | null>(null);

  const { isConnected, currentNamespace } = useClusterStore();
  const namespace = options.namespace ?? currentNamespace;

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      let result: T[];

      if (config.clusterScoped) {
        // Cluster-scoped resources don't need namespace
        result = await config.listFn({});
      } else {
        // Namespaced resources
        const listOptions: ListOptions = namespace ? { namespace } : {};
        result = await config.listFn(listOptions);
      }

      // Apply post-processing if defined
      if (config.postProcess) {
        result = config.postProcess(result);
      }

      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to fetch ${config.displayName}`);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, namespace, config]);

  const startWatch = useCallback(async () => {
    if (!isConnected || watchId || !config.supportsWatch) return;

    const id = `${config.displayName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
    setWatchId(id);
    setError(null);

    try {
      await watchPods(id, namespace || undefined);
      setIsWatching(true);
      watchRetryUntilRef.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start watch");
      setIsWatching(false);
      setWatchId(null);
      watchRetryUntilRef.current = Date.now() + 5000;
    }
  }, [isConnected, watchId, namespace, config.displayName, config.supportsWatch]);

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

  // Listen for watch events (pods only)
  useEffect(() => {
    if (!watchId || !config.supportsWatch) return;

    let unlisten: UnlistenFn;

    // Helper to safely get uid from an item (only used for watchable resources)
    const getUid = (item: T): string | undefined => {
      return (item as unknown as { uid?: string }).uid;
    };

    const setupListener = async () => {
      unlisten = await listen<WatchEvent<T>>(`pods-watch-${watchId}`, (event) => {
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
  }, [watchId, config.supportsWatch]);

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
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useClusterStore();

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listFn();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to fetch ${displayName}`);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, listFn, displayName]);

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
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, currentNamespace } = useClusterStore();
  const namespace = options.namespace ?? currentNamespace;

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listFn(namespace || undefined);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to fetch ${displayName}`);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, namespace, listFn, displayName]);

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
