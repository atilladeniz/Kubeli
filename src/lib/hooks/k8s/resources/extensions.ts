"use client";

import {
  listCRDs,
  listPriorityClasses,
  listRuntimeClasses,
  listMutatingWebhooks,
  listValidatingWebhooks,
  listHelmReleases,
  listFluxKustomizations,
} from "../../../tauri/commands";
import type {
  CRDInfo,
  PriorityClassInfo,
  RuntimeClassInfo,
  MutatingWebhookInfo,
  ValidatingWebhookInfo,
  HelmReleaseInfo,
  FluxKustomizationInfo,
} from "../../../types";
import { createClusterScopedHook, createOptionalNamespaceHook } from "../factory";

/**
 * Hook for fetching CustomResourceDefinitions (cluster-scoped).
 */
export const useCRDs = createClusterScopedHook<CRDInfo>("CRDs", listCRDs);

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
