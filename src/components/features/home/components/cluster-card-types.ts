import type { Cluster } from "@/lib/types";

export interface ClusterCardProps {
  cluster: Cluster;
  isActive: boolean;
  isConnecting: boolean;
  disabled: boolean;
  onConnect: (context: string) => void;
  onConfigureNamespaces: (context: string) => void;
  forwardsCount: number;
  hasConfiguredNamespaces?: boolean;
}
