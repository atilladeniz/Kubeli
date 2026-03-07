"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listCRDs,
  listCustomResources,
  listPriorityClasses,
  listRuntimeClasses,
  listMutatingWebhooks,
  listValidatingWebhooks,
  listHelmReleases,
  listFluxKustomizations,
} from "../../../tauri/commands";
import type {
  CRDInfo,
  CustomResourceInfo,
  PriorityClassInfo,
  RuntimeClassInfo,
  MutatingWebhookInfo,
  ValidatingWebhookInfo,
  HelmReleaseInfo,
  FluxKustomizationInfo,
} from "../../../types";
import { createClusterScopedHook, createOptionalNamespaceHook } from "../factory";
import type { UseK8sResourcesOptions, UseK8sResourcesReturn } from "../types";
import type { CustomResourceDefinitionRef } from "@/lib/custom-resources";
import { useClusterStore } from "../../../stores/cluster-store";
import { useResourceCacheStore } from "../../../stores/resource-cache-store";
import { pSettledWithLimit, MAX_CONCURRENT_NS_REQUESTS } from "../utils";
import { type KubeliError, toKubeliError, getErrorMessage } from "../../../types/errors";

/**
 * Hook for fetching CustomResourceDefinitions (cluster-scoped).
 */
export const useCRDs = createClusterScopedHook<CRDInfo>("CRDs", listCRDs);

export function filterCustomResourcesByNamespaces(
  resources: CustomResourceInfo[],
  namespaces: string[]
): CustomResourceInfo[] {
  if (namespaces.length === 0) {
    return resources;
  }

  const allowed = new Set(namespaces);
  return resources.filter(
    (resource) => resource.namespace && allowed.has(resource.namespace)
  );
}

export function useCustomResources(
  definition: CustomResourceDefinitionRef,
  options: UseK8sResourcesOptions = {}
): UseK8sResourcesReturn<CustomResourceInfo> {
  const {
    isConnected,
    selectedNamespaces,
    namespaceSource,
    namespaces: configuredNamespaces,
  } = useClusterStore();
  const namespace =
    options.namespace ?? (selectedNamespaces.length === 1 ? selectedNamespaces[0] : "");
  const isMultiNs = !options.namespace && selectedNamespaces.length > 1;
  const isConfiguredAllNs =
    namespaceSource === "configured" &&
    !options.namespace &&
    selectedNamespaces.length === 0;
  const displayName = `Custom Resources:${definition.group}:${definition.kind}`;
  const { getCache, setCache } = useResourceCacheStore();
  const cacheKey = `${displayName}:${options.namespace ?? (isConfiguredAllNs
    ? `configured:${configuredNamespaces.slice().sort().join(",")}`
    : isMultiNs
      ? selectedNamespaces.slice().sort().join(",")
      : namespace)}`;

  const [data, setData] = useState<CustomResourceInfo[]>(() =>
    getCache<CustomResourceInfo>(cacheKey)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<KubeliError | null>(null);

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      let result: CustomResourceInfo[];

      if (!definition.namespaced) {
        result = await listCustomResources(definition);
      } else if (namespace) {
        result = await listCustomResources({
          ...definition,
          namespace,
        });
      } else {
        const namespaceFilter = isConfiguredAllNs
          ? configuredNamespaces
          : selectedNamespaces;

        try {
          result = await listCustomResources(definition);
          result = filterCustomResourcesByNamespaces(result, namespaceFilter);
        } catch (error) {
          if (namespaceFilter.length === 0) {
            throw error;
          }

          const outcomes = await pSettledWithLimit(
            namespaceFilter.map((ns) => () =>
              listCustomResources({
                ...definition,
                namespace: ns,
              })
            ),
            MAX_CONCURRENT_NS_REQUESTS
          );

          result = [];
          const errors: string[] = [];

          outcomes.forEach((outcome, index) => {
            if (outcome.status === "fulfilled") {
              result.push(...outcome.value);
            } else {
              errors.push(`${namespaceFilter[index]}: ${getErrorMessage(outcome.reason)}`);
            }
          });

          if (errors.length > 0 && result.length === 0) {
            throw new Error(
              `Failed to fetch ${definition.kind}: ${errors.join("; ")}`
            );
          }
        }
      }

      setData(result);
      setCache(cacheKey, result);
    } catch (error) {
      setError(toKubeliError(error));
    } finally {
      setIsLoading(false);
    }
  }, [
    cacheKey,
    configuredNamespaces,
    definition,
    isConfiguredAllNs,
    isConnected,
    namespace,
    selectedNamespaces,
    setCache,
  ]);

  useEffect(() => {
    setData(getCache<CustomResourceInfo>(cacheKey));
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
  }, [isConnected, options.autoRefresh, options.refreshInterval, refresh]);

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

/**
 * Hook for fetching PriorityClasses (cluster-scoped).
 */
export const usePriorityClasses = createClusterScopedHook<PriorityClassInfo>(
  "Priority Classes",
  listPriorityClasses
);

/**
 * Hook for fetching RuntimeClasses (cluster-scoped).
 */
export const useRuntimeClasses = createClusterScopedHook<RuntimeClassInfo>(
  "Runtime Classes",
  listRuntimeClasses
);

/**
 * Hook for fetching MutatingWebhookConfigurations (cluster-scoped).
 */
export const useMutatingWebhooks = createClusterScopedHook<MutatingWebhookInfo>(
  "Mutating Webhooks",
  listMutatingWebhooks
);

/**
 * Hook for fetching ValidatingWebhookConfigurations (cluster-scoped).
 */
export const useValidatingWebhooks = createClusterScopedHook<ValidatingWebhookInfo>(
  "Validating Webhooks",
  listValidatingWebhooks
);

/**
 * Hook for fetching Helm Releases.
 */
export const useHelmReleases = createOptionalNamespaceHook<HelmReleaseInfo>(
  "Helm Releases",
  listHelmReleases
);

/**
 * Hook for fetching Flux Kustomizations.
 */
export const useFluxKustomizations = createOptionalNamespaceHook<FluxKustomizationInfo>(
  "Flux Kustomizations",
  listFluxKustomizations
);
