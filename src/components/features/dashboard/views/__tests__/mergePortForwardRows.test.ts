import { mergePortForwardRows } from "../mergePortForwardRows";
import type { PortForwardInfo, PortForwardHistoryItem } from "@/lib/types";

function makeForward(overrides: Partial<PortForwardInfo> = {}): PortForwardInfo {
  return {
    forward_id: "fwd-1",
    namespace: "default",
    name: "postgres",
    target_type: "service",
    target_port: 5432,
    local_port: 5432,
    status: "connected",
    ...overrides,
  };
}

function makeHistory(overrides: Partial<PortForwardHistoryItem> = {}): PortForwardHistoryItem {
  return {
    id: "hist-1",
    signature: "sig",
    cluster_context: "prod-eu",
    forward_id: "fwd-1",
    namespace: "default",
    name: "postgres",
    target_type: "service",
    target_port: 5432,
    local_port: 5432,
    status: "active",
    started_at: 1000,
    updated_at: 1000,
    ...overrides,
  };
}

describe("mergePortForwardRows", () => {
  it("tags a live forward with the cluster from its history entry", () => {
    const forwards = [makeForward()];
    const history = [makeHistory({ cluster_context: "prod-eu" })];
    const rows = mergePortForwardRows(forwards, history);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "active", cluster: "prod-eu" });
  });

  it("keeps forwards from multiple clusters when unfiltered", () => {
    const forwards = [
      makeForward({ forward_id: "a" }),
      makeForward({ forward_id: "b", name: "redis" }),
    ];
    const history = [
      makeHistory({ id: "h-a", forward_id: "a", cluster_context: "prod-eu", started_at: 1 }),
      makeHistory({ id: "h-b", forward_id: "b", cluster_context: "staging", started_at: 2 }),
    ];
    const clusters = mergePortForwardRows(forwards, history).map((r) => r.cluster);
    expect(clusters).toEqual(["prod-eu", "staging"]);
  });

  it("scopes to a single cluster when contextFilter is given", () => {
    const forwards = [
      makeForward({ forward_id: "a" }),
      makeForward({ forward_id: "b" }),
    ];
    const history = [
      makeHistory({ id: "h-a", forward_id: "a", cluster_context: "prod-eu" }),
      makeHistory({ id: "h-b", forward_id: "b", cluster_context: "staging" }),
    ];
    const rows = mergePortForwardRows(forwards, history, "prod-eu");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "active", cluster: "prod-eu" });
  });

  it("shows stopped history entries but skips orphaned active ones", () => {
    const history = [
      makeHistory({ id: "stopped", forward_id: "gone", status: "inactive" }),
      makeHistory({ id: "orphan", forward_id: "alsogone", status: "active" }),
    ];
    const rows = mergePortForwardRows([], history);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "history" });
  });

  it("emits a live row with empty cluster for a forward without history", () => {
    const rows = mergePortForwardRows([makeForward({ forward_id: "no-hist" })], []);
    expect(rows).toEqual([
      expect.objectContaining({ kind: "active", cluster: "" }),
    ]);
  });

  it("orders merged rows by start time, oldest first", () => {
    const forwards = [makeForward({ forward_id: "new" }), makeForward({ forward_id: "old" })];
    const history = [
      makeHistory({ id: "h-new", forward_id: "new", cluster_context: "c", started_at: 200 }),
      makeHistory({ id: "h-old", forward_id: "old", cluster_context: "c", started_at: 100 }),
    ];
    const ids = mergePortForwardRows(forwards, history).map((r) =>
      r.kind === "active" ? r.forward.forward_id : r.item.forward_id,
    );
    expect(ids).toEqual(["old", "new"]);
  });
});
