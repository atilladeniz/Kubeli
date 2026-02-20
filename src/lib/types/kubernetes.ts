export interface Cluster {
  id: string;
  name: string;
  context: string;
  server: string;
  namespace: string | null;
  user: string;
  auth_type: AuthType;
  current: boolean;
  source_file: string | null;
}

export type AuthType = "certificate" | "token" | "exec" | "oidc" | "unknown";

export interface ConnectionStatus {
  connected: boolean;
  context: string | null;
  error: string | null;
  latency_ms: number | null;
}

export interface HealthCheckResult {
  healthy: boolean;
  latency_ms: number | null;
  error: string | null;
}

export interface K8sResource {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    uid: string;
    creationTimestamp: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: unknown;
  status?: unknown;
}

export interface Pod extends K8sResource {
  kind: "Pod";
  spec: {
    containers: Container[];
    nodeName?: string;
  };
  status: {
    phase: PodPhase;
    conditions?: Condition[];
    containerStatuses?: ContainerStatus[];
  };
}

export type PodPhase = "Pending" | "Running" | "Succeeded" | "Failed" | "Unknown";

export interface Container {
  name: string;
  image: string;
  ports?: ContainerPort[];
  env?: EnvVar[];
}

export interface ContainerPort {
  name?: string;
  containerPort: number;
  protocol?: string;
}

export interface EnvVar {
  name: string;
  value?: string;
  valueFrom?: unknown;
}

