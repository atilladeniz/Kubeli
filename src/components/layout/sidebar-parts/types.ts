import type { FavoriteResource } from "@/lib/stores/favorites-store";

export type ResourceType =
  // Cluster
  | "cluster-overview"
  | "resource-diagram"
  | "nodes"
  | "events"
  | "namespaces"
  | "leases"
  // Helm
  | "helm-releases"
  // Flux
  | "flux-kustomizations"
  // Workloads
  | "workloads-overview"
  | "deployments"
  | "pods"
  | "replicasets"
  | "daemonsets"
  | "statefulsets"
  | "jobs"
  | "cronjobs"
  // Networking
  | "port-forwards"
  | "services"
  | "ingresses"
  | "endpoint-slices"
  | "network-policies"
  | "ingress-classes"
  // Configuration
  | "secrets"
  | "configmaps"
  | "hpa"
  | "limit-ranges"
  | "resource-quotas"
  | "pod-disruption-budgets"
  // Storage
  | "persistent-volumes"
  | "persistent-volume-claims"
  | "volume-attachments"
  | "storage-classes"
  | "csi-drivers"
  | "csi-nodes"
  // Access Control
  | "service-accounts"
  | "roles"
  | "role-bindings"
  | "cluster-roles"
  | "cluster-role-bindings"
  // Administration
  | "crds"
  | "priority-classes"
  | "runtime-classes"
  | "mutating-webhooks"
  | "validating-webhooks"
  // Special views
  | "pod-logs";

export interface NavItem {
  id: ResourceType;
  label: string;
}

export interface NavSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: NavItem[];
}

export interface SidebarUiState {
  namespaceOpen?: boolean;
  portForwardsOpen?: boolean;
  favoritesOpen?: boolean;
  recentOpen?: boolean;
  navFavoritesOpen?: boolean;
  navFavorites?: ResourceType[];
}

export interface SidebarProps {
  activeResource: ResourceType;
  activeFavoriteId?: string | null;
  onResourceSelect: (resource: ResourceType) => void;
  onResourceSelectNewTab?: (resource: ResourceType, title: string) => void;
  onFavoriteSelect?: (favorite: FavoriteResource) => void | Promise<void>;
  onFavoriteOpenLogs?: (favorite: FavoriteResource) => void | Promise<void>;
}
