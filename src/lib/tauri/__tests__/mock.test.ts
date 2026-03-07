import { mockInvoke } from "../mock";

describe("mockInvoke", () => {
  it("returns mock cluster and connection data", async () => {
    const clusters = (await mockInvoke("list_clusters")) as Array<Record<string, unknown>>;
    const status = (await mockInvoke("connect_cluster", {
      context: "demo",
    })) as Record<string, unknown>;
    const namespaces = (await mockInvoke("get_namespaces")) as {
      namespaces: string[];
      source: string;
    };

    expect(clusters).toHaveLength(2);
    expect(clusters[0]).toMatchObject({ current: true, context: "kubeli-mock" });
    expect(status).toMatchObject({ connected: true, context: "demo", latency_ms: 12 });
    expect(namespaces).toEqual({ namespaces: ["default", "kubeli-demo"], source: "auto" });
  });

  it("returns mock kubeconfig, pod, and metrics data", async () => {
    const sources = (await mockInvoke("list_kubeconfig_sources")) as Array<
      Record<string, unknown>
    >;
    const pods = (await mockInvoke("list_pods")) as Array<Record<string, unknown>>;
    const podMetrics = (await mockInvoke("get_pod_metrics")) as Array<
      Record<string, unknown>
    >;
    const nodeMetrics = (await mockInvoke("get_node_metrics")) as Array<
      Record<string, unknown>
    >;
    const summary = (await mockInvoke("get_cluster_metrics_summary")) as {
      nodes: { total: number; ready: number };
      metrics_available: boolean;
      top_cpu_pods: unknown[];
      top_memory_pods: unknown[];
    };

    expect(sources[0]).toMatchObject({ valid: true, is_default: true });
    expect(pods.length).toBeGreaterThan(0);
    expect(pods[0]).toMatchObject({ namespace: "kubeli-demo", phase: "Running" });
    expect(podMetrics[0]).toHaveProperty("total_cpu_nano_cores");
    expect(nodeMetrics[0]).toMatchObject({ name: "minikube" });
    expect(summary).toMatchObject({
      nodes: { total: 1, ready: 1 },
      metrics_available: true,
    });
    expect(summary.top_cpu_pods).toHaveLength(5);
    expect(summary.top_memory_pods).toHaveLength(5);
  });

  it("rejects unsupported commands", async () => {
    await expect(mockInvoke("unknown_command")).rejects.toThrow(
      "Mock not implemented for command: unknown_command"
    );
  });
});
