import type { PortForwardInfo } from "@/lib/types";

/**
 * Pick the forwards to restart after an OIDC token refresh.
 *
 * Restart goes through `startForward`, which rebinds to the *active* cluster's
 * client. Since forwards now survive a cluster switch, restarting one owned by
 * another cluster would repoint it at the active cluster - silently, if that
 * cluster has a service with the same namespace/name, or as a failed restart
 * otherwise. So scope the restart to the cluster that actually refreshed.
 */
export function forwardsToRestartAfterRefresh(
  forwards: PortForwardInfo[],
  refreshedContext: string
): PortForwardInfo[] {
  return forwards.filter(
    (f) => f.status === "connected" && f.cluster_context === refreshedContext
  );
}
