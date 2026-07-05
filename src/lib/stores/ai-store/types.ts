import type { StateCreator } from "zustand";
import type { MessageRecord, SessionInfo } from "../../tauri/commands";

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  output?: string;
}

export interface Conversation {
  id: string;
  clusterContext: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface PendingAnalysis {
  message: string;
  clusterContext: string;
  namespace?: string;
}

export interface AIState {
  currentSessionId: string | null;
  isSessionActive: boolean;
  conversations: Record<string, Conversation>;
  currentConversationId: string | null;
  isThinking: boolean;
  isStreaming: boolean;
  isInterrupted: boolean;
  error: string | null;
  pendingAnalysis: PendingAnalysis | null;

  startSession: (clusterContext: string, currentNamespace?: string) => Promise<string>;
  sendMessage: (message: string, displayMessage?: string) => Promise<void>;
  interrupt: () => Promise<void>;
  stopSession: () => Promise<void>;
  markSessionEnded: () => void;
  refreshSessions: () => Promise<SessionInfo[]>;

  appendMessageChunk: (content: string, done: boolean) => void;
  finalizeStreaming: () => void;
  setThinking: (thinking: boolean) => void;
  addToolCall: (toolCall: ToolCall) => void;

  getConversation: (clusterContext: string) => Conversation | undefined;
  clearConversation: (clusterContext: string) => void;

  loadSavedSession: (
    sessionId: string,
    messages: MessageRecord[],
    clusterContext: string
  ) => void;
  updateSessionTitle: (sessionId: string, title: string) => Promise<void>;

  setPendingAnalysis: (analysis: PendingAnalysis | null) => void;
  clearPendingAnalysis: () => void;
  getPendingAnalysis: () => PendingAnalysis | null;

  setError: (error: string | null) => void;
  clearError: () => void;
}

export type AIStateValues = Pick<
  AIState,
  | "currentSessionId"
  | "isSessionActive"
  | "conversations"
  | "currentConversationId"
  | "isThinking"
  | "isStreaming"
  | "isInterrupted"
  | "error"
  | "pendingAnalysis"
>;

export type AISetState = Parameters<StateCreator<AIState>>[0];
export type AIGetState = Parameters<StateCreator<AIState>>[1];
