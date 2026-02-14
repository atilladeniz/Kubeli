import type {
  CRDInfo,
  CSIDriverInfo,
  CSINodeInfo,
  ConfigMapInfo,
  CronJobInfo,
  DaemonSetInfo,
  DeploymentInfo,
  EndpointSliceInfo,
  EventInfo,
  HPAInfo,
  IngressClassInfo,
  IngressInfo,
  JobInfo,
  LeaseInfo,
  LimitRangeInfo,
  ListOptions,
  MutatingWebhookInfo,
  NamespaceInfo,
  NetworkPolicyInfo,
  NodeInfo,
  PDBInfo,
  PVInfo,
  PVCInfo,
  PodInfo,
  PriorityClassInfo,
  ReplicaSetInfo,
  ResourceQuotaInfo,
  RoleBindingInfo,
  RoleInfo,
  RuntimeClassInfo,
  SecretInfo,
  ServiceAccountInfo,
  ServiceInfo,
  StatefulSetInfo,
  StorageClassInfo,
  ValidatingWebhookInfo,
  VolumeAttachmentInfo,
  ClusterRoleInfo,
  ClusterRoleBindingInfo,
} from "../../types";

import { invoke } from "./core";

// Resource commands
export async function listPods(options: ListOptions = {}): Promise<PodInfo[]> {
  return invoke<PodInfo[]>("list_pods", { options });
}

export async function listDeployments(
  options: ListOptions = {}
): Promise<DeploymentInfo[]> {
  return invoke<DeploymentInfo[]>("list_deployments", { options });
}

export async function listServices(
  options: ListOptions = {}
): Promise<ServiceInfo[]> {
  return invoke<ServiceInfo[]>("list_services", { options });
}

export async function listConfigmaps(
  options: ListOptions = {}
): Promise<ConfigMapInfo[]> {
  return invoke<ConfigMapInfo[]>("list_configmaps", { options });
}

export async function listSecrets(options: ListOptions = {}): Promise<SecretInfo[]> {
  return invoke<SecretInfo[]>("list_secrets", { options });
}

export async function listNodes(): Promise<NodeInfo[]> {
  return invoke<NodeInfo[]>("list_nodes");
}

export async function listNamespaces(): Promise<NamespaceInfo[]> {
  return invoke<NamespaceInfo[]>("list_namespaces");
}

export async function listEvents(options: ListOptions = {}): Promise<EventInfo[]> {
  return invoke<EventInfo[]>("list_events", { options });
}

export async function listLeases(options: ListOptions = {}): Promise<LeaseInfo[]> {
  return invoke<LeaseInfo[]>("list_leases", { options });
}

export async function listReplicasets(
  options: ListOptions = {}
): Promise<ReplicaSetInfo[]> {
  return invoke<ReplicaSetInfo[]>("list_replicasets", { options });
}

export async function listDaemonsets(
  options: ListOptions = {}
): Promise<DaemonSetInfo[]> {
  return invoke<DaemonSetInfo[]>("list_daemonsets", { options });
}

export async function listStatefulsets(
  options: ListOptions = {}
): Promise<StatefulSetInfo[]> {
  return invoke<StatefulSetInfo[]>("list_statefulsets", { options });
}

export async function listJobs(options: ListOptions = {}): Promise<JobInfo[]> {
  return invoke<JobInfo[]>("list_jobs", { options });
}

export async function listCronjobs(
  options: ListOptions = {}
): Promise<CronJobInfo[]> {
  return invoke<CronJobInfo[]>("list_cronjobs", { options });
}

// Networking resources
export async function listIngresses(
  options: ListOptions = {}
): Promise<IngressInfo[]> {
  return invoke<IngressInfo[]>("list_ingresses", { options });
}

export async function listEndpointSlices(
  options: ListOptions = {}
): Promise<EndpointSliceInfo[]> {
  return invoke<EndpointSliceInfo[]>("list_endpoint_slices", { options });
}

export async function listNetworkPolicies(
  options: ListOptions = {}
): Promise<NetworkPolicyInfo[]> {
  return invoke<NetworkPolicyInfo[]>("list_network_policies", { options });
}

export async function listIngressClasses(
  options: ListOptions = {}
): Promise<IngressClassInfo[]> {
  return invoke<IngressClassInfo[]>("list_ingress_classes", { options });
}

// Configuration resources
export async function listHPAs(options: ListOptions = {}): Promise<HPAInfo[]> {
  return invoke<HPAInfo[]>("list_hpas", { options });
}

