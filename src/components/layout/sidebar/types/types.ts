import type { FavoriteResource } from "@/lib/stores/favorites-store";
import type { RecentResource } from "@/lib/stores/favorites-store";
import type { PortForwardInfo } from "@/lib/types";

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

export interface SidebarUiStateHook {
  namespaceOpen: boolean;
  setNamespaceOpen: (open: boolean) => void;
  isNamespaceSectionOpen: boolean;
  setIsNamespaceSectionOpen: (open: boolean) => void;
  isPortForwardsSectionOpen: boolean;
  setIsPortForwardsSectionOpen: (open: boolean) => void;
  isFavoritesSectionOpen: boolean;
  setIsFavoritesSectionOpen: (open: boolean) => void;
  isRecentSectionOpen: boolean;
  setIsRecentSectionOpen: (open: boolean) => void;
  isNavFavoritesSectionOpen: boolean;
  setIsNavFavoritesSectionOpen: (open: boolean) => void;
  navFavorites: ResourceType[];
  isNavFavorite: (resource: ResourceType) => boolean;
  toggleNavFavorite: (resource: ResourceType) => void;
}

export interface NamespaceSectionProps {
  isConnected: boolean;
  namespaces: string[];
  selectedNamespaces: string[];
  namespaceOpen: boolean;
  isNamespaceSectionOpen: boolean;
  setNamespaceOpen: (open: boolean) => void;
  setIsNamespaceSectionOpen: (open: boolean) => void;
  toggleNamespace: (ns: string) => void;
  selectAllNamespaces: () => void;
}

export interface PortForwardsSectionProps {
  isConnected: boolean;
  forwards: PortForwardInfo[];
  isPortForwardsSectionOpen: boolean;
  setIsPortForwardsSectionOpen: (open: boolean) => void;
  onResourceSelect: (resource: ResourceType) => void;
  onOpenForwardInBrowser: (port: number) => void | Promise<void>;
  stopForward: (forwardId: string) => void | Promise<void>;
}

export interface FavoritesSectionProps {
  isConnected: boolean;
  favorites: FavoriteResource[];
  activeFavoriteId?: string | null;
  clusterContext: string;
  isFavoritesSectionOpen: boolean;
  setIsFavoritesSectionOpen: (open: boolean) => void;
  modKeySymbol: string;
  onResourceSelect: (resource: ResourceType) => void;
  onFavoriteSelect?: (favorite: FavoriteResource) => void | Promise<void>;
  onFavoriteOpenLogs?: (favorite: FavoriteResource) => void | Promise<void>;
  removeFavorite: (clusterContext: string, id: string) => void;
}

export interface RecentSectionProps {
  isConnected: boolean;
  recentResources: RecentResource[];
  isRecentSectionOpen: boolean;
  setIsRecentSectionOpen: (open: boolean) => void;
  onResourceSelect: (resource: ResourceType) => void;
}

export interface QuickAccessSectionProps {
  navFavorites: ResourceType[];
  navLabelById: Map<ResourceType, string>;
  activeResource: ResourceType;
  isNavFavoritesSectionOpen: boolean;
  setIsNavFavoritesSectionOpen: (open: boolean) => void;
  onResourceSelect: (resource: ResourceType) => void;
  onToggleNavFavorite: (resource: ResourceType) => void;
}
