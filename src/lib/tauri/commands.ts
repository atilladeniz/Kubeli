import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { mockInvoke } from "./mock";
import type {
  Cluster,
  ConnectionStatus,
  HealthCheckResult,
  ListOptions,
  PodInfo,
  DeploymentInfo,
  ServiceInfo,
  ConfigMapInfo,
  SecretInfo,
  NodeInfo,
  NamespaceInfo,
  EventInfo,
  LeaseInfo,
  ReplicaSetInfo,
  DaemonSetInfo,
  StatefulSetInfo,
  JobInfo,
  CronJobInfo,
  IngressInfo,
  EndpointSliceInfo,
  NetworkPolicyInfo,
  IngressClassInfo,
  HPAInfo,
  LimitRangeInfo,
  ResourceQuotaInfo,
  PDBInfo,
  PVInfo,
  PVCInfo,
  StorageClassInfo,
  CSIDriverInfo,
  CSINodeInfo,
  VolumeAttachmentInfo,
  ServiceAccountInfo,
  RoleInfo,
  RoleBindingInfo,
  ClusterRoleInfo,
  ClusterRoleBindingInfo,
  CRDInfo,
  PriorityClassInfo,
  RuntimeClassInfo,
  MutatingWebhookInfo,
  ValidatingWebhookInfo,
  LogEntry,
  LogOptions,
  ShellOptions,
  PortForwardOptions,
  PortForwardInfo,
  NodeMetrics,
  PodMetrics,
  ClusterMetricsSummary,
  GraphData,
  HelmReleaseInfo,
  HelmReleaseDetail,
  HelmReleaseHistoryEntry,
  FluxKustomizationInfo,
} from "../types";

const invoke = <T>(command: string, payload?: unknown): Promise<T> => {
  if (process.env.VITE_TAURI_MOCK === "true" || process.env.NEXT_PUBLIC_TAURI_MOCK === "true") {
    return mockInvoke(command, payload as Record<string, unknown> | undefined) as Promise<T>;
  }

  return tauriInvoke<T>(command, payload as Record<string, unknown> | undefined);
};

// Cluster commands
export async function listClusters(): Promise<Cluster[]> {
  return invoke<Cluster[]>("list_clusters");
}

export async function connectCluster(context: string): Promise<ConnectionStatus> {
  return invoke<ConnectionStatus>("connect_cluster", { context });
}

export async function disconnectCluster(): Promise<void> {
  return invoke("disconnect_cluster");
}

export async function switchContext(context: string): Promise<ConnectionStatus> {
  return invoke<ConnectionStatus>("switch_context", { context });
}

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  return invoke<ConnectionStatus>("get_connection_status");
}

export async function checkConnectionHealth(): Promise<HealthCheckResult> {
  return invoke<HealthCheckResult>("check_connection_health");
}

export async function getNamespaces(): Promise<string[]> {
  return invoke<string[]>("get_namespaces");
}

export async function addCluster(kubeconfigContent: string): Promise<void> {
  return invoke("add_cluster", { kubeconfigContent });
}

export async function removeCluster(context: string): Promise<void> {
  return invoke("remove_cluster", { context });
}

export async function hasKubeconfig(): Promise<boolean> {
  return invoke<boolean>("has_kubeconfig");
}

// Kubeconfig source commands
export type KubeconfigSourceType = "file" | "folder";

export interface KubeconfigSource {
  path: string;
  source_type: KubeconfigSourceType;
}

export interface KubeconfigSourcesConfig {
  sources: KubeconfigSource[];
  merge_mode: boolean;
}

export interface KubeconfigSourceInfo {
  path: string;
  source_type: KubeconfigSourceType;
  file_count: number;
  context_count: number;
  valid: boolean;
  error: string | null;
  is_default: boolean;
}

export async function getKubeconfigSources(): Promise<KubeconfigSourcesConfig> {
  return invoke<KubeconfigSourcesConfig>("get_kubeconfig_sources");
}

