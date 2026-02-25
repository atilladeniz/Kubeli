"use client";

import type { ListOptions } from "../../types";
import { useK8sResource } from "./useK8sResource";
import { useClusterScopedResource } from "./useClusterScoped";
import { useOptionalNamespaceResource } from "./useOptionalNamespace";
import type { UseK8sResourcesOptions, UseK8sResourcesReturn, ResourceHookConfig } from "./types";

/**
 * Factory function to create a namespaced resource hook.
 * Reduces boilerplate by generating hooks from configuration.
 *
 * @example
 * export const usePods = createNamespacedHook({
 *   displayName: "Pods",
 *   listFn: listPods,
 *   supportsWatch: true,
 * });
 */
export function createNamespacedHook<T>(
  config: ResourceHookConfig<T>
): (options?: UseK8sResourcesOptions) => UseK8sResourcesReturn<T> {
  return function useResource(options: UseK8sResourcesOptions = {}) {
    return useK8sResource(config, options);
  };
}

/**
 * Factory function to create a cluster-scoped resource hook.
 * For resources that are not namespaced (Nodes, Namespaces, ClusterRoles, etc.)
 *
 * @example
 * export const useNodes = createClusterScopedHook("Nodes", listNodes);
 */
export function createClusterScopedHook<T>(
  displayName: string,
  listFn: () => Promise<T[]>
): (options?: UseK8sResourcesOptions) => UseK8sResourcesReturn<T> {
  return function useResource(options: UseK8sResourcesOptions = {}) {
    return useClusterScopedResource(displayName, listFn, options);
  };
}

/**
 * Factory function for resources with optional namespace parameter.
 * Some Tauri commands accept namespace as a direct parameter instead of ListOptions.
 *
 * @example
 * export const useServiceAccounts = createOptionalNamespaceHook("Service Accounts", listServiceAccounts);
 */
export function createOptionalNamespaceHook<T>(
  displayName: string,
  listFn: (namespace?: string) => Promise<T[]>
): (options?: UseK8sResourcesOptions) => UseK8sResourcesReturn<T> {
  return function useResource(options: UseK8sResourcesOptions = {}) {
    return useOptionalNamespaceResource(displayName, listFn, options);
  };
}

/**
 * Factory function for namespaced resources using ListOptions.
 * Simplified version of createNamespacedHook for common cases.
 *
 * @example
 * export const useDeployments = createListOptionsHook("Deployments", listDeployments);
 */
export function createListOptionsHook<T>(
  displayName: string,
  listFn: (options?: ListOptions) => Promise<T[]>,
  defaultConfig?: Partial<Omit<ResourceHookConfig<T>, "displayName" | "listFn">>
): (options?: UseK8sResourcesOptions) => UseK8sResourcesReturn<T> {
  return createNamespacedHook({
    displayName,
    listFn,
    ...defaultConfig,
  });
}
