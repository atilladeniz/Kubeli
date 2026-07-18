import { mergePortForwardRows } from "../mergePortForwardRows";
import type { PortForwardInfo, PortForwardHistoryItem } from "@/lib/types";

function makeForward(overrides: Partial<PortForwardInfo> = {}): PortForwardInfo {
  return {
    forward_id: "fwd-1",
    cluster_context: "prod-eu",
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
  it("tags a live forward with its own cluster_context", () => {
    const forwards = [makeForward({ cluster_context: "prod-eu" })];
    const rows = mergePortForwardRows(forwards, []);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "active", cluster: "prod-eu" });
  });

  it("keeps forwards from multiple clusters when unfiltered", () => {
    const forwards = [
      makeForward({ forward_id: "a", cluster_context: "prod-eu" }),
      makeForward({ forward_id: "b", name: "redis", cluster_context: "staging" }),
    ];
    const clusters = mergePortForwardRows(forwards, []).map((r) => r.cluster);
    expect(clusters).toEqual(["prod-eu", "staging"]);
  });

  it("scopes to a single cluster by the forward's own cluster_context", () => {
    const forwards = [
      makeForward({ forward_id: "a", cluster_context: "prod-eu" }),
      makeForward({ forward_id: "b", cluster_context: "staging" }),
    ];
    const rows = mergePortForwardRows(forwards, [], "prod-eu");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "active", cluster: "prod-eu" });
  });

  // Regression (#388): a live forward that survived a cluster switch has no
  // history entry, but must still be tagged and scoped by its own context —
  // never dropped, never shown in the wrong cluster's view.
  it("shows and correctly tags a live forward with no history entry", () => {
    const forwards = [makeForward({ forward_id: "no-hist", cluster_context: "staging" })];
    const inOwner = mergePortForwardRows(forwards, [], "staging");
    expect(inOwner).toEqual([
      expect.objectContaining({ kind: "active", cluster: "staging" }),
    ]);
    const inOther = mergePortForwardRows(forwards, [], "prod-eu");
    expect(inOther).toEqual([]);
    const unfiltered = mergePortForwardRows(forwards, []);
    expect(unfiltered).toEqual([
      expect.objectContaining({ kind: "active", cluster: "staging" }),
    ]);
  });

  it("shows stopped history entries but skips still-active orphan history", () => {
    const history = [
      makeHistory({ id: "stopped", forward_id: "gone", status: "inactive" }),
      makeHistory({ id: "orphan", forward_id: "alsogone", status: "active" }),
    ];
    const rows = mergePortForwardRows([], history);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "history" });
  });

  it("hides a stopped history entry when its forward is live again", () => {
    const forwards = [makeForward({ forward_id: "back", cluster_context: "c" })];
    const history = [makeHistory({ id: "old", forward_id: "back", status: "inactive" })];
    const rows = mergePortForwardRows(forwards, history);
    expect(rows).toEqual([expect.objectContaining({ kind: "active" })]);
  });

  it("scopes stopped history entries by their own cluster_context", () => {
    const history = [
      makeHistory({ id: "eu", forward_id: "x", cluster_context: "prod-eu", status: "inactive" }),
      makeHistory({ id: "st", forward_id: "y", cluster_context: "staging", status: "inactive" }),
    ];
    const rows = mergePortForwardRows([], history, "prod-eu");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "history", cluster: "prod-eu" });
  });

  it("orders merged rows by start time, oldest first", () => {
    const forwards = [makeForward({ forward_id: "new" }), makeForward({ forward_id: "old" })];
    const history = [
      makeHistory({ id: "h-new", forward_id: "new", cluster_context: "prod-eu", started_at: 200 }),
      makeHistory({ id: "h-old", forward_id: "old", cluster_context: "prod-eu", started_at: 100 }),
    ];
    const ids = mergePortForwardRows(forwards, history).map((r) =>
      r.kind === "active" ? r.forward.forward_id : r.item.forward_id,
    );
    expect(ids).toEqual(["old", "new"]);
  });
});