export async function setKubeconfigSources(config: KubeconfigSourcesConfig): Promise<void> {
  return invoke("set_kubeconfig_sources", { config });
}

export async function addKubeconfigSource(
  path: string,
  sourceType: KubeconfigSourceType
): Promise<KubeconfigSourcesConfig> {
  return invoke<KubeconfigSourcesConfig>("add_kubeconfig_source", { path, sourceType });
}

export async function removeKubeconfigSource(
  path: string
): Promise<KubeconfigSourcesConfig> {
  return invoke<KubeconfigSourcesConfig>("remove_kubeconfig_source", { path });
}

export async function listKubeconfigSources(): Promise<KubeconfigSourceInfo[]> {
  return invoke<KubeconfigSourceInfo[]>("list_kubeconfig_sources");
}

export async function validateKubeconfigPath(path: string): Promise<KubeconfigSourceInfo> {
  return invoke<KubeconfigSourceInfo>("validate_kubeconfig_path", { path });
}

export async function setKubeconfigMergeMode(enabled: boolean): Promise<KubeconfigSourcesConfig> {
  return invoke<KubeconfigSourcesConfig>("set_kubeconfig_merge_mode", { enabled });
}

// Debug commands
export async function generateDebugLog(
  failedContext?: string,
  errorMessage?: string,
): Promise<string> {
  return invoke<string>("generate_debug_log", {
    failed_context: failedContext ?? null,
    error_message: errorMessage ?? null,
  });
}

// Resource commands
export async function listPods(options: ListOptions = {}): Promise<PodInfo[]> {
  return invoke<PodInfo[]>("list_pods", { options });
}

export async function listDeployments(options: ListOptions = {}): Promise<DeploymentInfo[]> {
  return invoke<DeploymentInfo[]>("list_deployments", { options });
}

export async function listServices(options: ListOptions = {}): Promise<ServiceInfo[]> {
  return invoke<ServiceInfo[]>("list_services", { options });
}

