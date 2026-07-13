import {
  aiGetSystemPrompt,
  aiInterrupt,
  aiSaveMessage,
  aiSaveSession,
  aiSendMessage,
  aiStartSession,
  aiStopSession,
  type AiCliProvider,
} from "../../../tauri/commands";
import { useUIStore } from "../../ui-store";
import {
  buildFallbackSystemPrompt,
  buildResumeContext,
  finalizeStreamingMessage,
  findConversationById,
  generateId,
  getErrorMessage,
  toChatMessages,
} from "../helpers";
import type { AIGetState, AISetState, AIState, ChatMessage } from "../types";

type SessionActions = Pick<
  AIState,
  | "startSession"
  | "sendMessage"
  | "interrupt"
  | "stopSession"
  | "markSessionEnded"
  | "loadSavedSession"
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

        // When resuming a conversation with stored history, the backend CLI
        // session is brand new and has no memory of it - inject a compact
        // transcript so the model keeps the context the UI displays.
        const priorMessages =
          get().conversations[clusterContext]?.messages ?? [];
        const resumeContext = buildResumeContext(priorMessages);
        if (resumeContext) {
          initialContext = `${initialContext}\n\n${resumeContext}`;
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
          // permission_mode column kept for schema compat; approval layer removed
          await aiSaveSession(sessionId, clusterContext, "default");
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

    sendMessage: async (message: string, displayMessage?: string) => {
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
        content: displayMessage ?? message,
        timestamp: Date.now(),
      };

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
      };

      // Clearing isInterrupted here is safe: the backend suppresses all
      // post-kill emissions for an interrupted generation, so by the time a
      // user sends the next message no stale chunks can still be in flight —
      // while clearing only after aiSendMessage resolves could drop the NEW
      // generation's first chunks (the invoke returns before the CLI spawns,
      // but its promise continuation may run after the first emission).
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
        isInterrupted: false,
      }));

      try {
        // Persist the display message - the enriched version (with view
        // context prefix) is only needed for the live send.
        await aiSaveMessage(
          userMessage.id,
          currentSessionId,
          "user",
          userMessage.content
        );
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
      const { currentSessionId, currentConversationId, conversations } = get();
      if (!currentSessionId) {
        return;
      }

      // Finalize immediately - the backend stop is async and chunks may
      // still arrive afterwards; appendMessageChunk ignores them while
      // isInterrupted is set.
      const conversation = findConversationById(
        conversations,
        currentConversationId
      );
      set((state) => ({
        isStreaming: false,
        isThinking: false,
        isInterrupted: true,
        conversations: conversation
          ? {
              ...state.conversations,
              [conversation.clusterContext]:
                finalizeStreamingMessage(conversation),
            }
          : state.conversations,
      }));

      try {
        await aiInterrupt(currentSessionId);
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

      // Stop cancels the running generation and ends the backend session,
      // but keeps the conversation - the chat history must survive a Stop.
      // isInterrupted guards against chunks still in flight after the kill.
      const conversation = findConversationById(conversations, currentConversationId);
      set((state) => ({
        conversations: conversation
          ? {
              ...state.conversations,
              [conversation.clusterContext]:
                finalizeStreamingMessage(conversation),
            }
          : state.conversations,
        currentSessionId: null,
        currentConversationId: null,
        isSessionActive: false,
        isStreaming: false,
        isThinking: false,
        isInterrupted: true,
      }));
    },

    markSessionEnded: () => {
      const { currentConversationId, conversations } = get();
      const conversation = findConversationById(
        conversations,
        currentConversationId
      );

      set((state) => ({
        isSessionActive: false,
        isStreaming: false,
        isThinking: false,
        conversations: conversation
          ? {
              ...state.conversations,
              [conversation.clusterContext]:
                finalizeStreamingMessage(conversation),
            }
          : state.conversations,
      }));
    },

    loadSavedSession: (sessionId, messages, clusterContext) => {
      const chatMessages = toChatMessages(messages);
      const conversationId = generateId();

      set((state) => ({
        currentSessionId: sessionId,
        isSessionActive: false,
        isStreaming: false,
        isThinking: false,
        isInterrupted: false,
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
  };
}
