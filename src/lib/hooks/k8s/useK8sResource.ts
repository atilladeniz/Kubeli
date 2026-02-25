"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useClusterStore } from "../../stores/cluster-store";
import { useResourceCacheStore } from "../../stores/resource-cache-store";
import { stopWatch } from "../../tauri/commands";
import { pSettledWithLimit, MAX_CONCURRENT_NS_REQUESTS, NAMESPACE_CHANGE_DEBOUNCE_MS } from "./utils";
import type { ListOptions, WatchEvent } from "../../types";
import type { UseK8sResourcesOptions, UseK8sResourcesReturn, ResourceHookConfig } from "./types";

/**
 * Core hook for fetching and managing Kubernetes resources.
 * Supports per-namespace fetching, multi-namespace watch, and auto-refresh.
 */
export function useK8sResource<T>(
  config: ResourceHookConfig<T>,
  options: UseK8sResourcesOptions = {}
): UseK8sResourcesReturn<T> {
  const { isConnected, selectedNamespaces, namespaceSource, namespaces: configuredNamespaces } = useClusterStore();
  const isMultiNs = !options.namespace && selectedNamespaces.length > 1;
  const isConfiguredAllNs = namespaceSource === "configured" && !options.namespace && selectedNamespaces.length === 0;
  const namespace = options.namespace ?? (selectedNamespaces.length === 1 ? selectedNamespaces[0] : "");
  const { getCache, setCache } = useResourceCacheStore();
  const cacheKey = `${config.displayName}:${options.namespace ?? (isConfiguredAllNs ? `configured:${configuredNamespaces.slice().sort().join(",")}` : isMultiNs ? selectedNamespaces.slice().sort().join(",") : namespace)}`;

  const [data, setData] = useState<T[]>(() => getCache<T>(cacheKey));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [watchIds, setWatchIds] = useState<string[]>([]);
  const watchRetryUntilRef = useRef<number | null>(null);
  const watchNamespacesRef = useRef<string[]>([]);
  // Ref mirrors watchIds state for use in async callbacks and cleanup
  const watchIdsRef = useRef<string[]>([]);
  // Guard against concurrent startWatch calls
  const watchStartingRef = useRef(false);

  // ── Fetching ──────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      let result: T[];

      if (config.clusterScoped) {
        result = await config.listFn({});
      } else if (isConfiguredAllNs && configuredNamespaces.length > 0) {
        // Fetch each configured namespace individually to avoid 403 from Api::all()
        const outcomes = await pSettledWithLimit(
          configuredNamespaces.map((ns) => () => config.listFn({ namespace: ns })),
          MAX_CONCURRENT_NS_REQUESTS
        );
        result = [];
        const errors: string[] = [];
        outcomes.forEach((outcome, i) => {
          if (outcome.status === "fulfilled") {
            result.push(...outcome.value);
          } else {
            errors.push(`${configuredNamespaces[i]}: ${outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)}`);
          }
        });
        if (errors.length > 0 && result.length === 0) {
          throw new Error(`Failed to fetch ${config.displayName}: ${errors.join("; ")}`);
        }
      } else if (isMultiNs) {
        // Fetch each selected namespace individually to avoid 403 from Api::all()
        const outcomes = await pSettledWithLimit(
          selectedNamespaces.map((ns) => () => config.listFn({ namespace: ns })),
          MAX_CONCURRENT_NS_REQUESTS
        );
        result = [];
        const errors: string[] = [];
        outcomes.forEach((outcome, i) => {
          if (outcome.status === "fulfilled") {
            result.push(...outcome.value);
          } else {
            errors.push(`${selectedNamespaces[i]}: ${outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)}`);
          }
        });
        if (errors.length > 0 && result.length === 0) {
          throw new Error(`Failed to fetch ${config.displayName}: ${errors.join("; ")}`);
        }
      } else {
        const listOptions: ListOptions = namespace ? { namespace } : {};
        result = await config.listFn(listOptions);
      }

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
  }, [isConnected, namespace, isMultiNs, isConfiguredAllNs, configuredNamespaces, selectedNamespaces, config, cacheKey, setCache]);

  // ── Watch management ──────────────────────────────────────────────

  const startWatch = useCallback(async () => {
    if (!isConnected || watchIds.length > 0 || watchStartingRef.current || !config.supportsWatch) return;
    watchStartingRef.current = true;

    let namespacesToWatch: (string | undefined)[];
    if (isMultiNs) {
      namespacesToWatch = selectedNamespaces;
    } else if (isConfiguredAllNs && configuredNamespaces.length > 0) {
      namespacesToWatch = configuredNamespaces;
    } else {
      namespacesToWatch = [namespace || undefined];
    }

    const base = config.displayName.toLowerCase().replace(/\s+/g, "-");
    const timestamp = Date.now();
    const ids: string[] = [];

    setError(null);

    try {
      for (let i = 0; i < namespacesToWatch.length; i++) {
        const ns = namespacesToWatch[i];
        const id = namespacesToWatch.length > 1
          ? `${base}-${ns || "all"}-${timestamp}-${i}`
          : `${base}-${timestamp}`;
        await config.watchFn!(id, ns);
        ids.push(id);
      }
      watchIdsRef.current = ids;
      setWatchIds(ids);
      watchNamespacesRef.current = namespacesToWatch.filter((ns): ns is string => ns !== undefined);
      setIsWatching(true);
      watchRetryUntilRef.current = null;
    } catch (e) {
      for (const id of ids) {
        stopWatch(id).catch(() => {});
      }
      setError(e instanceof Error ? e.message : "Failed to start watch");
      setIsWatching(false);
      watchIdsRef.current = [];
      setWatchIds([]);
      watchRetryUntilRef.current = Date.now() + 5000;
    } finally {
      watchStartingRef.current = false;
    }
  }, [isConnected, watchIds, namespace, isMultiNs, isConfiguredAllNs, selectedNamespaces, configuredNamespaces, config.displayName, config.supportsWatch, config.watchFn]);

  const stopWatchFn = useCallback(async () => {
    if (watchIdsRef.current.length === 0) return;
    const idsToStop = watchIdsRef.current;
    watchIdsRef.current = [];
    setWatchIds([]);
    setIsWatching(false);
    watchRetryUntilRef.current = null;
    try {
      await Promise.all(idsToStop.map((id) => stopWatch(id)));
    } catch (e) {
      console.error("Failed to stop watches:", e);
    }
  }, []);

  // ── Watch event listeners ─────────────────────────────────────────

  useEffect(() => {
    if (watchIds.length === 0 || !config.supportsWatch) return;

    let cancelled = false;
    const unlisteners: UnlistenFn[] = [];
    const prefix = config.watchEventPrefix || "pods";
    const isMultiWatch = watchIds.length > 1;

    const getUid = (item: T): string | undefined => {
      return (item as unknown as { uid?: string }).uid;
    };

    const handleWatchEvent = (watchEvent: WatchEvent<T>) => {
      if (cancelled) return;

      if (watchEvent.type === "Error") {
        const message =
          typeof watchEvent.data === "string" ? watchEvent.data : "Watch error";
        setError(message);
        setIsWatching(false);
        watchRetryUntilRef.current = Date.now() + 5000;
        const idsToStop = watchIdsRef.current;
        watchIdsRef.current = [];
        setWatchIds([]);
        idsToStop.forEach((id) => stopWatch(id).catch(() => {}));
        return;
      }

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
            const restartedItems = watchEvent.data as T[];
            if (!isMultiWatch) {
              return restartedItems;
            }
            // Multi-watch: only replace items from the restarted namespace(s)
            const restartedNs = new Set(
              restartedItems
                .map((item) => (item as unknown as { namespace?: string }).namespace)
                .filter((ns): ns is string => ns != null)
            );
            const kept = prev.filter((item) => {
              const ns = (item as unknown as { namespace?: string }).namespace;
              return ns == null || !restartedNs.has(ns);
            });
            return [...kept, ...restartedItems];
          }
          default:
            return prev;
        }
      });
    };

    const setupListeners = async () => {
      for (const id of watchIds) {
        if (cancelled) return;
        const unlisten = await listen<WatchEvent<T>>(`${prefix}-watch-${id}`, (event) => {
          handleWatchEvent(event.payload);
        });
        if (cancelled) {
          unlisten();
          return;
        }
        unlisteners.push(unlisten);
      }
    };

    setupListeners();

    return () => {
      cancelled = true;
      unlisteners.forEach((fn) => fn());
    };
  }, [watchIds, config.supportsWatch, config.watchEventPrefix]);

  // ── Lifecycle effects ─────────────────────────────────────────────

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

  // Auto-refresh (disabled while watching)
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

  // Restart watches when namespace selection changes (debounced)
  useEffect(() => {
    if (!isWatching || watchIds.length === 0 || !config.supportsWatch) return;

    let targetNs: string[];
    if (isMultiNs) {
      targetNs = selectedNamespaces;
    } else if (isConfiguredAllNs) {
      targetNs = configuredNamespaces;
    } else {
      targetNs = namespace ? [namespace] : [];
    }

    const currentSorted = watchNamespacesRef.current.slice().sort().join(",");
    const targetSorted = targetNs.slice().sort().join(",");
    if (currentSorted === targetSorted) return;

    const timer = setTimeout(async () => {
      const idsToStop = watchIdsRef.current;
      watchIdsRef.current = [];
      setWatchIds([]);
      setIsWatching(false);
      try {
        await Promise.all(idsToStop.map((id) => stopWatch(id)));
      } catch {
        // Watches may already be stopped
      }
    }, NAMESPACE_CHANGE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [namespace, isMultiNs, isConfiguredAllNs, selectedNamespaces, configuredNamespaces, isWatching, watchIds, config.supportsWatch]);

  // Auto-start watch if enabled
  useEffect(() => {
    if (!options.autoWatch || !isConnected || isWatching || watchIds.length > 0 || isLoading) return;
    if (!config.supportsWatch) return;

    const retryUntil = watchRetryUntilRef.current;
    const delay = retryUntil && retryUntil > Date.now() ? retryUntil - Date.now() : 500;

    const timer = setTimeout(() => {
      startWatch();
    }, delay);

    return () => clearTimeout(timer);
  }, [options.autoWatch, isConnected, isWatching, isLoading, watchIds, config.supportsWatch, startWatch]);

  // Cleanup watches on unmount
  useEffect(() => {
    return () => {
      watchIdsRef.current.forEach((id) => stopWatch(id).catch(console.error));
    };
  }, []);

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
