import type { PortForwardInfo, PortForwardHistoryItem } from "@/lib/types";

/** A merged row: either a live forward or a stopped history entry, tagged with its cluster. */
export type PortForwardRow =
  | { kind: "active"; forward: PortForwardInfo; cluster: string }
  | { kind: "history"; item: PortForwardHistoryItem; cluster: string };

/**
 * Merge live forwards with stopped/error history into a single ordered row list
 * (oldest first). Live forwards carry no cluster context of their own, so they
 * are joined to their history entry by forward_id to recover the cluster tag.
 *
 * Pass a `contextFilter` to scope to one cluster; omit it for the all-clusters view.
 */
export function mergePortForwardRows(
  forwards: PortForwardInfo[],
  history: PortForwardHistoryItem[],
  contextFilter?: string,
): PortForwardRow[] {
  const forwardMap = new Map(forwards.map((f) => [f.forward_id, f]));
  const scopedHistory =
    contextFilter === undefined
      ? history
      : history.filter((h) => h.cluster_context === contextFilter);
  // Any forward that has history (in ANY cluster) is placed by the history pass;
  // only forwards with no history at all fall through to the orphan pass.
  const knownForwardIds = new Set(history.map((h) => h.forward_id));

  const historyRows = [...scopedHistory]
    .sort((a, b) => a.started_at - b.started_at)
    .flatMap((item): PortForwardRow[] => {
      const live = forwardMap.get(item.forward_id);
      if (live) return [{ kind: "active", forward: live, cluster: item.cluster_context }];
      if (item.status !== "active") return [{ kind: "history", item, cluster: item.cluster_context }];
      return []; // orphaned active history entry — skip
    });

  // Live forwards with no history entry at all — cluster unknown. These appear
  // in every view (scoped or not); a forward whose history belongs to another
  // cluster is intentionally excluded from a scoped view.
  const orphanRows: PortForwardRow[] = forwards
    .filter((f) => !knownForwardIds.has(f.forward_id))
    .map((forward) => ({ kind: "active", forward, cluster: "" }));

  return [...historyRows, ...orphanRows];
}
