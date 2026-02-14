import type { ClusterMetricsSummary, NodeMetrics, PodMetrics } from "../../types";

import { invoke } from "./core";

// Metrics commands
export async function getNodeMetrics(nodeName?: string): Promise<NodeMetrics[]> {
  return invoke<NodeMetrics[]>("get_node_metrics", { nodeName });
}

export async function getPodMetrics(
  namespace?: string,
  podName?: string
): Promise<PodMetrics[]> {
  return invoke<PodMetrics[]>("get_pod_metrics", { namespace, podName });
}

/** Get pod metrics directly from kubelet /stats/summary (faster, ~10s updates) */
export async function getPodMetricsDirect(namespace?: string): Promise<PodMetrics[]> {
  return invoke<PodMetrics[]>("get_pod_metrics_direct", { namespace });
}

export async function getClusterMetricsSummary(): Promise<ClusterMetricsSummary> {
  return invoke<ClusterMetricsSummary>("get_cluster_metrics_summary");
}

export async function checkMetricsServer(): Promise<boolean> {
  return invoke<boolean>("check_metrics_server");
}
