import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createControlActions } from "./actions/control-actions";
import { createMessageActions } from "./actions/message-actions";
import { createSessionActions } from "./actions/session-actions";
import { STORE_NAME } from "./helpers";
import { initialAIState } from "./state";
import type {
  AIState,
  ChatMessage,
  Conversation,
  MessageRole,
  PendingAnalysis,
  ToolCall,
} from "./types";

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      ...initialAIState,
      ...createSessionActions(set, get),
      ...createMessageActions(set, get),
      ...createControlActions(set, get),
    }),
    {
      name: STORE_NAME,
      // Don't persist anything - fresh sessions on app restart
      partialize: () => ({}),
    }
  )
);

export type {
  ChatMessage,
  Conversation,
  MessageRole,
  PendingAnalysis,
  ToolCall,
};
