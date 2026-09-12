import type { EventInfo, PodInfo } from "@/lib/types";

/** How far back "recent" reaches */
export const RECENT_WINDOW_HOURS = 6;
/** Rows shown before the "show all" toggle */
export const PANEL_LIMIT = 10;

export interface RestartEntry {
  key: string;
  name: string;
  namespace: string;
  restarts: number;
  /** Newest container termination, unix ms; null when no container reported one */
  lastRestartAt: number | null;
  /** Termination reason of the newest restart, e.g. "OOMKilled" */
  reason: string | null;
}

export interface WarningEntry {
  key: string;
  kind: string;
  name: string;
  namespace: string | null;
  reason: string;
  message: string;
  /** Summed across the events folded into this row */
  count: number;
  lastSeenAt: number | null;
}

/** Kinds that live outside a namespace, for the cluster-scoped warnings panel */
const CLUSTER_SCOPED_KINDS = new Set([
  "Node",
  "PersistentVolume",
  "StorageClass",
  "ClusterRole",
  "ClusterRoleBinding",
  "Namespace",
]);

function toMillis(timestamp: string | null | undefined): number | null {
  if (!timestamp) return null;
  const ms = new Date(timestamp).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Pods that restarted, newest restart first.
 *
 * A restart is dated by the newest container termination, which is the only
 * timestamp the pod list carries. A pod whose containers report no termination
 * time still counts (its restart_count is real), it just sorts last.
 */
export function recentRestarts(
  pods: PodInfo[],
  now: number,
  windowHours = RECENT_WINDOW_HOURS
): RestartEntry[] {
  const cutoff = now - windowHours * 3600_000;

  return pods
    .filter((pod) => pod.restart_count > 0)
    .map((pod) => {
      const containers = [...pod.init_containers, ...pod.containers];
      const newest = containers.reduce<{ at: number | null; reason: string | null }>(
        (best, container) => {
          const at = toMillis(container.last_finished_at);
          if (at === null) return best;
          return best.at === null || at > best.at
            ? { at, reason: container.last_state_reason }
            : best;
        },
        { at: null, reason: null }
      );

      return {
        key: `${pod.namespace}/${pod.name}`,
        name: pod.name,
        namespace: pod.namespace,
        restarts: pod.restart_count,
        lastRestartAt: newest.at,
        reason: newest.reason,
      };
    })
    .filter((entry) => entry.lastRestartAt === null || entry.lastRestartAt >= cutoff)
    .sort((a, b) => {
      // Undated entries sink below everything that has a timestamp
      if (a.lastRestartAt === null) return b.lastRestartAt === null ? 0 : 1;
      if (b.lastRestartAt === null) return -1;
      return b.lastRestartAt - a.lastRestartAt;
    });
}

/**
 * Warning events folded per involved object, newest first.
 *
 * The API already aggregates repeats of one reason into a single event with a
 * count, but a failing pod usually produces several reasons at once. One row
 * per object keeps the panel readable; the row shows the newest reason and the
 * summed count.
 */
export function recentWarnings(
  events: EventInfo[],
  now: number,
  options: { windowHours?: number; scope?: "all" | "cluster" } = {}
): WarningEntry[] {
  const { windowHours = RECENT_WINDOW_HOURS, scope = "all" } = options;
  const cutoff = now - windowHours * 3600_000;
  const byObject = new Map<string, WarningEntry>();

  for (const event of events) {
    if (event.event_type !== "Warning") continue;

    const involved = event.involved_object;
    if (scope === "cluster" && !CLUSTER_SCOPED_KINDS.has(involved.kind)) continue;

    const lastSeenAt = toMillis(event.last_timestamp ?? event.created_at);
    if (lastSeenAt !== null && lastSeenAt < cutoff) continue;

    const key = `${involved.kind}/${involved.namespace ?? ""}/${involved.name}`;
    const existing = byObject.get(key);

    if (!existing) {
      byObject.set(key, {
        key,
        kind: involved.kind,
        name: involved.name,
        namespace: involved.namespace,
        reason: event.reason,
        message: event.message,
        count: event.count || 1,
        lastSeenAt,
      });
      continue;
    }

    existing.count += event.count || 1;
    // Keep the newest event's reason and message as the row's summary
    const newer =
      existing.lastSeenAt === null ||
      (lastSeenAt !== null && lastSeenAt > existing.lastSeenAt);
    if (newer) {
      existing.reason = event.reason;
      existing.message = event.message;
      existing.lastSeenAt = lastSeenAt;
    }
  }

  return [...byObject.values()].sort((a, b) => {
    if (a.lastSeenAt === null) return b.lastSeenAt === null ? 0 : 1;
    if (b.lastSeenAt === null) return -1;
    return b.lastSeenAt - a.lastSeenAt;
  });
}

/** Compact age like the resource tables use: 45s, 12m, 3h, 2d */
export function formatRelativeAge(from: number | null, now: number): string {
  if (from === null) return "-";
  const seconds = Math.max(0, Math.floor((now - from) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
