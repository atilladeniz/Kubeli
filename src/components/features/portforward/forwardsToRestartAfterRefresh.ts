import type { PortForwardInfo } from "@/lib/types";

/**
 * Pick the forwards to restart after an OIDC token refresh.
 *
 * Restart goes through `startForward`, which rebinds to the *active* cluster's
 * client and re-tags the forward with the active context. So only the refreshed
 * cluster's own connected forwards may be restarted. Restarting a forward that
 * belongs to another cluster would repoint it at the active cluster — silently,
 * if that cluster has a service with the same namespace/name, or as a failed
 * restart otherwise. Since forwards now survive across clusters, scope the
 * restart to the cluster that actually refreshed.
 */
export function forwardsToRestartAfterRefresh(
  forwards: PortForwardInfo[],
  refreshedContext: string,
): PortForwardInfo[] {
  return forwards.filter(
    (f) => f.status === "connected" && f.cluster_context === refreshedContext,
  );
}
