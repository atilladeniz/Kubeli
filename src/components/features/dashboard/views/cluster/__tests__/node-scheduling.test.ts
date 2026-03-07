import { getNodeSchedulingAction } from "../node-scheduling";
import type { NodeInfo } from "@/lib/types";

function createNode(overrides: Partial<NodeInfo> = {}): NodeInfo {
  return {
    name: "node-1",
    uid: "node-uid-1",
    status: "Ready",
    unschedulable: false,
    roles: ["worker"],
    version: "v1.32.0",
    os_image: "Ubuntu",
    kernel_version: "6.8.0",
    container_runtime: "containerd://2.0.0",
    cpu_capacity: "4",
    memory_capacity: "8Gi",
    pod_capacity: "110",
    created_at: "2026-03-07T00:00:00Z",
    labels: {},
    internal_ip: "10.0.0.10",
    external_ip: null,
    ...overrides,
  };
}

describe("getNodeSchedulingAction", () => {
  it("returns cordon for schedulable ready nodes", () => {
    expect(getNodeSchedulingAction(createNode())).toEqual({
      label: "Cordon",
      description: "Cordon node-1",
      disabled: false,
    });
  });

  it("returns uncordon for unschedulable nodes", () => {
    expect(
      getNodeSchedulingAction(
        createNode({
          status: "Ready,SchedulingDisabled",
          unschedulable: true,
        })
      )
    ).toEqual({
      label: "Uncordon",
      description: "Uncordon node-1",
      disabled: false,
    });
  });

  it("keeps cordon disabled for nodes that are not ready", () => {
    expect(
      getNodeSchedulingAction(
        createNode({
          status: "NotReady",
        })
      )
    ).toEqual({
      label: "Cordon",
      description: "Cordon node-1",
      disabled: true,
    });
  });
});
