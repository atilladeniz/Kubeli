import type { Cluster, ConnectionStatus, HealthCheckResult } from "../types";

const mockClusters: Cluster[] = [
  {
    id: "kubeli-mock",
    name: "kubeli-mock",
    context: "kubeli-mock",
    server: "https://127.0.0.1:6443",
    namespace: "default",
    user: "mock-user",
    auth_type: "token",
    current: true,
    source_file: null,
  },
  {
    id: "kubeli-eks",
    name: "kubeli-eks-demo",
    context: "arn:aws:eks:us-west-2:123456789012:cluster/kubeli-eks-demo",
    server: "https://ABC.gr7.us-west-2.eks.amazonaws.com",
    namespace: "kubeli-demo",
    user: "mock-user",
    auth_type: "exec",
    current: false,
    source_file: null,
  },
];

const mockConnectionStatus: ConnectionStatus = {
  connected: false,
  context: null,
  error: null,
  latency_ms: null,
};

const mockHealth: HealthCheckResult = {
  healthy: true,
  latency_ms: 12,
  error: null,
};

const mockNamespaces = ["default", "kubeli-demo"];

const mockKubeconfigSourcesConfig = {
  sources: [{ path: "~/.kube/config", source_type: "file" as const }],
  merge_mode: false,
};

const mockKubeconfigSourceInfos = [
  {
    path: "~/.kube/config",
    source_type: "file" as const,
    file_count: 1,
    context_count: 1,
    valid: true,
    error: null,
    is_default: true,
  },
];

export function mockInvoke(command: string, payload?: Record<string, unknown>) {
  switch (command) {
    case "list_clusters":
      return Promise.resolve(mockClusters);
    case "get_connection_status":
      return Promise.resolve(mockConnectionStatus);
    case "connect_cluster":
      return Promise.resolve({
        connected: true,
        context: (payload?.context as string) ?? "kubeli-mock",
        error: null,
        latency_ms: 12,
      } satisfies ConnectionStatus);
    case "check_connection_health":
      return Promise.resolve(mockHealth);
    case "get_namespaces":
      return Promise.resolve(mockNamespaces);
    case "get_kubeconfig_sources":
      return Promise.resolve(mockKubeconfigSourcesConfig);
    case "list_kubeconfig_sources":
      return Promise.resolve(mockKubeconfigSourceInfos);
    case "add_kubeconfig_source":
    case "remove_kubeconfig_source":
    case "set_kubeconfig_sources":
    case "set_kubeconfig_merge_mode":
      return Promise.resolve(mockKubeconfigSourcesConfig);
    case "validate_kubeconfig_path":
      return Promise.resolve(mockKubeconfigSourceInfos[0]);
    default:
      return Promise.reject(new Error(`Mock not implemented for command: ${command}`));
  }
}
