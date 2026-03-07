jest.mock("../core", () => ({
  invoke: jest.fn(),
}));

import * as ai from "../ai";
import * as cluster from "../cluster";
import * as flux from "../flux";
import * as graph from "../graph";
import * as helm from "../helm";
import * as logs from "../logs";
import * as mcp from "../mcp";
import * as metrics from "../metrics";
import * as network from "../network";
import * as portforward from "../portforward";
import * as resources from "../resources";
import * as shell from "../shell";
import * as watch from "../watch";
import * as tauriCommands from "../../commands";
import * as tauriIndex from "../../index";
import { invoke } from "../core";

type TestCase = {
  name: string;
  run: () => Promise<unknown>;
  expectedCommand: string;
  expectedPayload?: unknown;
};

const resourceOptions = { namespace: "kubeli-demo", limit: 10 };
const logOptions = { namespace: "default", pod_name: "demo", tail_lines: 50 };
const portOptions = { namespace: "default", pod_name: "demo", local_port: 8080 };
const shellOptions = { namespace: "default", pod_name: "demo", container: "app", command: ["sh"] };

const cases: TestCase[] = [
  { name: "listClusters", run: () => cluster.listClusters(), expectedCommand: "list_clusters" },
  { name: "connectCluster", run: () => cluster.connectCluster("ctx"), expectedCommand: "connect_cluster", expectedPayload: { context: "ctx" } },
  { name: "disconnectCluster", run: () => cluster.disconnectCluster(), expectedCommand: "disconnect_cluster" },
  { name: "switchContext", run: () => cluster.switchContext("ctx"), expectedCommand: "switch_context", expectedPayload: { context: "ctx" } },
  { name: "getConnectionStatus", run: () => cluster.getConnectionStatus(), expectedCommand: "get_connection_status" },
  { name: "checkConnectionHealth", run: () => cluster.checkConnectionHealth(), expectedCommand: "check_connection_health" },
  { name: "getNamespaces", run: () => cluster.getNamespaces(), expectedCommand: "get_namespaces" },
  { name: "getClusterSettings", run: () => cluster.getClusterSettings("ctx"), expectedCommand: "get_cluster_settings", expectedPayload: { context: "ctx" } },
  { name: "setClusterAccessibleNamespaces", run: () => cluster.setClusterAccessibleNamespaces("ctx", ["a", "b"]), expectedCommand: "set_cluster_accessible_namespaces", expectedPayload: { context: "ctx", namespaces: ["a", "b"] } },
  { name: "clearClusterSettings", run: () => cluster.clearClusterSettings("ctx"), expectedCommand: "clear_cluster_settings", expectedPayload: { context: "ctx" } },
  { name: "addCluster", run: () => cluster.addCluster("apiVersion: v1"), expectedCommand: "add_cluster", expectedPayload: { kubeconfigContent: "apiVersion: v1" } },
  { name: "removeCluster", run: () => cluster.removeCluster("ctx"), expectedCommand: "remove_cluster", expectedPayload: { context: "ctx" } },
  { name: "hasKubeconfig", run: () => cluster.hasKubeconfig(), expectedCommand: "has_kubeconfig" },
  { name: "getKubeconfigSources", run: () => cluster.getKubeconfigSources(), expectedCommand: "get_kubeconfig_sources" },
  { name: "setKubeconfigSources", run: () => cluster.setKubeconfigSources({ sources: [], merge_mode: true }), expectedCommand: "set_kubeconfig_sources", expectedPayload: { config: { sources: [], merge_mode: true } } },
  { name: "addKubeconfigSource", run: () => cluster.addKubeconfigSource("~/.kube/config", "file"), expectedCommand: "add_kubeconfig_source", expectedPayload: { path: "~/.kube/config", sourceType: "file" } },
  { name: "removeKubeconfigSource", run: () => cluster.removeKubeconfigSource("~/.kube/config"), expectedCommand: "remove_kubeconfig_source", expectedPayload: { path: "~/.kube/config" } },
  { name: "listKubeconfigSources", run: () => cluster.listKubeconfigSources(), expectedCommand: "list_kubeconfig_sources" },
  { name: "validateKubeconfigPath", run: () => cluster.validateKubeconfigPath("~/.kube/config"), expectedCommand: "validate_kubeconfig_path", expectedPayload: { path: "~/.kube/config" } },
  { name: "setKubeconfigMergeMode", run: () => cluster.setKubeconfigMergeMode(true), expectedCommand: "set_kubeconfig_merge_mode", expectedPayload: { enabled: true } },
  { name: "generateDebugLog", run: () => cluster.generateDebugLog("ctx", "boom"), expectedCommand: "generate_debug_log", expectedPayload: { failed_context: "ctx", error_message: "boom" } },
  { name: "listFluxKustomizations", run: () => flux.listFluxKustomizations("flux-system"), expectedCommand: "list_flux_kustomizations", expectedPayload: { namespace: "flux-system" } },
  { name: "reconcileFluxKustomization", run: () => flux.reconcileFluxKustomization("app", "flux-system"), expectedCommand: "reconcile_flux_kustomization", expectedPayload: { name: "app", namespace: "flux-system" } },
  { name: "suspendFluxKustomization", run: () => flux.suspendFluxKustomization("app", "flux-system"), expectedCommand: "suspend_flux_kustomization", expectedPayload: { name: "app", namespace: "flux-system" } },
  { name: "resumeFluxKustomization", run: () => flux.resumeFluxKustomization("app", "flux-system"), expectedCommand: "resume_flux_kustomization", expectedPayload: { name: "app", namespace: "flux-system" } },
  { name: "reconcileFluxHelmRelease", run: () => flux.reconcileFluxHelmRelease("app", "flux-system"), expectedCommand: "reconcile_flux_helmrelease", expectedPayload: { name: "app", namespace: "flux-system" } },
  { name: "suspendFluxHelmRelease", run: () => flux.suspendFluxHelmRelease("app", "flux-system"), expectedCommand: "suspend_flux_helmrelease", expectedPayload: { name: "app", namespace: "flux-system" } },
  { name: "resumeFluxHelmRelease", run: () => flux.resumeFluxHelmRelease("app", "flux-system"), expectedCommand: "resume_flux_helmrelease", expectedPayload: { name: "app", namespace: "flux-system" } },
  { name: "generateResourceGraph", run: () => graph.generateResourceGraph(["default"]), expectedCommand: "generate_resource_graph", expectedPayload: { namespaces: ["default"] } },
  { name: "listHelmReleases", run: () => helm.listHelmReleases("default"), expectedCommand: "list_helm_releases", expectedPayload: { namespace: "default" } },
  { name: "getHelmRelease", run: () => helm.getHelmRelease("demo", "default", 3), expectedCommand: "get_helm_release", expectedPayload: { name: "demo", namespace: "default", revision: 3 } },
  { name: "getHelmReleaseHistory", run: () => helm.getHelmReleaseHistory("demo", "default"), expectedCommand: "get_helm_release_history", expectedPayload: { name: "demo", namespace: "default" } },
  { name: "getHelmReleaseValues", run: () => helm.getHelmReleaseValues("demo", "default", 2), expectedCommand: "get_helm_release_values", expectedPayload: { name: "demo", namespace: "default", revision: 2 } },
  { name: "getHelmReleaseManifest", run: () => helm.getHelmReleaseManifest("demo", "default", 2), expectedCommand: "get_helm_release_manifest", expectedPayload: { name: "demo", namespace: "default", revision: 2 } },
  { name: "uninstallHelmRelease", run: () => helm.uninstallHelmRelease("demo", "default"), expectedCommand: "uninstall_helm_release", expectedPayload: { name: "demo", namespace: "default" } },
  { name: "getPodLogs", run: () => logs.getPodLogs(logOptions as never), expectedCommand: "get_pod_logs", expectedPayload: { options: logOptions } },
  { name: "streamPodLogs", run: () => logs.streamPodLogs("stream-1", logOptions as never), expectedCommand: "stream_pod_logs", expectedPayload: { streamId: "stream-1", options: logOptions } },
  { name: "stopLogStream", run: () => logs.stopLogStream("stream-1"), expectedCommand: "stop_log_stream", expectedPayload: { streamId: "stream-1" } },
  { name: "getPodContainers", run: () => logs.getPodContainers("default", "demo"), expectedCommand: "get_pod_containers", expectedPayload: { namespace: "default", podName: "demo" } },
  { name: "downloadPodLogs", run: () => logs.downloadPodLogs(logOptions as never), expectedCommand: "download_pod_logs", expectedPayload: { options: logOptions } },
  { name: "mcpDetectIdes", run: () => mcp.mcpDetectIdes(), expectedCommand: "mcp_detect_ides" },
  { name: "mcpInstallIde", run: () => mcp.mcpInstallIde("cursor"), expectedCommand: "mcp_install_ide", expectedPayload: { ideId: "cursor" } },
  { name: "mcpUninstallIde", run: () => mcp.mcpUninstallIde("cursor"), expectedCommand: "mcp_uninstall_ide", expectedPayload: { ideId: "cursor" } },
  { name: "mcpGetKubeliPath", run: () => mcp.mcpGetKubeliPath(), expectedCommand: "mcp_get_kubeli_path" },
  { name: "getNodeMetrics", run: () => metrics.getNodeMetrics("minikube"), expectedCommand: "get_node_metrics", expectedPayload: { nodeName: "minikube" } },
  { name: "getPodMetrics", run: () => metrics.getPodMetrics("default", "demo"), expectedCommand: "get_pod_metrics", expectedPayload: { namespace: "default", podName: "demo" } },
  { name: "getPodMetricsDirect", run: () => metrics.getPodMetricsDirect("default"), expectedCommand: "get_pod_metrics_direct", expectedPayload: { namespace: "default" } },
  { name: "getClusterMetricsSummary", run: () => metrics.getClusterMetricsSummary(), expectedCommand: "get_cluster_metrics_summary" },
  { name: "checkMetricsServer", run: () => metrics.checkMetricsServer(), expectedCommand: "check_metrics_server" },
  { name: "setProxyConfig", run: () => network.setProxyConfig("http", "localhost", 3128, "user", "pass"), expectedCommand: "set_proxy_config", expectedPayload: { proxyType: "http", host: "localhost", port: 3128, username: "user", password: "pass" } },
  { name: "getProxyConfig", run: () => network.getProxyConfig(), expectedCommand: "get_proxy_config" },
  { name: "portforwardStart", run: () => portforward.portforwardStart("forward-1", portOptions as never), expectedCommand: "portforward_start", expectedPayload: { forwardId: "forward-1", options: portOptions } },
  { name: "portforwardStop", run: () => portforward.portforwardStop("forward-1"), expectedCommand: "portforward_stop", expectedPayload: { forwardId: "forward-1" } },
  { name: "portforwardList", run: () => portforward.portforwardList(), expectedCommand: "portforward_list" },
  { name: "portforwardGet", run: () => portforward.portforwardGet("forward-1"), expectedCommand: "portforward_get", expectedPayload: { forwardId: "forward-1" } },
  { name: "portforwardCheckPort", run: () => portforward.portforwardCheckPort(8080), expectedCommand: "portforward_check_port", expectedPayload: { port: 8080 } },
  { name: "shellStart", run: () => shell.shellStart("shell-1", shellOptions as never), expectedCommand: "shell_start", expectedPayload: { sessionId: "shell-1", options: shellOptions } },
  { name: "shellSendInput", run: () => shell.shellSendInput("shell-1", "ls\n"), expectedCommand: "shell_send_input", expectedPayload: { sessionId: "shell-1", input: "ls\n" } },
  { name: "shellResize", run: () => shell.shellResize("shell-1", 120, 40), expectedCommand: "shell_resize", expectedPayload: { sessionId: "shell-1", cols: 120, rows: 40 } },
  { name: "shellClose", run: () => shell.shellClose("shell-1"), expectedCommand: "shell_close", expectedPayload: { sessionId: "shell-1" } },
  { name: "shellListSessions", run: () => shell.shellListSessions(), expectedCommand: "shell_list_sessions" },
  { name: "watchPods", run: () => watch.watchPods("watch-1", "default"), expectedCommand: "watch_pods", expectedPayload: { watchId: "watch-1", namespace: "default" } },
  { name: "watchNamespaces", run: () => watch.watchNamespaces("watch-1"), expectedCommand: "watch_namespaces", expectedPayload: { watchId: "watch-1" } },
  { name: "stopWatch", run: () => watch.stopWatch("watch-1"), expectedCommand: "stop_watch", expectedPayload: { watchId: "watch-1" } },
  { name: "aiCheckCliAvailable", run: () => ai.aiCheckCliAvailable(), expectedCommand: "ai_check_cli_available" },
  { name: "aiVerifyAuthentication", run: () => ai.aiVerifyAuthentication(), expectedCommand: "ai_verify_authentication" },
  { name: "aiSetApiKey", run: () => ai.aiSetApiKey("secret"), expectedCommand: "ai_set_api_key", expectedPayload: { apiKey: "secret" } },
  { name: "aiGetAuthStatus", run: () => ai.aiGetAuthStatus(), expectedCommand: "ai_get_auth_status" },
  { name: "aiCheckCodexCliAvailable", run: () => ai.aiCheckCodexCliAvailable(), expectedCommand: "ai_check_codex_cli_available" },
  { name: "aiVerifyCodexAuthentication", run: () => ai.aiVerifyCodexAuthentication(), expectedCommand: "ai_verify_codex_authentication" },
  { name: "aiGetCodexAuthStatus", run: () => ai.aiGetCodexAuthStatus(), expectedCommand: "ai_get_codex_auth_status" },
  { name: "aiStartSession", run: () => ai.aiStartSession("ctx", "prompt", "codex"), expectedCommand: "ai_start_session", expectedPayload: { clusterContext: "ctx", initialContext: "prompt", provider: "codex" } },
  { name: "aiSendMessage", run: () => ai.aiSendMessage("session-1", "hello"), expectedCommand: "ai_send_message", expectedPayload: { sessionId: "session-1", message: "hello" } },
  { name: "aiInterrupt", run: () => ai.aiInterrupt("session-1"), expectedCommand: "ai_interrupt", expectedPayload: { sessionId: "session-1" } },
  { name: "aiStopSession", run: () => ai.aiStopSession("session-1"), expectedCommand: "ai_stop_session", expectedPayload: { sessionId: "session-1" } },
  { name: "aiListSessions", run: () => ai.aiListSessions(), expectedCommand: "ai_list_sessions" },
  { name: "aiIsSessionActive", run: () => ai.aiIsSessionActive("session-1"), expectedCommand: "ai_is_session_active", expectedPayload: { sessionId: "session-1" } },
  { name: "aiBuildContext", run: () => ai.aiBuildContext("ctx", "default"), expectedCommand: "ai_build_context", expectedPayload: { contextName: "ctx", currentNamespace: "default" } },
  { name: "aiGetSystemPrompt", run: () => ai.aiGetSystemPrompt("ctx", "default"), expectedCommand: "ai_get_system_prompt", expectedPayload: { contextName: "ctx", currentNamespace: "default" } },
  { name: "aiGetPermissionMode", run: () => ai.aiGetPermissionMode(), expectedCommand: "ai_get_permission_mode" },
  { name: "aiSetPermissionMode", run: () => ai.aiSetPermissionMode("plan"), expectedCommand: "ai_set_permission_mode", expectedPayload: { mode: "plan" } },
  { name: "aiGetPermissionStatus", run: () => ai.aiGetPermissionStatus(), expectedCommand: "ai_get_permission_status" },
  { name: "aiAddSandboxedNamespace", run: () => ai.aiAddSandboxedNamespace("demo"), expectedCommand: "ai_add_sandboxed_namespace", expectedPayload: { namespace: "demo" } },
  { name: "aiRemoveSandboxedNamespace", run: () => ai.aiRemoveSandboxedNamespace("demo"), expectedCommand: "ai_remove_sandboxed_namespace", expectedPayload: { namespace: "demo" } },
  { name: "aiGetSandboxedNamespaces", run: () => ai.aiGetSandboxedNamespaces(), expectedCommand: "ai_get_sandboxed_namespaces" },
  { name: "aiListPendingApprovals", run: () => ai.aiListPendingApprovals(), expectedCommand: "ai_list_pending_approvals" },
  { name: "aiApproveAction", run: () => ai.aiApproveAction("req-1"), expectedCommand: "ai_approve_action", expectedPayload: { requestId: "req-1" } },
  { name: "aiRejectAction", run: () => ai.aiRejectAction("req-1", "unsafe"), expectedCommand: "ai_reject_action", expectedPayload: { requestId: "req-1", reason: "unsafe" } },
  { name: "aiListSavedSessions", run: () => ai.aiListSavedSessions("ctx"), expectedCommand: "ai_list_saved_sessions", expectedPayload: { clusterContext: "ctx" } },
  { name: "aiGetConversationHistory", run: () => ai.aiGetConversationHistory("session-1"), expectedCommand: "ai_get_conversation_history", expectedPayload: { sessionId: "session-1" } },
  { name: "aiSaveSession", run: () => ai.aiSaveSession("session-1", "ctx", "default", "title"), expectedCommand: "ai_save_session", expectedPayload: { sessionId: "session-1", clusterContext: "ctx", permissionMode: "default", title: "title" } },
  { name: "aiSaveMessage", run: () => ai.aiSaveMessage("message-1", "session-1", "user", "hello", "[]"), expectedCommand: "ai_save_message", expectedPayload: { messageId: "message-1", sessionId: "session-1", role: "user", content: "hello", toolCalls: "[]" } },
  { name: "aiUpdateMessage", run: () => ai.aiUpdateMessage("message-1", "updated", "[]"), expectedCommand: "ai_update_message", expectedPayload: { messageId: "message-1", content: "updated", toolCalls: "[]" } },
  { name: "aiUpdateSessionTitle", run: () => ai.aiUpdateSessionTitle("session-1", "new title"), expectedCommand: "ai_update_session_title", expectedPayload: { sessionId: "session-1", title: "new title" } },
  { name: "aiDeleteSavedSession", run: () => ai.aiDeleteSavedSession("session-1"), expectedCommand: "ai_delete_saved_session", expectedPayload: { sessionId: "session-1" } },
  { name: "aiDeleteClusterSessions", run: () => ai.aiDeleteClusterSessions("ctx"), expectedCommand: "ai_delete_cluster_sessions", expectedPayload: { clusterContext: "ctx" } },
  { name: "aiGetResumeContext", run: () => ai.aiGetResumeContext("session-1"), expectedCommand: "ai_get_resume_context", expectedPayload: { sessionId: "session-1" } },
  { name: "aiCleanupOldSessions", run: () => ai.aiCleanupOldSessions(30), expectedCommand: "ai_cleanup_old_sessions", expectedPayload: { days: 30 } },
  { name: "listPods", run: () => resources.listPods(resourceOptions as never), expectedCommand: "list_pods", expectedPayload: { options: resourceOptions } },
  { name: "listDeployments", run: () => resources.listDeployments(resourceOptions as never), expectedCommand: "list_deployments", expectedPayload: { options: resourceOptions } },
  { name: "listServices", run: () => resources.listServices(resourceOptions as never), expectedCommand: "list_services", expectedPayload: { options: resourceOptions } },
  { name: "listConfigmaps", run: () => resources.listConfigmaps(resourceOptions as never), expectedCommand: "list_configmaps", expectedPayload: { options: resourceOptions } },
  { name: "listSecrets", run: () => resources.listSecrets(resourceOptions as never), expectedCommand: "list_secrets", expectedPayload: { options: resourceOptions } },
  { name: "listNodes", run: () => resources.listNodes(), expectedCommand: "list_nodes" },
  { name: "listNamespaces", run: () => resources.listNamespaces(), expectedCommand: "list_namespaces" },
  { name: "listEvents", run: () => resources.listEvents(resourceOptions as never), expectedCommand: "list_events", expectedPayload: { options: resourceOptions } },
  { name: "listLeases", run: () => resources.listLeases(resourceOptions as never), expectedCommand: "list_leases", expectedPayload: { options: resourceOptions } },
  { name: "listReplicasets", run: () => resources.listReplicasets(resourceOptions as never), expectedCommand: "list_replicasets", expectedPayload: { options: resourceOptions } },
  { name: "listDaemonsets", run: () => resources.listDaemonsets(resourceOptions as never), expectedCommand: "list_daemonsets", expectedPayload: { options: resourceOptions } },
  { name: "listStatefulsets", run: () => resources.listStatefulsets(resourceOptions as never), expectedCommand: "list_statefulsets", expectedPayload: { options: resourceOptions } },
  { name: "listJobs", run: () => resources.listJobs(resourceOptions as never), expectedCommand: "list_jobs", expectedPayload: { options: resourceOptions } },
  { name: "listCronjobs", run: () => resources.listCronjobs(resourceOptions as never), expectedCommand: "list_cronjobs", expectedPayload: { options: resourceOptions } },
  { name: "listIngresses", run: () => resources.listIngresses(resourceOptions as never), expectedCommand: "list_ingresses", expectedPayload: { options: resourceOptions } },
  { name: "listEndpointSlices", run: () => resources.listEndpointSlices(resourceOptions as never), expectedCommand: "list_endpoint_slices", expectedPayload: { options: resourceOptions } },
  { name: "listNetworkPolicies", run: () => resources.listNetworkPolicies(resourceOptions as never), expectedCommand: "list_network_policies", expectedPayload: { options: resourceOptions } },
  { name: "listIngressClasses", run: () => resources.listIngressClasses(resourceOptions as never), expectedCommand: "list_ingress_classes", expectedPayload: { options: resourceOptions } },
  { name: "listHPAs", run: () => resources.listHPAs(resourceOptions as never), expectedCommand: "list_hpas", expectedPayload: { options: resourceOptions } },
  { name: "listLimitRanges", run: () => resources.listLimitRanges(resourceOptions as never), expectedCommand: "list_limit_ranges", expectedPayload: { options: resourceOptions } },
  { name: "listResourceQuotas", run: () => resources.listResourceQuotas(resourceOptions as never), expectedCommand: "list_resource_quotas", expectedPayload: { options: resourceOptions } },
  { name: "listPDBs", run: () => resources.listPDBs(resourceOptions as never), expectedCommand: "list_pdbs", expectedPayload: { options: resourceOptions } },
  { name: "listPersistentVolumes", run: () => resources.listPersistentVolumes(), expectedCommand: "list_persistent_volumes" },
  { name: "listPersistentVolumeClaims", run: () => resources.listPersistentVolumeClaims("default"), expectedCommand: "list_persistent_volume_claims", expectedPayload: { namespace: "default" } },
  { name: "listStorageClasses", run: () => resources.listStorageClasses(), expectedCommand: "list_storage_classes" },
  { name: "listCSIDrivers", run: () => resources.listCSIDrivers(), expectedCommand: "list_csi_drivers" },
  { name: "listCSINodes", run: () => resources.listCSINodes(), expectedCommand: "list_csi_nodes" },
  { name: "listVolumeAttachments", run: () => resources.listVolumeAttachments(), expectedCommand: "list_volume_attachments" },
  { name: "listServiceAccounts", run: () => resources.listServiceAccounts("default"), expectedCommand: "list_service_accounts", expectedPayload: { namespace: "default" } },
  { name: "listRoles", run: () => resources.listRoles("default"), expectedCommand: "list_roles", expectedPayload: { namespace: "default" } },
  { name: "listRoleBindings", run: () => resources.listRoleBindings("default"), expectedCommand: "list_role_bindings", expectedPayload: { namespace: "default" } },
  { name: "listClusterRoles", run: () => resources.listClusterRoles(), expectedCommand: "list_cluster_roles" },
  { name: "listClusterRoleBindings", run: () => resources.listClusterRoleBindings(), expectedCommand: "list_cluster_role_bindings" },
  { name: "listCRDs", run: () => resources.listCRDs(), expectedCommand: "list_crds" },
  { name: "listPriorityClasses", run: () => resources.listPriorityClasses(), expectedCommand: "list_priority_classes" },
  { name: "listRuntimeClasses", run: () => resources.listRuntimeClasses(), expectedCommand: "list_runtime_classes" },
  { name: "listMutatingWebhooks", run: () => resources.listMutatingWebhooks(), expectedCommand: "list_mutating_webhooks" },
  { name: "listValidatingWebhooks", run: () => resources.listValidatingWebhooks(), expectedCommand: "list_validating_webhooks" },
  { name: "getPod", run: () => resources.getPod("demo", "default"), expectedCommand: "get_pod", expectedPayload: { name: "demo", namespace: "default" } },
  { name: "deletePod", run: () => resources.deletePod("demo", "default"), expectedCommand: "delete_pod", expectedPayload: { name: "demo", namespace: "default" } },
  { name: "getResourceYaml", run: () => resources.getResourceYaml("Deployment", "demo", "default"), expectedCommand: "get_resource_yaml", expectedPayload: { resourceType: "Deployment", name: "demo", namespace: "default" } },
  { name: "applyResourceYaml", run: () => resources.applyResourceYaml("kind: Pod"), expectedCommand: "apply_resource_yaml", expectedPayload: { yamlContent: "kind: Pod" } },
  { name: "deleteResource", run: () => resources.deleteResource("Service", "demo", "default"), expectedCommand: "delete_resource", expectedPayload: { resourceType: "Service", name: "demo", namespace: "default" } },
  { name: "scaleDeployment", run: () => resources.scaleDeployment("demo", "default", 3), expectedCommand: "scale_deployment", expectedPayload: { name: "demo", namespace: "default", replicas: 3 } },
];

describe("tauri command wrappers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (invoke as jest.Mock).mockResolvedValue("ok");
  });

  it.each(cases)("forwards $name to invoke", async ({ run, expectedCommand, expectedPayload }) => {
    await run();
    const lastCall = (invoke as jest.Mock).mock.calls.at(-1);
    expect(lastCall?.[0]).toBe(expectedCommand);
    if (expectedPayload === undefined) {
      expect(lastCall).toHaveLength(1);
    } else {
      expect(lastCall?.[1]).toEqual(expectedPayload);
    }
  });

  it("applies default payloads for resource list helpers", async () => {
    await resources.listPods();
    expect(invoke).toHaveBeenLastCalledWith("list_pods", { options: {} });

    await resources.listServices();
    expect(invoke).toHaveBeenLastCalledWith("list_services", { options: {} });
  });

  it("re-exports command modules through the tauri barrels", () => {
    expect(tauriCommands.listClusters).toBe(cluster.listClusters);
    expect(tauriCommands.aiStartSession).toBe(ai.aiStartSession);
    expect(tauriIndex.listPods).toBe(resources.listPods);
    expect(tauriIndex.mcpDetectIdes).toBe(mcp.mcpDetectIdes);
  });
});
