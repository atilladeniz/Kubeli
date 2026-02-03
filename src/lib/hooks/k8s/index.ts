/**
 * Kubernetes Resource Hooks
 *
 * This module provides React hooks for fetching and managing Kubernetes resources.
 * All hooks follow a consistent interface (UseK8sResourcesReturn) and support:
 * - Auto-refresh with configurable intervals
 * - Namespace filtering
 * - Loading/error states
 * - Manual refresh
 *
 * @example
 * import { usePods, useDeployments } from "@/lib/hooks/k8s";
 *
 * function MyComponent() {
 *   const { data: pods, isLoading, refresh } = usePods({ autoRefresh: true });
 *   const { data: deployments } = useDeployments({ namespace: "default" });
 * }
 */

// Types
export type { UseK8sResourcesOptions, UseK8sResourcesReturn, ResourceHookConfig } from "./types";

// Factory functions (for creating custom hooks)
export { createNamespacedHook, createClusterScopedHook, createOptionalNamespaceHook, createListOptionsHook } from "./factory";

// Core hook (for advanced use cases)
export { useK8sResource, useClusterScopedResource, useOptionalNamespaceResource } from "./useK8sResource";

// All resource hooks
export * from "./resources";
