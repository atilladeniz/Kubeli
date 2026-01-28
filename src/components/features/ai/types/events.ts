/**
 * AI Event types received from the Tauri backend.
 * These events are emitted via the `ai-session-{sessionId}` channel.
 */
export interface AIEventData {
  type: AIEventType;
  data: AIEventPayload;
}

export type AIEventType =
  | "MessageChunk"
  | "Thinking"
  | "ToolExecution"
  | "ApprovalRequired"
  | "ApprovalResponse"
  | "ToolBlocked"
  | "Error"
  | "SessionEnded";

export interface AIEventPayload {
  session_id?: string;
  content?: string;
  done?: boolean;
  active?: boolean;
  tool_name?: string;
  status?: "pending" | "running" | "completed" | "failed";
  output?: string;
  request_id?: string;
  command_preview?: string;
  reason?: string;
  severity?: "low" | "medium" | "high" | "critical";
  tool_input?: unknown;
  approved?: boolean;
  message?: string;
}