export async function listConfigmaps(options: ListOptions = {}): Promise<ConfigMapInfo[]> {
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

export async function listReplicasets(options: ListOptions = {}): Promise<ReplicaSetInfo[]> {
  return invoke<ReplicaSetInfo[]>("list_replicasets", { options });
}

export async function listDaemonsets(options: ListOptions = {}): Promise<DaemonSetInfo[]> {
  return invoke<DaemonSetInfo[]>("list_daemonsets", { options });
}

export async function listStatefulsets(options: ListOptions = {}): Promise<StatefulSetInfo[]> {
  return invoke<StatefulSetInfo[]>("list_statefulsets", { options });
}

export async function listJobs(options: ListOptions = {}): Promise<JobInfo[]> {
  return invoke<JobInfo[]>("list_jobs", { options });
}

export async function listCronjobs(options: ListOptions = {}): Promise<CronJobInfo[]> {
  return invoke<CronJobInfo[]>("list_cronjobs", { options });
}

// Networking resources
export async function listIngresses(options: ListOptions = {}): Promise<IngressInfo[]> {
  return invoke<IngressInfo[]>("list_ingresses", { options });
}

export async function listEndpointSlices(options: ListOptions = {}): Promise<EndpointSliceInfo[]> {
  return invoke<EndpointSliceInfo[]>("list_endpoint_slices", { options });
}

export async function listNetworkPolicies(options: ListOptions = {}): Promise<NetworkPolicyInfo[]> {
  return invoke<NetworkPolicyInfo[]>("list_network_policies", { options });
}

export async function listIngressClasses(options: ListOptions = {}): Promise<IngressClassInfo[]> {
  return invoke<IngressClassInfo[]>("list_ingress_classes", { options });
}

// Configuration resources
export async function listHPAs(options: ListOptions = {}): Promise<HPAInfo[]> {
  return invoke<HPAInfo[]>("list_hpas", { options });
}

export async function listLimitRanges(options: ListOptions = {}): Promise<LimitRangeInfo[]> {
  return invoke<LimitRangeInfo[]>("list_limit_ranges", { options });
}

export async function listResourceQuotas(options: ListOptions = {}): Promise<ResourceQuotaInfo[]> {
  return invoke<ResourceQuotaInfo[]>("list_resource_quotas", { options });
}

export async function listPDBs(options: ListOptions = {}): Promise<PDBInfo[]> {
  return invoke<PDBInfo[]>("list_pdbs", { options });
}

// Storage resources
export async function listPersistentVolumes(): Promise<PVInfo[]> {
  return invoke<PVInfo[]>("list_persistent_volumes");
}

export async function listPersistentVolumeClaims(namespace?: string): Promise<PVCInfo[]> {
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
export async function listServiceAccounts(namespace?: string): Promise<ServiceAccountInfo[]> {
  return invoke<ServiceAccountInfo[]>("list_service_accounts", { namespace });
}

export async function listRoles(namespace?: string): Promise<RoleInfo[]> {
  return invoke<RoleInfo[]>("list_roles", { namespace });
}

export async function listRoleBindings(namespace?: string): Promise<RoleBindingInfo[]> {
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

// Watch commands
export async function watchPods(
  watchId: string,
  namespace?: string
): Promise<void> {
  return invoke("watch_pods", { watchId, namespace });
}

export async function watchNamespaces(watchId: string): Promise<void> {
  return invoke("watch_namespaces", { watchId });
}

export async function stopWatch(watchId: string): Promise<void> {
  return invoke("stop_watch", { watchId });
}

// Log commands
export async function getPodLogs(options: LogOptions): Promise<LogEntry[]> {
  return invoke<LogEntry[]>("get_pod_logs", { options });
}

export async function streamPodLogs(
  streamId: string,
  options: LogOptions
): Promise<void> {
  return invoke("stream_pod_logs", { streamId, options });
}

export async function stopLogStream(streamId: string): Promise<void> {
  return invoke("stop_log_stream", { streamId });
}

export async function getPodContainers(
  namespace: string,
  podName: string
): Promise<string[]> {
  return invoke<string[]>("get_pod_containers", { namespace, podName });
}

export async function downloadPodLogs(options: LogOptions): Promise<string> {
  return invoke<string>("download_pod_logs", { options });
}

// Shell commands
export async function shellStart(
  sessionId: string,
  options: ShellOptions
): Promise<void> {
  return invoke("shell_start", { sessionId, options });
}

export async function shellSendInput(
  sessionId: string,
  input: string
): Promise<void> {
  return invoke("shell_send_input", { sessionId, input });
}

export async function shellResize(
  sessionId: string,
  cols: number,
  rows: number
): Promise<void> {
  return invoke("shell_resize", { sessionId, cols, rows });
}

export async function shellClose(sessionId: string): Promise<void> {
  return invoke("shell_close", { sessionId });
}

export async function shellListSessions(): Promise<string[]> {
  return invoke<string[]>("shell_list_sessions");
}

// Port forward commands
export async function portforwardStart(
  forwardId: string,
  options: PortForwardOptions
): Promise<PortForwardInfo> {
  return invoke<PortForwardInfo>("portforward_start", { forwardId, options });
}

export async function portforwardStop(forwardId: string): Promise<void> {
  return invoke("portforward_stop", { forwardId });
}

export async function portforwardList(): Promise<PortForwardInfo[]> {
  return invoke<PortForwardInfo[]>("portforward_list");
}

export async function portforwardGet(
  forwardId: string
): Promise<PortForwardInfo | null> {
  return invoke<PortForwardInfo | null>("portforward_get", { forwardId });
}

export async function portforwardCheckPort(port: number): Promise<boolean> {
  return invoke<boolean>("portforward_check_port", { port });
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

// Metrics commands
export async function getNodeMetrics(nodeName?: string): Promise<NodeMetrics[]> {
  return invoke<NodeMetrics[]>("get_node_metrics", { nodeName });
}

export async function getPodMetrics(
  namespace?: string,
  podName?: string
): Promise<PodMetrics[]> {
  return invoke<PodMetrics[]>("get_pod_metrics", { namespace, podName });
}

export async function getClusterMetricsSummary(): Promise<ClusterMetricsSummary> {
  return invoke<ClusterMetricsSummary>("get_cluster_metrics_summary");
}

export async function checkMetricsServer(): Promise<boolean> {
  return invoke<boolean>("check_metrics_server");
}

// Graph commands
export async function generateResourceGraph(
  namespace?: string
): Promise<GraphData> {
  return invoke<GraphData>("generate_resource_graph", { namespace });
}

// Helm commands
export async function listHelmReleases(
  namespace?: string
): Promise<HelmReleaseInfo[]> {
  return invoke<HelmReleaseInfo[]>("list_helm_releases", { namespace });
}

export async function getHelmRelease(
  name: string,
  namespace: string,
  revision?: number
): Promise<HelmReleaseDetail> {
  return invoke<HelmReleaseDetail>("get_helm_release", { name, namespace, revision });
}

export async function getHelmReleaseHistory(
  name: string,
  namespace: string
): Promise<HelmReleaseHistoryEntry[]> {
  return invoke<HelmReleaseHistoryEntry[]>("get_helm_release_history", { name, namespace });
}

export async function getHelmReleaseValues(
  name: string,
  namespace: string,
  revision?: number
): Promise<Record<string, unknown>> {
  return invoke<Record<string, unknown>>("get_helm_release_values", { name, namespace, revision });
}

export async function getHelmReleaseManifest(
  name: string,
  namespace: string,
  revision?: number
): Promise<string> {
  return invoke<string>("get_helm_release_manifest", { name, namespace, revision });
}

export async function uninstallHelmRelease(
  name: string,
  namespace: string
): Promise<void> {
  return invoke<void>("uninstall_helm_release", { name, namespace });
}

// Flux commands
export async function listFluxKustomizations(
  namespace?: string
): Promise<FluxKustomizationInfo[]> {
  return invoke<FluxKustomizationInfo[]>("list_flux_kustomizations", { namespace });
}

export async function reconcileFluxKustomization(
  name: string,
  namespace: string
): Promise<void> {
  return invoke<void>("reconcile_flux_kustomization", { name, namespace });
}

export async function suspendFluxKustomization(
  name: string,
  namespace: string
): Promise<void> {
  return invoke<void>("suspend_flux_kustomization", { name, namespace });
}

export async function resumeFluxKustomization(
  name: string,
  namespace: string
): Promise<void> {
  return invoke<void>("resume_flux_kustomization", { name, namespace });
}

export async function reconcileFluxHelmRelease(
  name: string,
  namespace: string
): Promise<void> {
  return invoke<void>("reconcile_flux_helmrelease", { name, namespace });
}

export async function suspendFluxHelmRelease(
  name: string,
  namespace: string
): Promise<void> {
  return invoke<void>("suspend_flux_helmrelease", { name, namespace });
}

export async function resumeFluxHelmRelease(
  name: string,
  namespace: string
): Promise<void> {
  return invoke<void>("resume_flux_helmrelease", { name, namespace });
}

// Network/Proxy commands
export interface ProxyConfig {
  proxyType: string;
  host: string;
  port: number;
  username: string;
  password: string;
}

export async function setProxyConfig(
  proxyType: string,
  host: string,
  port: number,
  username: string,
  password: string
): Promise<void> {
  return invoke("set_proxy_config", {
    proxyType,
    host,
    port,
    username,
    password,
  });
}

export async function getProxyConfig(): Promise<ProxyConfig> {
  return invoke<ProxyConfig>("get_proxy_config");
}

// AI CLI commands
export type CliStatus = "authenticated" | "notauthenticated" | "notinstalled" | "error";

// Backward compatible alias
export type ClaudeCliStatus = CliStatus;

export interface CliInfo {
  status: CliStatus;
  version: string | null;
  cli_path: string | null;
  error_message: string | null;
}

// Backward compatible alias
export type ClaudeCliInfo = CliInfo;
export type CodexCliInfo = CliInfo;

export interface AIAuthStatus {
  cli_available: boolean;
  cli_authenticated: boolean;
  has_api_key: boolean;
  cli_version: string | null;
  cli_path: string | null;
  error: string | null;
}

// Claude CLI commands
export async function aiCheckCliAvailable(): Promise<ClaudeCliInfo> {
  return invoke<ClaudeCliInfo>("ai_check_cli_available");
}

export async function aiVerifyAuthentication(): Promise<AIAuthStatus> {
  return invoke<AIAuthStatus>("ai_verify_authentication");
}

export async function aiSetApiKey(apiKey: string | null): Promise<void> {
  return invoke("ai_set_api_key", { apiKey });
}

export async function aiGetAuthStatus(): Promise<AIAuthStatus> {
  return invoke<AIAuthStatus>("ai_get_auth_status");
}

// Codex CLI commands
export async function aiCheckCodexCliAvailable(): Promise<CodexCliInfo> {
  return invoke<CodexCliInfo>("ai_check_codex_cli_available");
}

export async function aiVerifyCodexAuthentication(): Promise<AIAuthStatus> {
  return invoke<AIAuthStatus>("ai_verify_codex_authentication");
}

export async function aiGetCodexAuthStatus(): Promise<AIAuthStatus> {
  return invoke<AIAuthStatus>("ai_get_codex_auth_status");
}

// AI Session commands
export type AiCliProvider = "claude" | "codex";

export interface SessionInfo {
  session_id: string;
  cluster_context: string;
  provider: AiCliProvider;
}

export async function aiStartSession(
  clusterContext: string,
  initialContext?: string,
  provider?: AiCliProvider
): Promise<string> {
  return invoke<string>("ai_start_session", { clusterContext, initialContext, provider });
}

export async function aiSendMessage(
  sessionId: string,
  message: string
): Promise<void> {
  return invoke("ai_send_message", { sessionId, message });
}

export async function aiInterrupt(sessionId: string): Promise<void> {
  return invoke("ai_interrupt", { sessionId });
}

export async function aiStopSession(sessionId: string): Promise<void> {
  return invoke("ai_stop_session", { sessionId });
}

export async function aiListSessions(): Promise<SessionInfo[]> {
  return invoke<SessionInfo[]>("ai_list_sessions");
}

export async function aiIsSessionActive(sessionId: string): Promise<boolean> {
  return invoke<boolean>("ai_is_session_active", { sessionId });
}

// AI Context commands
export interface ClusterContext {
  context_name: string;
  kubernetes_version: string | null;
  platform: string | null;
  node_count: number;
  namespace_count: number;
  running_pods: number;
  problem_pods: number;
  current_namespace: string | null;
  recent_issues: string[];
}

export async function aiBuildContext(
  contextName: string,
  currentNamespace?: string
): Promise<ClusterContext> {
  return invoke<ClusterContext>("ai_build_context", { contextName, currentNamespace });
}

export async function aiGetSystemPrompt(
  contextName: string,
  currentNamespace?: string
): Promise<string> {
  return invoke<string>("ai_get_system_prompt", { contextName, currentNamespace });
}

// AI Permission commands
export type PermissionMode = "plan" | "default" | "acceptedits";

export interface PermissionStatus {
  mode: PermissionMode;
  sandboxed_namespaces: string[];
  pending_approvals_count: number;
}

export interface ApprovalRequest {
  request_id: string;
  session_id: string;
  tool_name: string;
  tool_input: unknown;
  command_preview: string;
  reason: string;
  severity: "low" | "medium" | "high" | "critical";
}

export async function aiGetPermissionMode(): Promise<PermissionMode> {
  return invoke<PermissionMode>("ai_get_permission_mode");
}

export async function aiSetPermissionMode(mode: PermissionMode): Promise<void> {
  return invoke<void>("ai_set_permission_mode", { mode });
}

export async function aiGetPermissionStatus(): Promise<PermissionStatus> {
  return invoke<PermissionStatus>("ai_get_permission_status");
}

export async function aiAddSandboxedNamespace(namespace: string): Promise<void> {
  return invoke<void>("ai_add_sandboxed_namespace", { namespace });
}

export async function aiRemoveSandboxedNamespace(namespace: string): Promise<void> {
  return invoke<void>("ai_remove_sandboxed_namespace", { namespace });
}

export async function aiGetSandboxedNamespaces(): Promise<string[]> {
  return invoke<string[]>("ai_get_sandboxed_namespaces");
}

export async function aiListPendingApprovals(): Promise<ApprovalRequest[]> {
  return invoke<ApprovalRequest[]>("ai_list_pending_approvals");
}

export async function aiApproveAction(requestId: string): Promise<void> {
  return invoke<void>("ai_approve_action", { requestId });
}

export async function aiRejectAction(requestId: string, reason?: string): Promise<void> {
  return invoke<void>("ai_reject_action", { requestId, reason });
}

// AI Session Persistence commands
export interface SessionSummary {
  session_id: string;
  cluster_context: string;
  created_at: string;
  last_active_at: string;
  title: string | null;
  message_count: number;
}

export interface MessageRecord {
  message_id: string;
  session_id: string;
  role: string;
  content: string;
  tool_calls: string | null;
  timestamp: string;
}

export async function aiListSavedSessions(clusterContext: string): Promise<SessionSummary[]> {
  return invoke<SessionSummary[]>("ai_list_saved_sessions", { clusterContext });
}

export async function aiGetConversationHistory(sessionId: string): Promise<MessageRecord[]> {
  return invoke<MessageRecord[]>("ai_get_conversation_history", { sessionId });
}

export async function aiSaveSession(
  sessionId: string,
  clusterContext: string,
  permissionMode: string,
  title?: string
): Promise<void> {
  return invoke<void>("ai_save_session", { sessionId, clusterContext, permissionMode, title });
}

export async function aiSaveMessage(
  messageId: string,
  sessionId: string,
  role: string,
  content: string,
  toolCalls?: string
): Promise<void> {
  return invoke<void>("ai_save_message", { messageId, sessionId, role, content, toolCalls });
}

export async function aiUpdateMessage(
  messageId: string,
  content: string,
  toolCalls?: string
): Promise<void> {
  return invoke<void>("ai_update_message", { messageId, content, toolCalls });
}

export async function aiUpdateSessionTitle(sessionId: string, title: string): Promise<void> {
  return invoke<void>("ai_update_session_title", { sessionId, title });
}

export async function aiDeleteSavedSession(sessionId: string): Promise<void> {
  return invoke<void>("ai_delete_saved_session", { sessionId });
}

export async function aiDeleteClusterSessions(clusterContext: string): Promise<void> {
  return invoke<void>("ai_delete_cluster_sessions", { clusterContext });
}

export async function aiGetResumeContext(sessionId: string): Promise<string> {
  return invoke<string>("ai_get_resume_context", { sessionId });
}

export async function aiCleanupOldSessions(days: number): Promise<number> {
  return invoke<number>("ai_cleanup_old_sessions", { days });
}

// MCP Server commands
export interface McpIdeInfo {
  id: string;
  name: string;
  installed: boolean;
  config_path: string | null;
  mcp_configured: boolean;
}

export async function mcpDetectIdes(): Promise<McpIdeInfo[]> {
  return invoke<McpIdeInfo[]>("mcp_detect_ides");
}

export async function mcpInstallIde(ideId: string): Promise<void> {
  return invoke<void>("mcp_install_ide", { ideId });
}

export async function mcpUninstallIde(ideId: string): Promise<void> {
  return invoke<void>("mcp_uninstall_ide", { ideId });
}

export async function mcpGetKubeliPath(): Promise<string> {
  return invoke<string>("mcp_get_kubeli_path");
}
