import { invoke } from "./core";

// AI CLI commands
export type CliStatus =
  | "authenticated"
  | "notauthenticated"
  | "notinstalled"
  | "error";

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
  return invoke<string>("ai_start_session", {
    clusterContext,
    initialContext,
    provider,
  });
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

export async function aiRemoveSandboxedNamespace(
  namespace: string
): Promise<void> {
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

export async function aiRejectAction(
  requestId: string,
  reason?: string
): Promise<void> {
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

export async function aiListSavedSessions(
  clusterContext: string
): Promise<SessionSummary[]> {
  return invoke<SessionSummary[]>("ai_list_saved_sessions", { clusterContext });
}

export async function aiGetConversationHistory(
  sessionId: string
): Promise<MessageRecord[]> {
  return invoke<MessageRecord[]>("ai_get_conversation_history", { sessionId });
}

export async function aiSaveSession(
  sessionId: string,
  clusterContext: string,
  permissionMode: string,
  title?: string
): Promise<void> {
  return invoke<void>("ai_save_session", {
    sessionId,
    clusterContext,
    permissionMode,
    title,
  });
}

export async function aiSaveMessage(
  messageId: string,
  sessionId: string,
  role: string,
  content: string,
  toolCalls?: string
): Promise<void> {
  return invoke<void>("ai_save_message", {
    messageId,
    sessionId,
    role,
    content,
    toolCalls,
  });
}

export async function aiUpdateMessage(
  messageId: string,
  content: string,
  toolCalls?: string
): Promise<void> {
  return invoke<void>("ai_update_message", { messageId, content, toolCalls });
}

export async function aiUpdateSessionTitle(
  sessionId: string,
  title: string
): Promise<void> {
  return invoke<void>("ai_update_session_title", { sessionId, title });
}

export async function aiDeleteSavedSession(sessionId: string): Promise<void> {
  return invoke<void>("ai_delete_saved_session", { sessionId });
}

export async function aiDeleteClusterSessions(
  clusterContext: string
): Promise<void> {
  return invoke<void>("ai_delete_cluster_sessions", { clusterContext });
}

export async function aiGetResumeContext(sessionId: string): Promise<string> {
  return invoke<string>("ai_get_resume_context", { sessionId });
}

export async function aiCleanupOldSessions(days: number): Promise<number> {
  return invoke<number>("ai_cleanup_old_sessions", { days });
}
