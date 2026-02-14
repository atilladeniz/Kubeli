import {
  aiGetSystemPrompt,
  aiInterrupt,
  aiListSessions,
  aiSaveMessage,
  aiSaveSession,
  aiSendMessage,
  aiStartSession,
  aiStopSession,
  aiUpdateSessionTitle,
  type AiCliProvider,
} from "../../tauri/commands";
import { useUIStore } from "../ui-store";
import {
  buildFallbackSystemPrompt,
  findConversationById,
  generateId,
  getErrorMessage,
  removeConversationByClusterContext,
  toChatMessages,
} from "./helpers";
import type { AIGetState, AISetState, AIState, ChatMessage } from "./types";

type SessionActions = Pick<
  AIState,
  | "startSession"
  | "sendMessage"
  | "interrupt"
  | "stopSession"
  | "refreshSessions"
  | "loadSavedSession"
  | "updateSessionTitle"
>;

export function createSessionActions(
  set: AISetState,
  get: AIGetState
): SessionActions {
  return {
    startSession: async (clusterContext: string, currentNamespace?: string) => {
      set({ error: null, isThinking: true });

      try {
        const provider = useUIStore.getState().settings.aiCliProvider || "claude";

        let initialContext: string;
        try {
          initialContext = await aiGetSystemPrompt(clusterContext, currentNamespace);
        } catch (error) {
          console.warn("Failed to build cluster context, using fallback:", error);
          initialContext = buildFallbackSystemPrompt(clusterContext);
        }

        const sessionId = await aiStartSession(
          clusterContext,
          initialContext,
          provider as AiCliProvider
        );

        let conversationId = get().currentConversationId;
        const existingConversation = get().conversations[clusterContext];

        if (!existingConversation) {
          conversationId = generateId();
          set((state) => ({
            conversations: {
              ...state.conversations,
              [clusterContext]: {
                id: conversationId!,
                clusterContext,
                messages: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            },
          }));
        } else {
          conversationId = existingConversation.id;
        }

        set({
          currentSessionId: sessionId,
          isSessionActive: true,
          currentConversationId: conversationId,
          isThinking: false,
        });

        try {
          await aiSaveSession(sessionId, clusterContext, get().permissionMode);
        } catch (error) {
          console.warn("Failed to save session to database:", error);
        }

        return sessionId;
      } catch (error) {
        const message = getErrorMessage(error, "Failed to start session");
        set({ error: message, isThinking: false });
        throw new Error(message);
      }
    },

    sendMessage: async (message: string) => {
      const { currentSessionId, currentConversationId, conversations } = get();
      if (!currentSessionId) {
        throw new Error("No active session");
      }

      const conversation = findConversationById(
        conversations,
        currentConversationId
      );
      if (!conversation) {
        throw new Error("No active conversation");
      }

      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: message,
        timestamp: Date.now(),
      };

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
      };

      set((state) => ({
        conversations: {
          ...state.conversations,
          [conversation.clusterContext]: {
            ...conversation,
            messages: [...conversation.messages, userMessage, assistantMessage],
            updatedAt: Date.now(),
          },
        },
        isStreaming: true,
        isThinking: true,
      }));

      try {
        await aiSaveMessage(userMessage.id, currentSessionId, "user", message);
      } catch (error) {
        console.warn("Failed to save user message:", error);
      }

      try {
        await aiSaveMessage(assistantMessage.id, currentSessionId, "assistant", "");
      } catch (error) {
        console.warn("Failed to save assistant message:", error);
      }

      try {
        await aiSendMessage(currentSessionId, message);
      } catch (error) {
        set({
          error: getErrorMessage(error, "Failed to send message"),
          isStreaming: false,
          isThinking: false,
        });
      }
    },

    interrupt: async () => {
      const { currentSessionId } = get();
      if (!currentSessionId) {
        return;
      }

      try {
        await aiInterrupt(currentSessionId);
        set({ isStreaming: false, isThinking: false });
      } catch (error) {
        set({ error: getErrorMessage(error, "Failed to interrupt") });
      }
    },

    stopSession: async () => {
      const { currentSessionId, currentConversationId, conversations } = get();
      if (currentSessionId) {
        try {
          await aiStopSession(currentSessionId);
        } catch {
          // Ignore errors when stopping
        }
      }

      const conversation = findConversationById(conversations, currentConversationId);
      const clusterContext = conversation?.clusterContext;

      if (clusterContext) {
        set((state) => ({
          conversations: removeConversationByClusterContext(
            state.conversations,
            clusterContext
          ),
          currentSessionId: null,
          currentConversationId: null,
          isSessionActive: false,
          isStreaming: false,
          isThinking: false,
        }));
        return;
      }

      set({
        currentSessionId: null,
        currentConversationId: null,
        isSessionActive: false,
        isStreaming: false,
        isThinking: false,
      });
    },

    refreshSessions: async () => {
      return await aiListSessions();
    },

    loadSavedSession: (sessionId, messages, clusterContext) => {
      const chatMessages = toChatMessages(messages);
      const conversationId = generateId();

      set((state) => ({
        currentSessionId: sessionId,
        isSessionActive: false,
        currentConversationId: conversationId,
        conversations: {
          ...state.conversations,
          [clusterContext]: {
            id: conversationId,
            clusterContext,
            messages: chatMessages,
            createdAt: chatMessages[0]?.timestamp || Date.now(),
            updatedAt:
              chatMessages[chatMessages.length - 1]?.timestamp || Date.now(),
          },
        },
      }));
    },

    updateSessionTitle: async (sessionId, title) => {
      try {
        await aiUpdateSessionTitle(sessionId, title);
      } catch (error) {
        console.error("Failed to update session title:", error);
      }
    },
  };
}
