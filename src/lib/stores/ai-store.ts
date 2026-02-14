import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  STORE_NAME,
  createControlActions,
  createMessageActions,
  createSessionActions,
  initialAIState,
  type AIState,
  type ChatMessage,
  type Conversation,
  type MessageRole,
  type PendingAnalysis,
  type ToolCall,
} from "./ai-store-modules";

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
