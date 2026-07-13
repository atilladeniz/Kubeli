import { create } from "zustand";
import { createControlActions } from "./actions/control-actions";
import { createMessageActions } from "./actions/message-actions";
import { createSessionActions } from "./actions/session-actions";
import { initialAIState } from "./state";
import type {
  AIState,
  ChatMessage,
  Conversation,
  MessageRole,
  PendingAnalysis,
  ToolCall,
} from "./types";

export const useAIStore = create<AIState>()((set, get) => ({
  ...initialAIState,
  ...createSessionActions(set, get),
  ...createMessageActions(set, get),
  ...createControlActions(set),
}));

export type {
  ChatMessage,
  Conversation,
  MessageRole,
  PendingAnalysis,
  ToolCall,
};
