import type { Cluster, ClusterSettings, ConnectionStatus, HealthCheckResult, NamespaceResult } from "../../types";

import { invoke } from "./core";

// Cluster commands
export async function listClusters(): Promise<Cluster[]> {
  return invoke<Cluster[]>("list_clusters");
}

export async function connectCluster(context: string): Promise<ConnectionStatus> {
  return invoke<ConnectionStatus>("connect_cluster", { context });
}

export async function disconnectCluster(): Promise<void> {
  return invoke("disconnect_cluster");
}

export async function switchContext(context: string): Promise<ConnectionStatus> {
  return invoke<ConnectionStatus>("switch_context", { context });
}

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  return invoke<ConnectionStatus>("get_connection_status");
}

export async function checkConnectionHealth(): Promise<HealthCheckResult> {
  return invoke<HealthCheckResult>("check_connection_health");
}

export async function getNamespaces(): Promise<NamespaceResult> {
  return invoke<NamespaceResult>("get_namespaces");
}

// Cluster settings commands
export async function getClusterSettings(context: string): Promise<ClusterSettings | null> {
  return invoke<ClusterSettings | null>("get_cluster_settings", { context });
}

export async function setClusterAccessibleNamespaces(
  context: string,
  namespaces: string[]
): Promise<void> {
  return invoke("set_cluster_accessible_namespaces", { context, namespaces });
}

export async function clearClusterSettings(context: string): Promise<void> {
  return invoke("clear_cluster_settings", { context });
}

export async function addCluster(kubeconfigContent: string): Promise<void> {
  return invoke("add_cluster", { kubeconfigContent });
}

export async function removeCluster(context: string): Promise<void> {
  return invoke("remove_cluster", { context });
}

export async function hasKubeconfig(): Promise<boolean> {
  return invoke<boolean>("has_kubeconfig");
}

// Kubeconfig source commands
export type KubeconfigSourceType = "file" | "folder";

export interface KubeconfigSource {
  path: string;
  source_type: KubeconfigSourceType;
}

export interface KubeconfigSourcesConfig {
  sources: KubeconfigSource[];
  merge_mode: boolean;
}

export interface KubeconfigSourceInfo {
  path: string;
  source_type: KubeconfigSourceType;
  file_count: number;
  context_count: number;
  valid: boolean;
  error: string | null;
  is_default: boolean;
}

export async function getKubeconfigSources(): Promise<KubeconfigSourcesConfig> {
  return invoke<KubeconfigSourcesConfig>("get_kubeconfig_sources");
}

export async function setKubeconfigSources(
  config: KubeconfigSourcesConfig
): Promise<void> {
  return invoke("set_kubeconfig_sources", { config });
}

export async function addKubeconfigSource(
  path: string,
  sourceType: KubeconfigSourceType
): Promise<KubeconfigSourcesConfig> {
  return invoke<KubeconfigSourcesConfig>("add_kubeconfig_source", {
    path,
    sourceType,
  });
}

export async function removeKubeconfigSource(
  path: string
): Promise<KubeconfigSourcesConfig> {
  return invoke<KubeconfigSourcesConfig>("remove_kubeconfig_source", { path });
}

export async function listKubeconfigSources(): Promise<KubeconfigSourceInfo[]> {
  return invoke<KubeconfigSourceInfo[]>("list_kubeconfig_sources");
}

export async function validateKubeconfigPath(
  path: string
): Promise<KubeconfigSourceInfo> {
  return invoke<KubeconfigSourceInfo>("validate_kubeconfig_path", { path });
}

export async function setKubeconfigMergeMode(
  enabled: boolean
): Promise<KubeconfigSourcesConfig> {
  return invoke<KubeconfigSourcesConfig>("set_kubeconfig_merge_mode", { enabled });
}

// Debug commands
export async function generateDebugLog(
  failedContext?: string,
  errorMessage?: string
): Promise<string> {
  return invoke<string>("generate_debug_log", {
    failed_context: failedContext ?? null,
    error_message: errorMessage ?? null,
  });
}
