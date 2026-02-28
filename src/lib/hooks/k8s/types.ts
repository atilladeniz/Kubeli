"use client";

import type { ListOptions, KubeliError } from "../../types";

/**
 * Options for K8s resource hooks
 */
export interface UseK8sResourcesOptions {
  /** Enable automatic refresh on interval */
  autoRefresh?: boolean;
  /** Refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number;
  /** Override namespace (uses current namespace from store if not set) */
  namespace?: string;
  /** Auto-start watch on mount (efficient WebSocket-based updates, pods only) */
  autoWatch?: boolean;
}

/**
 * Return type for all K8s resource hooks
 */
export interface UseK8sResourcesReturn<T> {
  /** Current data array */
  data: T[];
  /** Loading state */
  isLoading: boolean;
  /** Structured error if any */
  error: KubeliError | null;
  /** Manual refresh function */
  refresh: () => Promise<void>;
  /** Manual retry — clears error and triggers fresh fetch */
  retry: () => Promise<void>;
  /** Start watching for changes (pods only) */
  startWatch: () => Promise<void>;
  /** Stop watching for changes */
  stopWatchFn: () => Promise<void>;
  /** Whether currently watching */
  isWatching: boolean;
}

/**
 * Configuration for resource hook factory
 */
export interface ResourceHookConfig<T> {
  /** Display name for error messages */
  displayName: string;
  /** List function from tauri commands */
  listFn: ListFunction<T>;
  /** Whether resource is cluster-scoped (not namespaced) */
  clusterScoped?: boolean;
  /** Default refresh interval override */
  defaultRefreshInterval?: number;
  /** Whether this resource supports watching (requires uid field) */
  supportsWatch?: boolean;
  /** Watch function to invoke (e.g., watchPods, watchNamespaces) */
  watchFn?: (watchId: string, namespace?: string) => Promise<void>;
  /** Event channel prefix for watch events (e.g., "pods", "namespaces") */
  watchEventPrefix?: string;
  /** Post-processing function for data */
  postProcess?: (data: T[]) => T[];
}

/**
 * Base type for K8s resources that support watching (must have uid)
 */
export interface WatchableResource {
  uid?: string;
}

/**
 * List function signature for namespaced resources
 */
export type ListFunction<T> = (options?: ListOptions) => Promise<T[]>;

/**
 * List function signature for cluster-scoped resources (no options)
 */
export type ClusterScopedListFunction<T> = () => Promise<T[]>;

/**
 * List function signature for resources with optional namespace param
 */
export type OptionalNamespaceListFunction<T> = (namespace?: string) => Promise<T[]>;
