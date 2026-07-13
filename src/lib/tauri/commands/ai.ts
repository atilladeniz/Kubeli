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
export type OpenCodeCliInfo = CliInfo;
export type DroidCliInfo = CliInfo;

// Claude CLI commands
export async function aiCheckCliAvailable(): Promise<ClaudeCliInfo> {
  return invoke<ClaudeCliInfo>("ai_check_cli_available");
}

// Codex CLI commands
export async function aiCheckCodexCliAvailable(): Promise<CodexCliInfo> {
  return invoke<CodexCliInfo>("ai_check_codex_cli_available");
}

// OpenCode CLI commands
export async function aiCheckOpenCodeCliAvailable(): Promise<OpenCodeCliInfo> {
  return invoke<OpenCodeCliInfo>("ai_check_opencode_cli_available");
}

// Droid CLI commands (Factory.ai)
export async function aiCheckDroidCliAvailable(): Promise<DroidCliInfo> {
  return invoke<DroidCliInfo>("ai_check_droid_cli_available");
}

// AI Session commands
export type AiCliProvider = "claude" | "codex" | "opencode" | "droid";

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

// AI Context commands
export async function aiGetSystemPrompt(
  contextName: string,
  currentNamespace?: string
): Promise<string> {
  return invoke<string>("ai_get_system_prompt", { contextName, currentNamespace });
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

export async function aiDeleteSavedSession(sessionId: string): Promise<void> {
  return invoke<void>("ai_delete_saved_session", { sessionId });
}

export async function aiDeleteClusterSessions(
  clusterContext: string
): Promise<void> {
  return invoke<void>("ai_delete_cluster_sessions", { clusterContext });
}
