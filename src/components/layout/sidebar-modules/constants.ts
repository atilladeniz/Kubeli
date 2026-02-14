import type { ResourceType, SidebarUiState } from "./types";

const SIDEBAR_UI_STATE_STORAGE_KEY = "kubeli-sidebar-ui-state";

// Views that are implemented (not "coming soon")
export const implementedViews: ResourceType[] = [
  "cluster-overview",
  "resource-diagram",
  "nodes",
  "namespaces",
  "events",
  "leases",
  "workloads-overview",
  "pods",
  "deployments",
  "replicasets",
  "daemonsets",
  "statefulsets",
  "jobs",
  "cronjobs",
  "port-forwards",
  "services",
  "ingresses",
  "endpoint-slices",
  "network-policies",
  "ingress-classes",
  "configmaps",
  "secrets",
  "hpa",
  "limit-ranges",
  "resource-quotas",
  "pod-disruption-budgets",
  "persistent-volumes",
  "persistent-volume-claims",
  "storage-classes",
  "csi-drivers",
  "csi-nodes",
  "volume-attachments",
  "service-accounts",
  "roles",
  "role-bindings",
  "cluster-roles",
  "cluster-role-bindings",
  "crds",
  "priority-classes",
  "runtime-classes",
  "mutating-webhooks",
  "validating-webhooks",
  "helm-releases",
  "flux-kustomizations",
];

export function readSidebarUiState(): SidebarUiState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SIDEBAR_UI_STATE_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SidebarUiState;
  } catch {
    return {};
  }
}

export function saveSidebarUiState(state: SidebarUiState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SIDEBAR_UI_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}