export async function listLimitRanges(
  options: ListOptions = {}
): Promise<LimitRangeInfo[]> {
  return invoke<LimitRangeInfo[]>("list_limit_ranges", { options });
}

export async function listResourceQuotas(
  options: ListOptions = {}
): Promise<ResourceQuotaInfo[]> {
  return invoke<ResourceQuotaInfo[]>("list_resource_quotas", { options });
}

export async function listPDBs(options: ListOptions = {}): Promise<PDBInfo[]> {
  return invoke<PDBInfo[]>("list_pdbs", { options });
}

// Storage resources
export async function listPersistentVolumes(): Promise<PVInfo[]> {
  return invoke<PVInfo[]>("list_persistent_volumes");
}

export async function listPersistentVolumeClaims(
  namespace?: string
): Promise<PVCInfo[]> {
  return invoke<PVCInfo[]>("list_persistent_volume_claims", { namespace });
}

export async function listStorageClasses(): Promise<StorageClassInfo[]> {
  return invoke<StorageClassInfo[]>("list_storage_classes");
}

export async function listCSIDrivers(): Promise<CSIDriverInfo[]> {
  return invoke<CSIDriverInfo[]>("list_csi_drivers");
}

export async function listCSINodes(): Promise<CSINodeInfo[]> {
  return invoke<CSINodeInfo[]>("list_csi_nodes");
}

export async function listVolumeAttachments(): Promise<VolumeAttachmentInfo[]> {
  return invoke<VolumeAttachmentInfo[]>("list_volume_attachments");
}

// Access Control resources
export async function listServiceAccounts(
  namespace?: string
): Promise<ServiceAccountInfo[]> {
  return invoke<ServiceAccountInfo[]>("list_service_accounts", { namespace });
}

export async function listRoles(namespace?: string): Promise<RoleInfo[]> {
  return invoke<RoleInfo[]>("list_roles", { namespace });
}

export async function listRoleBindings(
  namespace?: string
): Promise<RoleBindingInfo[]> {
  return invoke<RoleBindingInfo[]>("list_role_bindings", { namespace });
}

export async function listClusterRoles(): Promise<ClusterRoleInfo[]> {
  return invoke<ClusterRoleInfo[]>("list_cluster_roles");
}

export async function listClusterRoleBindings(): Promise<ClusterRoleBindingInfo[]> {
  return invoke<ClusterRoleBindingInfo[]>("list_cluster_role_bindings");
}

// Administration resources
export async function listCRDs(): Promise<CRDInfo[]> {
  return invoke<CRDInfo[]>("list_crds");
}

export async function listPriorityClasses(): Promise<PriorityClassInfo[]> {
  return invoke<PriorityClassInfo[]>("list_priority_classes");
}

export async function listRuntimeClasses(): Promise<RuntimeClassInfo[]> {
  return invoke<RuntimeClassInfo[]>("list_runtime_classes");
}

export async function listMutatingWebhooks(): Promise<MutatingWebhookInfo[]> {
  return invoke<MutatingWebhookInfo[]>("list_mutating_webhooks");
}

export async function listValidatingWebhooks(): Promise<ValidatingWebhookInfo[]> {
  return invoke<ValidatingWebhookInfo[]>("list_validating_webhooks");
}

export async function getPod(name: string, namespace: string): Promise<PodInfo> {
  return invoke<PodInfo>("get_pod", { name, namespace });
}

export async function deletePod(name: string, namespace: string): Promise<void> {
  return invoke("delete_pod", { name, namespace });
}

// Resource YAML commands
export interface ResourceYaml {
  yaml: string;
  api_version: string;
  kind: string;
  name: string;
  namespace: string | null;
  uid: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  created_at: string | null;
}

export async function getResourceYaml(
  resourceType: string,
  name: string,
  namespace?: string
): Promise<ResourceYaml> {
  return invoke<ResourceYaml>("get_resource_yaml", { resourceType, name, namespace });
}

export async function applyResourceYaml(yamlContent: string): Promise<string> {
  return invoke<string>("apply_resource_yaml", { yamlContent });
}

export async function deleteResource(
  resourceType: string,
  name: string,
  namespace?: string
): Promise<void> {
  return invoke("delete_resource", { resourceType, name, namespace });
}

export async function scaleDeployment(
  name: string,
  namespace: string,
  replicas: number
): Promise<void> {
  return invoke("scale_deployment", { name, namespace, replicas });
}
