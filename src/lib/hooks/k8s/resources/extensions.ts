"use client";

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
import { useK8sResource } from "../useK8sResource";
import type { UseK8sResourcesOptions, UseK8sResourcesReturn } from "../types";
import type { CustomResourceDefinitionRef } from "@/lib/custom-resources";

/**
 * Hook for fetching CustomResourceDefinitions (cluster-scoped).
 */
export const useCRDs = createClusterScopedHook<CRDInfo>("CRDs", listCRDs);

export function useCustomResources(
  definition: CustomResourceDefinitionRef,
  options: UseK8sResourcesOptions = {}
): UseK8sResourcesReturn<CustomResourceInfo> {
  return useK8sResource<CustomResourceInfo>(
    {
      displayName: `Custom Resources:${definition.group}:${definition.kind}`,
      clusterScoped: !definition.namespaced,
      listFn: (listOptions = {}) =>
        listCustomResources({
          ...definition,
          namespace: definition.namespaced ? listOptions.namespace : undefined,
        }),
    },
    options
  );
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
