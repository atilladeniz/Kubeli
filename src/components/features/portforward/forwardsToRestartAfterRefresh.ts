import type { PortForwardInfo } from "@/lib/types";

/**
 * Pick the forwards to restart after an OIDC token refresh.
 *
 * Only the refreshed cluster's forwards need a restart; the others hold tokens
 * that did not change. The restart itself pins each forward's cluster, so a
 * switch landing mid-restart fails it rather than repointing it - this filter
 * keeps us from attempting those doomed restarts in the first place.
 */
export function forwardsToRestartAfterRefresh(
  forwards: PortForwardInfo[],
  refreshedContext: string
): PortForwardInfo[] {
  return forwards.filter(
    (f) => f.status === "connected" && f.cluster_context === refreshedContext
  );
}
