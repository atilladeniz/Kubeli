import { forwardsToRestartAfterRefresh } from "../forwardsToRestartAfterRefresh";
import type { PortForwardInfo } from "@/lib/types";

function fwd(overrides: Partial<PortForwardInfo>): PortForwardInfo {
  return {
    forward_id: "id",
    cluster_context: "cluster-a",
    namespace: "default",
    name: "api",
    target_type: "service",
    target_port: 80,
    local_port: 8080,
    status: "connected",
    ...overrides,
  };
}

describe("forwardsToRestartAfterRefresh", () => {
  it("restarts only forwards owned by the refreshed cluster", () => {
    const forwards = [
      fwd({ forward_id: "a", cluster_context: "cluster-a" }),
      fwd({ forward_id: "b", cluster_context: "cluster-b" }),
    ];

    const result = forwardsToRestartAfterRefresh(forwards, "cluster-a");

    expect(result.map((f) => f.forward_id)).toEqual(["a"]);
  });

  // Regression: a refresh on one cluster must not rebuild another cluster's
  // forward that shares the same namespace/name. Without the cluster_context
  // filter that forward would silently restart against the refreshed cluster's
  // same-named service.
  it("leaves a same-namespace/name forward in another cluster untouched", () => {
    const forwards = [
      fwd({ forward_id: "a", cluster_context: "cluster-a", namespace: "default", name: "api" }),
      fwd({ forward_id: "b", cluster_context: "cluster-b", namespace: "default", name: "api" }),
    ];

    const result = forwardsToRestartAfterRefresh(forwards, "cluster-b");

    expect(result.map((f) => f.forward_id)).toEqual(["b"]);
  });

  it("skips forwards that are not connected", () => {
    const forwards = [
      fwd({ forward_id: "a", cluster_context: "cluster-a", status: "reconnecting" }),
      fwd({ forward_id: "b", cluster_context: "cluster-a", status: "connected" }),
    ];

    const result = forwardsToRestartAfterRefresh(forwards, "cluster-a");

    expect(result.map((f) => f.forward_id)).toEqual(["b"]);
  });

  it("returns nothing when no forward belongs to the refreshed cluster", () => {
    const forwards = [fwd({ forward_id: "a", cluster_context: "cluster-a" })];

    expect(forwardsToRestartAfterRefresh(forwards, "cluster-b")).toEqual([]);
  });
});
