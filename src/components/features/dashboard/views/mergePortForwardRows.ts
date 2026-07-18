import type { PortForwardInfo, PortForwardHistoryItem } from "@/lib/types";

/** A merged row: either a live forward or a stopped history entry, tagged with its cluster. */
export type PortForwardRow =
  | { kind: "active"; forward: PortForwardInfo; cluster: string }
  | { kind: "history"; item: PortForwardHistoryItem; cluster: string };

/**
 * Merge live forwards with stopped/error history into a single ordered row list
 * (oldest first). Each live forward carries its owning `cluster_context` from
 * the backend, so no history join is needed to recover its cluster tag.
 *
 * Pass a `contextFilter` to scope to one cluster; omit it for the all-clusters view.
 */
export function mergePortForwardRows(
  forwards: PortForwardInfo[],
  history: PortForwardHistoryItem[],
  contextFilter?: string,
): PortForwardRow[] {
  const inScope = <T extends { cluster_context: string }>(x: T) =>
    contextFilter === undefined || x.cluster_context === contextFilter;

  // A live forward supersedes its own stopped history entry, so drop any
  // history whose forward is currently live. The history entry is still used
  // to recover a live forward's start time for ordering.
  const startedAtById = new Map(history.map((h) => [h.forward_id, h.started_at]));
  const liveForwardIds = new Set(forwards.map((f) => f.forward_id));

  const activeRows = forwards.filter(inScope).map((forward): PortForwardRow => ({
    kind: "active",
    forward,
    cluster: forward.cluster_context,
  }));

  const historyRows = history
    .filter((item) => item.status !== "active" && !liveForwardIds.has(item.forward_id))
    .filter(inScope)
    .map((item): PortForwardRow => ({ kind: "history", item, cluster: item.cluster_context }));

  const startedAt = (row: PortForwardRow): number =>
    row.kind === "history"
      ? row.item.started_at
      : (startedAtById.get(row.forward.forward_id) ?? Number.POSITIVE_INFINITY);

  return [...activeRows, ...historyRows].sort((a, b) => startedAt(a) - startedAt(b));
}
