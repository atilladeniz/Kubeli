import { forwardsToRestartAfterRefresh } from "../forwardsToRestartAfterRefresh";
import type { PortForwardInfo } from "@/lib/types";

function makeForward(overrides: Partial<PortForwardInfo> = {}): PortForwardInfo {
  return {
    forward_id: "test-id",
    cluster_context: "cluster-a",
    namespace: "default",
    name: "api",
    target_type: "service",
    target_port: 80,
    local_port: 31000,
    status: "connected",
    ...overrides,
  };
}

describe("forwardsToRestartAfterRefresh", () => {
  it("restarts only forwards owned by the refreshed cluster", () => {
    const forwards = [
      makeForward({ forward_id: "a", cluster_context: "cluster-a" }),
      makeForward({ forward_id: "b", cluster_context: "cluster-b" }),
    ];
    expect(forwardsToRestartAfterRefresh(forwards, "cluster-a").map((f) => f.forward_id)).toEqual([
      "a",
    ]);
  });

  // Regression: a refresh on one cluster must not rebuild another cluster's
  // forward that shares the same namespace/name. Without the cluster_context
  // filter that forward would silently restart against the refreshed cluster's
  // same-named service.
  it("leaves a same-namespace/name forward in another cluster untouched", () => {
    const forwards = [
      makeForward({ forward_id: "a", cluster_context: "cluster-a" }),
      makeForward({ forward_id: "b", cluster_context: "cluster-b" }),
    ];
    expect(forwardsToRestartAfterRefresh(forwards, "cluster-b").map((f) => f.forward_id)).toEqual([
      "b",
    ]);
  });

  it("skips forwards that are not connected", () => {
    const forwards = [
      makeForward({ forward_id: "a", status: "reconnecting" }),
      makeForward({ forward_id: "b", status: "connected" }),
    ];
    expect(forwardsToRestartAfterRefresh(forwards, "cluster-a").map((f) => f.forward_id)).toEqual([
      "b",
    ]);
  });
});
