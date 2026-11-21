import type { AIStateValues } from "./types";

export const initialAIState: AIStateValues = {
  currentSessionId: null,
  sessionProvider: null,
  isSessionActive: false,
  conversations: {},
  currentConversationId: null,
  isThinking: false,
  isStreaming: false,
  isInterrupted: false,
  error: null,
  pendingAnalysis: null,
};
