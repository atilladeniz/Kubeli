import type {
  Cluster,
  ConnectionStatus,
  HealthCheckResult,
  PodInfo,
  PodMetrics,
  NodeMetrics,
  ClusterMetricsSummary,
} from "../types";

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

/** Return base ± pct random jitter so sparklines animate in mock mode */
function jitter(base: number, pct = 0.1): number {
  return Math.round(base * (1 + (Math.random() - 0.5) * 2 * pct));
}

interface MockPodDef {
  name: string;
  cpuNano: number;
  memBytes: number;
  cpuRequest: string;
  cpuLimit: string;
  memRequest: string;
  memLimit: string;
}

const mockPodDefs: MockPodDef[] = [
  { name: "demo-web-6d4f7b8c9-x2k4m", cpuNano: 125_000_000, memBytes: 268_435_456, cpuRequest: "500m", cpuLimit: "1", memRequest: "512Mi", memLimit: "1Gi" },
  { name: "demo-api-5c8e9f1a2-r7j3n", cpuNano: 80_000_000, memBytes: 188_743_680, cpuRequest: "250m", cpuLimit: "500m", memRequest: "256Mi", memLimit: "512Mi" },
  { name: "demo-frontend-7a3b2c1d0-q9w8e", cpuNano: 15_000_000, memBytes: 94_371_840, cpuRequest: "100m", cpuLimit: "200m", memRequest: "128Mi", memLimit: "256Mi" },
  { name: "demo-auth-4e5f6a7b8-p1l2k", cpuNano: 45_000_000, memBytes: 125_829_120, cpuRequest: "200m", cpuLimit: "500m", memRequest: "256Mi", memLimit: "512Mi" },
  { name: "demo-db-0", cpuNano: 200_000_000, memBytes: 419_430_400, cpuRequest: "500m", cpuLimit: "2", memRequest: "512Mi", memLimit: "2Gi" },
  { name: "demo-log-collector-8b9c0d1e2-h5g6f", cpuNano: 10_000_000, memBytes: 52_428_800, cpuRequest: "50m", cpuLimit: "100m", memRequest: "64Mi", memLimit: "128Mi" },
  { name: "demo-stress-test-3f2a1b0c9-z8y7x", cpuNano: 250_000_000, memBytes: 314_572_800, cpuRequest: "500m", cpuLimit: "1", memRequest: "512Mi", memLimit: "1Gi" },
];

function buildMockPodMetrics(): PodMetrics[] {
  const ts = new Date().toISOString();
  return mockPodDefs.map((d) => {
    const isStress = d.name.includes("stress-test");
    const cpu = jitter(d.cpuNano, isStress ? 0.4 : 0.1);
    const mem = jitter(d.memBytes, isStress ? 0.3 : 0.1);
    return {
      name: d.name,
      namespace: "kubeli-demo",
      timestamp: ts,
      containers: [
        {
          name: d.name.replace(/-[a-z0-9]+-[a-z0-9]+$/, "").replace(/-\d+$/, ""),
          cpu: { usage: `${Math.round(cpu / 1_000_000)}m`, usage_nano_cores: cpu, request: d.cpuRequest, limit: d.cpuLimit },
          memory: { usage: `${Math.round(mem / (1024 ** 2))}Mi`, usage_bytes: mem, request: d.memRequest, limit: d.memLimit },
        },
      ],
      total_cpu: `${Math.round(cpu / 1_000_000)}m`,
      total_cpu_nano_cores: cpu,
      total_memory: `${Math.round(mem / (1024 ** 2))}Mi`,
      total_memory_bytes: mem,
    };
  });
}

function buildMockNodeMetrics(): NodeMetrics[] {
  return [
    {
      name: "minikube",
      timestamp: new Date().toISOString(),
      cpu: { usage: `${jitter(475)}m`, usage_nano_cores: jitter(475_000_000), allocatable: "4", percentage: jitter(12) },
      memory: { usage: `${jitter(2048)}Mi`, usage_bytes: jitter(2_147_483_648), allocatable: "8Gi", percentage: jitter(25) },
    },
  ];
}

function buildMockClusterMetricsSummary(): ClusterMetricsSummary {
  const pods = buildMockPodMetrics();
  const totalCpuMilli = pods.reduce((s, p) => s + p.total_cpu_nano_cores / 1_000_000, 0);
  const totalMemBytes = pods.reduce((s, p) => s + p.total_memory_bytes, 0);
  return {
    timestamp: new Date().toISOString(),
    nodes: { total: 1, ready: 1 },
    cpu: {
      capacity: "4", capacity_milli: 4000,
      allocatable: "3800m", allocatable_milli: 3800,
      usage: `${Math.round(totalCpuMilli)}m`, usage_milli: Math.round(totalCpuMilli),
      percentage: Math.round((totalCpuMilli / 3800) * 100),
    },
    memory: {
      capacity: "8Gi", capacity_bytes: 8_589_934_592,
      allocatable: "7Gi", allocatable_bytes: 7_516_192_768,
      usage: `${Math.round(totalMemBytes / (1024 ** 2))}Mi`, usage_bytes: Math.round(totalMemBytes),
      percentage: Math.round((totalMemBytes / 7_516_192_768) * 100),
    },
    top_cpu_pods: [...pods].sort((a, b) => b.total_cpu_nano_cores - a.total_cpu_nano_cores).slice(0, 5),
    top_memory_pods: [...pods].sort((a, b) => b.total_memory_bytes - a.total_memory_bytes).slice(0, 5),
    metrics_available: true,
  };
}

const mockPods: PodInfo[] = mockPodDefs.map((d) => ({
  name: d.name,
  namespace: "kubeli-demo",
  uid: crypto.randomUUID?.() ?? `mock-uid-${d.name}`,
  phase: "Running",
  node_name: "minikube",
  pod_ip: `10.244.0.${Math.floor(Math.random() * 250) + 2}`,
  host_ip: "192.168.49.2",
  init_containers: [],
  containers: [
    {
      name: d.name.replace(/-[a-z0-9]+-[a-z0-9]+$/, "").replace(/-\d+$/, ""),
      image: `kubeli/${d.name.replace(/-[a-z0-9]+-[a-z0-9]+$/, "").replace(/-\d+$/, "")}:latest`,
      ready: true,
      restart_count: 0,
      state: "Running",
      state_reason: null,
      last_state: null,
      last_state_reason: null,
      last_exit_code: null,
      last_finished_at: null,
    },
  ],
  created_at: new Date(Date.now() - 86_400_000).toISOString(),
  deletion_timestamp: null,
  labels: { app: d.name.replace(/-[a-z0-9]+-[a-z0-9]+$/, "").replace(/-\d+$/, "") },
  restart_count: 0,
  ready_containers: "1/1",
}));

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
    case "list_pods":
      return Promise.resolve(mockPods);
    case "check_metrics_server":
      return Promise.resolve(true);
    case "get_pod_metrics":
      return Promise.resolve(buildMockPodMetrics());
    case "get_node_metrics":
      return Promise.resolve(buildMockNodeMetrics());
    case "get_cluster_metrics_summary":
      return Promise.resolve(buildMockClusterMetricsSummary());
    default:
      return Promise.reject(new Error(`Mock not implemented for command: ${command}`));
  }
}
