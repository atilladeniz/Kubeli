import type { AIStateValues } from "./types";

export const initialAIState: AIStateValues = {
  currentSessionId: null,
  isSessionActive: false,
  conversations: {},
  currentConversationId: null,
  isThinking: false,
  isStreaming: false,
  error: null,
  permissionMode: "default",
  pendingApproval: null,
  pendingAnalysis: null,
};