export interface Condition {
  type: string;
  status: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

export interface ContainerStatus {
  name: string;
  ready: boolean;
  restartCount: number;
  state: {
    running?: { startedAt: string };
    waiting?: { reason: string; message?: string };
    terminated?: { exitCode: number; reason?: string };
  };
}

export interface LogStream {
  id: string;
  pod: string;
  namespace: string;
  container?: string;
  active: boolean;
}

// Log streaming types
export interface LogEntry {
  timestamp: string | null;
  message: string;
  container: string;
  pod: string;
  namespace: string;
}

export interface LogOptions {
  namespace: string;
  pod_name: string;
  container?: string;
  follow?: boolean;
  tail_lines?: number;
  since_seconds?: number;
  timestamps?: boolean;
  previous?: boolean;
}

export type LogEventType = "Line" | "Error" | "Started" | "Stopped";

export type LogEvent =
  | { type: "Line"; data: LogEntry }
  | { type: "Error"; data: string }
  | { type: "Started"; data: { stream_id: string } }
  | { type: "Stopped"; data: { stream_id: string } };

export interface ShellSession {
  id: string;
  pod: string;
  namespace: string;
  container?: string;
  active: boolean;
}

export interface ShellOptions {
  namespace: string;
  pod_name: string;
  container?: string;
  command?: string[];
}

export type ShellEventType = "Output" | "Error" | "Started" | "Closed";

export type ShellEvent =
  | { type: "Output"; data: string }
  | { type: "Error"; data: string }
  | { type: "Started"; data: { session_id: string } }
  | { type: "Closed"; data: { session_id: string } };

export interface PortForward {
  id: string;
  resourceType: "pod" | "service";
  name: string;
  namespace: string;
  localPort: number;
  remotePort: number;
  active: boolean;
}

// Port forwarding types (matching Rust backend)
export type PortForwardTargetType = "pod" | "service";

export type PortForwardStatus = "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

export interface PortForwardOptions {
  namespace: string;
  name: string;
  target_type: PortForwardTargetType;
  target_port: number;
  local_port?: number;
}

export interface PortForwardInfo {
  forward_id: string;
  namespace: string;
  name: string;
  target_type: PortForwardTargetType;
  target_port: number;
  local_port: number;
  status: PortForwardStatus;
  pod_name?: string;
  pod_uid?: string;
}

export type PortForwardEventType = "Started" | "Connected" | "Reconnecting" | "Reconnected" | "PodDied" | "Disconnected" | "Error" | "Stopped";

export type PortForwardEvent =
  | { type: "Started"; data: { forward_id: string; local_port: number } }
  | { type: "Connected"; data: { forward_id: string } }
  | { type: "Reconnecting"; data: { forward_id: string; reason: string } }
  | { type: "Reconnected"; data: { forward_id: string; new_pod: string } }
  | { type: "PodDied"; data: { forward_id: string; pod_name: string } }
  | { type: "Disconnected"; data: { forward_id: string } }
  | { type: "Error"; data: { forward_id: string; message: string } }
  | { type: "Stopped"; data: { forward_id: string } };

// Resource listing types (matching Rust backend)
export interface ListOptions {
  namespace?: string;
  label_selector?: string;
  field_selector?: string;
  limit?: number;
}

export interface PodInfo {
  name: string;
  namespace: string;
  uid: string;
  phase: string;
  node_name: string | null;
  pod_ip: string | null;
  host_ip: string | null;
  init_containers: ContainerInfo[];
  containers: ContainerInfo[];
  created_at: string | null;
  deletion_timestamp: string | null;
  labels: Record<string, string>;
  restart_count: number;
  ready_containers: string;
}

export interface ContainerEnvVar {
  name: string;
  value: string | null;
  value_from: string | null;
}

export interface ContainerInfo {
  name: string;
  image: string;
  ready: boolean;
  restart_count: number;
  state: string;
  state_reason: string | null;
  last_state: string | null;
  last_state_reason: string | null;
  last_exit_code: number | null;
  last_finished_at: string | null;
  env_vars: ContainerEnvVar[];
}

export interface DeploymentInfo {
  name: string;
  namespace: string;
  uid: string;
  replicas: number;
  ready_replicas: number;
  available_replicas: number;
  updated_replicas: number;
  created_at: string | null;
  labels: Record<string, string>;
  selector: Record<string, string>;
}

export interface ServiceInfo {
  name: string;
  namespace: string;
  uid: string;
  service_type: string;
  cluster_ip: string | null;
  external_ip: string | null;
  ports: ServicePortInfo[];
  created_at: string | null;
  labels: Record<string, string>;
  selector: Record<string, string>;
}

export interface ServicePortInfo {
  name: string | null;
  port: number;
  target_port: string;
  protocol: string;
  node_port: number | null;
}

export interface ConfigMapInfo {
  name: string;
  namespace: string;
  uid: string;
  data_keys: string[];
  created_at: string | null;
  labels: Record<string, string>;
}

export interface SecretInfo {
  name: string;
  namespace: string;
  uid: string;
  secret_type: string;
  data_keys: string[];
  created_at: string | null;
  labels: Record<string, string>;
}

export interface NodeInfo {
  name: string;
  uid: string;
  status: string;
  roles: string[];
  version: string | null;
  os_image: string | null;
  kernel_version: string | null;
  container_runtime: string | null;
  cpu_capacity: string | null;
  memory_capacity: string | null;
  pod_capacity: string | null;
  created_at: string | null;
  labels: Record<string, string>;
  internal_ip: string | null;
  external_ip: string | null;
}

// Watch event types
export type WatchEventType = "Added" | "Modified" | "Deleted" | "Restarted" | "Error";

export interface WatchEvent<T> {
  type: WatchEventType;
  data: T | T[] | string;
}

// Metrics types
export interface NodeMetrics {
  name: string;
  timestamp: string;
  cpu: CpuMetrics;
  memory: MemoryMetrics;
}

export interface CpuMetrics {
  usage: string;
  usage_nano_cores: number;
  allocatable: string;
  percentage: number;
}

export interface MemoryMetrics {
  usage: string;
  usage_bytes: number;
  allocatable: string;
  percentage: number;
}

export interface PodMetrics {
  name: string;
  namespace: string;
  timestamp: string;
  containers: ContainerMetricsInfo[];
  total_cpu: string;
  total_cpu_nano_cores: number;
  total_memory: string;
  total_memory_bytes: number;
}

export interface ContainerMetricsInfo {
  name: string;
  cpu: ContainerCpuMetrics;
  memory: ContainerMemoryMetrics;
}

export interface ContainerCpuMetrics {
  usage: string;
  usage_nano_cores: number;
  request: string | null;
  limit: string | null;
}

export interface ContainerMemoryMetrics {
  usage: string;
  usage_bytes: number;
  request: string | null;
  limit: string | null;
}

export interface ClusterMetricsSummary {
  timestamp: string;
  nodes: NodeSummary;
  cpu: ClusterCpuSummary;
  memory: ClusterMemorySummary;
  top_cpu_pods: PodMetrics[];
  top_memory_pods: PodMetrics[];
  metrics_available: boolean;
}

export interface NodeSummary {
  total: number;
  ready: number;
}

export interface ClusterCpuSummary {
  capacity: string;
  capacity_milli: number;
  allocatable: string;
  allocatable_milli: number;
  usage: string;
  usage_milli: number;
  percentage: number;
}

export interface ClusterMemorySummary {
  capacity: string;
  capacity_bytes: number;
  allocatable: string;
  allocatable_bytes: number;
  usage: string;
  usage_bytes: number;
  percentage: number;
}

// Graph visualization types (simplified: only core workload hierarchy)
export type GraphNodeType = "namespace" | "deployment" | "pod";

export type GraphNodeStatus = "healthy" | "warning" | "error" | "unknown";

export type GraphEdgeType = "owns" | "contains";

export interface GraphNode {
  id: string;
  uid: string;
  name: string;
  namespace: string | null;
  node_type: GraphNodeType;
  status: GraphNodeStatus;
  labels: Record<string, string>;
  parent_id: string | null;
  ready_status: string | null;
  replicas: string | null;
  // Sub-flow properties
  is_group: boolean;
  child_count: number | null;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  edge_type: GraphEdgeType;
  label: string | null;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Namespace info
export interface NamespaceInfo {
  name: string;
  uid: string;
  status: string;
  created_at: string | null;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

// Event info (Kubernetes Events)
export type EventType = "Normal" | "Warning";

export interface EventInvolvedObject {
  kind: string;
  name: string;
  namespace: string | null;
  uid: string | null;
}

export interface EventInfo {
  name: string;
  namespace: string;
  uid: string;
  event_type: EventType;
  reason: string;
  message: string;
  involved_object: EventInvolvedObject;
  count: number;
  first_timestamp: string | null;
  last_timestamp: string | null;
  source_component: string | null;
  source_host: string | null;
  created_at: string | null;
}

// Lease info (for Leader Election)
export interface LeaseInfo {
  name: string;
  namespace: string;
  uid: string;
  holder_identity: string | null;
  lease_duration_seconds: number | null;
  acquire_time: string | null;
  renew_time: string | null;
  lease_transitions: number | null;
  created_at: string | null;
  labels: Record<string, string>;
}

// ReplicaSet info
export interface ReplicaSetInfo {
  name: string;
  namespace: string;
  uid: string;
  replicas: number;
  ready_replicas: number;
  available_replicas: number;
  owner_name: string | null;
  owner_kind: string | null;
  created_at: string | null;
  labels: Record<string, string>;
  selector: Record<string, string>;
}

// DaemonSet info
export interface DaemonSetInfo {
  name: string;
  namespace: string;
  uid: string;
  desired_number_scheduled: number;
  current_number_scheduled: number;
  number_ready: number;
  number_available: number;
  number_misscheduled: number;
  updated_number_scheduled: number;
  created_at: string | null;
  labels: Record<string, string>;
  node_selector: Record<string, string>;
}

// StatefulSet info
export interface StatefulSetInfo {
  name: string;
  namespace: string;
  uid: string;
  replicas: number;
  ready_replicas: number;
  current_replicas: number;
  updated_replicas: number;
  service_name: string | null;
  created_at: string | null;
  labels: Record<string, string>;
}

// Job info
export interface JobInfo {
  name: string;
  namespace: string;
  uid: string;
  completions: number | null;
  parallelism: number | null;
  succeeded: number;
  failed: number;
  active: number;
  start_time: string | null;
  completion_time: string | null;
  duration_seconds: number | null;
  created_at: string | null;
  labels: Record<string, string>;
  status: string;
}

// CronJob info
export interface CronJobInfo {
  name: string;
  namespace: string;
  uid: string;
  schedule: string;
  suspend: boolean;
  active_jobs: number;
  last_schedule_time: string | null;
  last_successful_time: string | null;
  created_at: string | null;
  labels: Record<string, string>;
}

// Ingress info
export interface IngressBackend {
  service_name: string | null;
  service_port: string | null;
  resource_name: string | null;
  resource_kind: string | null;
}

export interface IngressPath {
  path: string | null;
  path_type: string;
  backend: IngressBackend;
}

export interface IngressRule {
  host: string | null;
  paths: IngressPath[];
}

export interface IngressTLS {
  hosts: string[];
  secret_name: string | null;
}

export interface IngressInfo {
  name: string;
  namespace: string;
  uid: string;
  ingress_class_name: string | null;
  rules: IngressRule[];
  tls: IngressTLS[];
  default_backend: IngressBackend | null;
  load_balancer_ip: string | null;
  load_balancer_hostname: string | null;
  created_at: string | null;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

// EndpointSlice info
export interface EndpointPort {
  name: string | null;
  port: number;
  protocol: string;
  app_protocol: string | null;
}

export interface EndpointConditions {
  ready: boolean | null;
  serving: boolean | null;
  terminating: boolean | null;
}

export interface Endpoint {
  addresses: string[];
  conditions: EndpointConditions;
  hostname: string | null;
  node_name: string | null;
  zone: string | null;
  target_ref_kind: string | null;
  target_ref_name: string | null;
}

export interface EndpointSliceInfo {
  name: string;
  namespace: string;
  uid: string;
  address_type: string;
  endpoints: Endpoint[];
  ports: EndpointPort[];
  service_name: string | null;
  created_at: string | null;
  labels: Record<string, string>;
}

// NetworkPolicy info
export interface NetworkPolicyPort {
  protocol: string | null;
  port: string | null;
  end_port: number | null;
}

export interface NetworkPolicyPeer {
  pod_selector: Record<string, string> | null;
  namespace_selector: Record<string, string> | null;
  ip_block_cidr: string | null;
  ip_block_except: string[] | null;
}

export interface NetworkPolicyIngressRule {
  ports: NetworkPolicyPort[];
  from: NetworkPolicyPeer[];
}

export interface NetworkPolicyEgressRule {
  ports: NetworkPolicyPort[];
  to: NetworkPolicyPeer[];
}

export interface NetworkPolicyInfo {
  name: string;
  namespace: string;
  uid: string;
  pod_selector: Record<string, string>;
  policy_types: string[];
  ingress_rules: NetworkPolicyIngressRule[];
  egress_rules: NetworkPolicyEgressRule[];
  created_at: string | null;
  labels: Record<string, string>;
}

// IngressClass info
export interface IngressClassInfo {
  name: string;
  uid: string;
  controller: string | null;
  is_default: boolean;
  parameters_kind: string | null;
  parameters_name: string | null;
  parameters_namespace: string | null;
  parameters_scope: string | null;
  created_at: string | null;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

// HPA (Horizontal Pod Autoscaler) v2 info
export interface HPAMetricTarget {
  type: string;
  average_utilization: number | null;
  average_value: string | null;
  value: string | null;
}

export interface HPAMetricStatus {
  type: string;
  current_average_utilization: number | null;
  current_average_value: string | null;
  current_value: string | null;
}

export interface HPAInfo {
  name: string;
  namespace: string;
  uid: string;
  scale_target_ref_kind: string;
  scale_target_ref_name: string;
  min_replicas: number | null;
  max_replicas: number;
  current_replicas: number;
  desired_replicas: number;
  metrics: HPAMetricTarget[];
  current_metrics: HPAMetricStatus[];
  conditions: string[];
  created_at: string | null;
  labels: Record<string, string>;
}

// LimitRange info
export interface LimitRangeItem {
  type: string;
  default_limits: Record<string, string>;
  default_requests: Record<string, string>;
  max: Record<string, string>;
  min: Record<string, string>;
  max_limit_request_ratio: Record<string, string>;
}

export interface LimitRangeInfo {
  name: string;
  namespace: string;
  uid: string;
  limits: LimitRangeItem[];
  created_at: string | null;
  labels: Record<string, string>;
}

// ResourceQuota info
export interface ResourceQuotaInfo {
  name: string;
  namespace: string;
  uid: string;
  hard: Record<string, string>;
  used: Record<string, string>;
  scopes: string[];
  created_at: string | null;
  labels: Record<string, string>;
}

// PodDisruptionBudget info
export interface PDBInfo {
  name: string;
  namespace: string;
  uid: string;
  min_available: string | null;
  max_unavailable: string | null;
  current_healthy: number;
  desired_healthy: number;
  disruptions_allowed: number;
  expected_pods: number;
  selector: Record<string, string>;
  conditions: string[];
  created_at: string | null;
  labels: Record<string, string>;
}

// Persistent Volume info
export interface PVInfo {
  name: string;
  uid: string;
  capacity: string | null;
  access_modes: string[];
  reclaim_policy: string | null;
  status: string;
  claim_name: string | null;
  claim_namespace: string | null;
  storage_class_name: string | null;
  volume_mode: string | null;
  created_at: string | null;
  labels: Record<string, string>;
}

// Persistent Volume Claim info
export interface PVCInfo {
  name: string;
  namespace: string;
  uid: string;
  status: string;
  volume_name: string | null;
  capacity: string | null;
  requested_storage: string | null;
  access_modes: string[];
  storage_class_name: string | null;
  volume_mode: string | null;
  created_at: string | null;
  labels: Record<string, string>;
}

// Storage Class info
export interface StorageClassInfo {
  name: string;
  uid: string;
  provisioner: string;
  reclaim_policy: string | null;
  volume_binding_mode: string | null;
  allow_volume_expansion: boolean;
  is_default: boolean;
  parameters: Record<string, string>;
  created_at: string | null;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

// CSI Driver info
export interface CSIDriverInfo {
  name: string;
  uid: string;
  attach_required: boolean;
  pod_info_on_mount: boolean;
  storage_capacity: boolean;
  volume_lifecycle_modes: string[];
  fs_group_policy: string | null;
  created_at: string | null;
}

// CSI Node info
export interface CSINodeInfo {
  name: string;
  uid: string;
  drivers: CSINodeDriver[];
  created_at: string | null;
}

export interface CSINodeDriver {
  name: string;
  node_id: string;
  allocatable_count: number | null;
  topology_keys: string[];
}

// Volume Attachment info
export interface VolumeAttachmentInfo {
  name: string;
  uid: string;
  attacher: string;
  pv_name: string | null;
  node_name: string;
  attached: boolean;
  attachment_error: string | null;
  created_at: string | null;
}

// =============================================================================
// Access Control Resources
// =============================================================================

// Service Account info
export interface ServiceAccountInfo {
  name: string;
  namespace: string;
  uid: string;
  secrets: string[];
  image_pull_secrets: string[];
  automount_service_account_token: boolean | null;
  created_at: string | null;
  labels: Record<string, string>;
}

// Policy Rule for Roles/ClusterRoles
export interface PolicyRule {
  verbs: string[];
  api_groups: string[];
  resources: string[];
  resource_names: string[];
  non_resource_urls: string[];
}

// Role info
export interface RoleInfo {
  name: string;
  namespace: string;
  uid: string;
  rules: PolicyRule[];
  rules_count: number;
  created_at: string | null;
  labels: Record<string, string>;
}

// RoleBinding Subject
export interface RoleBindingSubject {
  kind: string;
  name: string;
  namespace: string | null;
  api_group: string | null;
}

// Role Binding info
export interface RoleBindingInfo {
  name: string;
  namespace: string;
  uid: string;
  role_kind: string;
  role_name: string;
  subjects: RoleBindingSubject[];
  subjects_count: number;
  created_at: string | null;
  labels: Record<string, string>;
}

// Cluster Role info
export interface ClusterRoleInfo {
  name: string;
  uid: string;
  rules: PolicyRule[];
  rules_count: number;
  aggregation_rule: string[] | null;
  created_at: string | null;
  labels: Record<string, string>;
}

// Cluster Role Binding info
export interface ClusterRoleBindingInfo {
  name: string;
  uid: string;
  role_name: string;
  subjects: RoleBindingSubject[];
  subjects_count: number;
  created_at: string | null;
  labels: Record<string, string>;
}

// =============================================================================
// Administration Types
// =============================================================================

// Custom Resource Definitions
export interface CRDVersion {
  name: string;
  served: boolean;
  storage: boolean;
}

export interface CRDInfo {
  name: string;
  uid: string;
  group: string;
  scope: string;
  kind: string;
  singular: string;
  plural: string;
  short_names: string[];
  versions: CRDVersion[];
  stored_versions: string[];
  conditions_ready: boolean;
  created_at: string | null;
  labels: Record<string, string>;
}

// Priority Classes
export interface PriorityClassInfo {
  name: string;
  uid: string;
  value: number;
  global_default: boolean;
  preemption_policy: string;
  description: string | null;
  created_at: string | null;
  labels: Record<string, string>;
}

// Runtime Classes
export interface RuntimeClassInfo {
  name: string;
  uid: string;
  handler: string;
  scheduling_node_selector: Record<string, string> | null;
  scheduling_tolerations_count: number;
  overhead_pod_fixed: Record<string, string> | null;
  created_at: string | null;
  labels: Record<string, string>;
}

// Mutating Webhook Configurations
export interface WebhookRule {
  api_groups: string[];
  api_versions: string[];
  operations: string[];
  resources: string[];
  scope: string | null;
}

export interface MutatingWebhookInfo {
  name: string;
  uid: string;
  webhooks: MutatingWebhook[];
  webhooks_count: number;
  created_at: string | null;
  labels: Record<string, string>;
}

export interface MutatingWebhook {
  name: string;
  client_config_service: string | null;
  client_config_url: string | null;
  failure_policy: string;
  match_policy: string | null;
  side_effects: string;
  timeout_seconds: number | null;
  rules: WebhookRule[];
  admission_review_versions: string[];
}

// Validating Webhook Configurations
export interface ValidatingWebhookInfo {
  name: string;
  uid: string;
  webhooks: ValidatingWebhook[];
  webhooks_count: number;
  created_at: string | null;
  labels: Record<string, string>;
}

export interface ValidatingWebhook {
  name: string;
  client_config_service: string | null;
  client_config_url: string | null;
  failure_policy: string;
  match_policy: string | null;
  side_effects: string;
  timeout_seconds: number | null;
  rules: WebhookRule[];
  admission_review_versions: string[];
}

// Helm Release types
export type HelmReleaseStatus =
  | "unknown"
  | "deployed"
  | "uninstalled"
  | "superseded"
  | "failed"
  | "uninstalling"
  | "pending-install"
  | "pending-upgrade"
  | "pending-rollback";

/** Source managing the Helm release */
export type HelmManagedBy = "helm" | "flux";

export interface HelmReleaseInfo {
  name: string;
  namespace: string;
  revision: number;
  status: HelmReleaseStatus;
  chart: string;
  chart_version: string;
  app_version: string;
  first_deployed: string | null;
  last_deployed: string | null;
  description: string;
  notes: string | null;
  /** Source managing this release (helm or flux) */
  managed_by: HelmManagedBy;
  /** Whether the release is suspended (Flux only) */
  suspended: boolean;
}

export interface HelmReleaseHistoryEntry {
  revision: number;
  status: HelmReleaseStatus;
  chart: string;
  chart_version: string;
  app_version: string;
  deployed: string | null;
  description: string;
}

export interface HelmReleaseDetail {
  name: string;
  namespace: string;
  revision: number;
  status: HelmReleaseStatus;
  chart: string;
  chart_version: string;
  app_version: string;
  first_deployed: string | null;
  last_deployed: string | null;
  description: string;
  notes: string | null;
  values: Record<string, unknown>;
  manifest: string;
  /** Source managing this release (helm or flux) */
  managed_by: HelmManagedBy;
}

// Flux Kustomization types
export type FluxKustomizationStatus =
  | "ready"
  | "notready"
  | "reconciling"
  | "failed"
  | "unknown";

export interface FluxKustomizationInfo {
  name: string;
  namespace: string;
  path: string;
  source_ref: string;
  interval: string;
  status: FluxKustomizationStatus;
  suspended: boolean;
  message: string | null;
  last_applied_revision: string | null;
  created_at: string | null;
}
