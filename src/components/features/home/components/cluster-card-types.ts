import type { Cluster } from "@/lib/types";

export interface ClusterCardProps {
  cluster: Cluster;
  isActive: boolean;
  isConnecting: boolean;
  disabled: boolean;
  onConnect: (context: string) => void;
  /** Abort the in-flight connect (OIDC browser wait, or a hung exec/cert connect). */
  onCancelConnect: () => void;
  onConfigureNamespaces: (context: string) => void;
  forwardsCount: number;
  hasConfiguredNamespaces?: boolean;
}
