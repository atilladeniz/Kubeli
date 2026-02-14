import { aiUpdateMessage } from "../../tauri/commands";
import { findConversationById } from "./helpers";
import type { AIGetState, AISetState, AIState, ToolCall } from "./types";

type MessageActions = Pick<
  AIState,
  | "appendMessageChunk"
  | "setThinking"
  | "addToolCall"
  | "getConversation"
  | "clearConversation"
>;

export function createMessageActions(
  set: AISetState,
  get: AIGetState
): MessageActions {
  return {
    appendMessageChunk: (content: string, done: boolean) => {
      const { currentConversationId, currentSessionId, conversations } = get();
      const conversation = findConversationById(conversations, currentConversationId);
      if (!conversation) {
        return;
      }

      const messages = [...conversation.messages];
      const lastMessage = messages[messages.length - 1];

      if (lastMessage && lastMessage.role === "assistant" && lastMessage.isStreaming) {
        const newContent = lastMessage.content + content;
        messages[messages.length - 1] = {
          ...lastMessage,
          content: newContent,
          isStreaming: !done,
        };

        if (done && currentSessionId) {
          const toolCallsJson = lastMessage.toolCalls
            ? JSON.stringify(lastMessage.toolCalls)
            : undefined;
          aiUpdateMessage(lastMessage.id, newContent, toolCallsJson).catch((error) => {
            console.warn("Failed to update message in database:", error);
          });
        }
      }

      set((state) => ({
        conversations: {
          ...state.conversations,
          [conversation.clusterContext]: {
            ...conversation,
            messages,
            updatedAt: Date.now(),
          },
        },
        isStreaming: !done,
        isThinking: !done,
      }));
    },

    setThinking: (thinking: boolean) => {
      set({ isThinking: thinking });
    },

    addToolCall: (toolCall: ToolCall) => {
      const { currentConversationId, conversations } = get();
      const conversation = findConversationById(conversations, currentConversationId);
      if (!conversation) {
        return;
      }

      const messages = [...conversation.messages];
      const lastMessage = messages[messages.length - 1];

      if (lastMessage && lastMessage.role === "assistant") {
        messages[messages.length - 1] = {
          ...lastMessage,
          toolCalls: [...(lastMessage.toolCalls || []), toolCall],
        };

        set((state) => ({
          conversations: {
            ...state.conversations,
            [conversation.clusterContext]: {
              ...conversation,
              messages,
              updatedAt: Date.now(),
            },
          },
        }));
      }
    },

    getConversation: (clusterContext: string) => {
      return get().conversations[clusterContext];
    },

    clearConversation: (clusterContext: string) => {
      set((state) => {
        const { [clusterContext]: _removed, ...rest } = state.conversations;
        return { conversations: rest };
      });
    },
  };
}
