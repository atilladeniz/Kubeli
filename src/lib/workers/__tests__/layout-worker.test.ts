import { calculateLayout } from "../layout-worker";
import type { GraphNode } from "../../types";

const node = (
  id: string,
  node_type: string,
  parent_id: string | null,
  is_group = false
): GraphNode =>
  ({
    id,
    name: id,
    node_type,
    parent_id,
    is_group,
    status: "healthy",
  }) as GraphNode;

describe("calculateLayout", () => {
  it("returns empty maps for empty input", async () => {
    const { positions, sizes } = await calculateLayout([], []);
    expect(positions.size).toBe(0);
    expect(sizes.size).toBe(0);
  });

  it("positions namespaces, deployments, pods and orphan pods", async () => {
    const nodes = [
      node("ns-1", "namespace", null, true),
      node("ns-2", "namespace", null, true),
      node("deploy-1", "deployment", "ns-1", true),
      node("pod-1", "pod", "deploy-1"),
      node("pod-2", "pod", "deploy-1"),
      // Orphan pod: parent is the namespace, not a deployment
      node("pod-orphan", "pod", "ns-1"),
    ];

    const { positions, sizes } = await calculateLayout(nodes, []);

    for (const id of ["ns-1", "ns-2", "deploy-1", "pod-1", "pod-2", "pod-orphan"]) {
      expect(positions.has(id)).toBe(true);
    }

    // Group sizes calculated for namespaces and the deployment
    expect(sizes.get("deploy-1")!.width).toBeGreaterThanOrEqual(200);
    expect(sizes.get("ns-1")!.width).toBeGreaterThanOrEqual(300);
    expect(sizes.get("ns-2")).toEqual({ width: 250, height: 100 });

    // Namespaces laid out side by side without overlap
    const ns1 = positions.get("ns-1")!;
    const ns2 = positions.get("ns-2")!;
    expect(Math.abs(ns2.x - ns1.x)).toBeGreaterThanOrEqual(sizes.get("ns-1")!.width);

    // Pods positioned inside the deployment (relative, inside padding)
    const pod1 = positions.get("pod-1")!;
    const pod2 = positions.get("pod-2")!;
    expect(pod1.x).toBeGreaterThanOrEqual(20);
    expect(pod1.y).toBeGreaterThanOrEqual(50);
    expect(pod1).not.toEqual(pod2);
  });
});
