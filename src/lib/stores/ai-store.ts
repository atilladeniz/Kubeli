import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  aiStartSession,
  aiSendMessage,
  aiInterrupt,
  aiStopSession,
  aiListSessions,
  aiGetSystemPrompt,
  aiGetPermissionMode,
  aiSetPermissionMode,
  aiApproveAction,
  aiRejectAction,
  aiSaveSession,
  aiSaveMessage,
  aiUpdateMessage,
  aiUpdateSessionTitle,
  type SessionInfo,
  type PermissionMode,
  type ApprovalRequest,
  type MessageRecord,
  type AiCliProvider,
} from "../tauri/commands";
import { useUIStore } from "./ui-store";

// Message role
export type MessageRole = "user" | "assistant" | "system";

// Message in a conversation
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  toolCalls?: ToolCall[];
}

// Tool call made by the assistant
export interface ToolCall {
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  output?: string;
}

// Conversation state
export interface Conversation {
  id: string;
  clusterContext: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface AIState {
  // Current session
  currentSessionId: string | null;
  isSessionActive: boolean;

  // Conversation
  conversations: Record<string, Conversation>;
  currentConversationId: string | null;

  // UI state
  isThinking: boolean;
  isStreaming: boolean;
  error: string | null;

  // Permission mode
  permissionMode: PermissionMode;

  // Pending approval
  pendingApproval: ApprovalRequest | null;

  // Pending analysis (queued message to send when AI opens)
  pendingAnalysis: {
    message: string;
    clusterContext: string;
    namespace?: string;
  } | null;

  // Actions
  startSession: (clusterContext: string, currentNamespace?: string) => Promise<string>;
  sendMessage: (message: string) => Promise<void>;
  interrupt: () => Promise<void>;
  stopSession: () => Promise<void>;
  refreshSessions: () => Promise<SessionInfo[]>;

  // Message handling
  appendMessageChunk: (content: string, done: boolean) => void;
  setThinking: (thinking: boolean) => void;
  addToolCall: (toolCall: ToolCall) => void;

  // Conversation management
  getConversation: (clusterContext: string) => Conversation | undefined;
  clearConversation: (clusterContext: string) => void;

  // Session persistence
  loadSavedSession: (sessionId: string, messages: MessageRecord[], clusterContext: string) => void;
  updateSessionTitle: (sessionId: string, title: string) => Promise<void>;

  // Permission handling
  getPermissionMode: () => Promise<PermissionMode>;
  setPermissionMode: (mode: PermissionMode) => Promise<void>;

  // Approval handling
  setApprovalRequest: (request: ApprovalRequest | null) => void;
  approveAction: (requestId: string) => Promise<void>;
  rejectAction: (requestId: string, reason?: string) => Promise<void>;

  // Pending analysis handling
  setPendingAnalysis: (analysis: { message: string; clusterContext: string; namespace?: string } | null) => void;
  clearPendingAnalysis: () => void;
  getPendingAnalysis: () => { message: string; clusterContext: string; namespace?: string } | null;

  // Error handling
  setError: (error: string | null) => void;
  clearError: () => void;
}

// Generate unique ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
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

      startSession: async (clusterContext: string, currentNamespace?: string) => {
        set({ error: null, isThinking: true });
        try {
          // Get the AI provider from UI settings
          const provider = useUIStore.getState().settings.aiCliProvider || "claude";

          // Build dynamic context from cluster state
          let initialContext: string;
          try {
            initialContext = await aiGetSystemPrompt(clusterContext, currentNamespace);
          } catch (e) {
            // Fallback to basic context if context building fails
            console.warn("Failed to build cluster context, using fallback:", e);
            initialContext = `You are an AI assistant helping manage a Kubernetes cluster.
Current cluster context: ${clusterContext}
You can help with:
- Analyzing pod status and health
- Troubleshooting deployment issues
- Explaining Kubernetes resources
- Suggesting optimizations

Be concise and helpful. When referencing resources, include the namespace and name.`;
          }

          const sessionId = await aiStartSession(clusterContext, initialContext, provider as AiCliProvider);

          // Create or get conversation for this cluster
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

          // Save session to database
          try {
            await aiSaveSession(sessionId, clusterContext, get().permissionMode);
          } catch (e) {
            console.warn("Failed to save session to database:", e);
          }

          return sessionId;
        } catch (e) {
          const error = e instanceof Error ? e.message : "Failed to start session";
          set({ error, isThinking: false });
          throw new Error(error);
        }
      },

      sendMessage: async (message: string) => {
        const { currentSessionId, currentConversationId, conversations } = get();
        if (!currentSessionId) {
          throw new Error("No active session");
        }

        // Find conversation by session's cluster context
        const conversation = Object.values(conversations).find(
          (c) => c.id === currentConversationId
        );
        if (!conversation) {
          throw new Error("No active conversation");
        }

        // Add user message
        const userMessage: ChatMessage = {
          id: generateId(),
          role: "user",
          content: message,
          timestamp: Date.now(),
        };

        // Add placeholder for assistant response
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

        // Save user message to database
        try {
          await aiSaveMessage(userMessage.id, currentSessionId, "user", message);
        } catch (e) {
          console.warn("Failed to save user message:", e);
        }

        // Save assistant placeholder (will be updated when streaming completes)
        try {
          await aiSaveMessage(assistantMessage.id, currentSessionId, "assistant", "");
        } catch (e) {
          console.warn("Failed to save assistant message:", e);
        }

        try {
          await aiSendMessage(currentSessionId, message);
        } catch (e) {
          set({
            error: e instanceof Error ? e.message : "Failed to send message",
            isStreaming: false,
            isThinking: false,
          });
        }
      },

      interrupt: async () => {
        const { currentSessionId } = get();
        if (currentSessionId) {
          try {
            await aiInterrupt(currentSessionId);
            set({ isStreaming: false, isThinking: false });
          } catch (e) {
            set({ error: e instanceof Error ? e.message : "Failed to interrupt" });
          }
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

        // Find and clear the current conversation
        const conversation = Object.values(conversations).find(
          (c) => c.id === currentConversationId
        );
        const clusterContext = conversation?.clusterContext;

        // Remove conversation from state
        if (clusterContext) {
          set((state) => {
            const { [clusterContext]: _removed, ...rest } = state.conversations;
            return {
              conversations: rest,
              currentSessionId: null,
              currentConversationId: null,
              isSessionActive: false,
              isStreaming: false,
              isThinking: false,
            };
          });
        } else {
          set({
            currentSessionId: null,
            currentConversationId: null,
            isSessionActive: false,
            isStreaming: false,
            isThinking: false,
          });
        }
      },

      refreshSessions: async () => {
        return await aiListSessions();
      },

      appendMessageChunk: (content: string, done: boolean) => {
        const { currentConversationId, currentSessionId, conversations } = get();
        const conversation = Object.values(conversations).find(
          (c) => c.id === currentConversationId
        );
        if (!conversation) return;

        const messages = [...conversation.messages];
        const lastMessage = messages[messages.length - 1];

        if (lastMessage && lastMessage.role === "assistant" && lastMessage.isStreaming) {
          const newContent = lastMessage.content + content;
          messages[messages.length - 1] = {
            ...lastMessage,
            content: newContent,
            isStreaming: !done,
          };

          // When streaming completes, save the final message to database
          if (done && currentSessionId) {
            const toolCallsJson = lastMessage.toolCalls
              ? JSON.stringify(lastMessage.toolCalls)
              : undefined;
            aiUpdateMessage(lastMessage.id, newContent, toolCallsJson).catch((e) => {
              console.warn("Failed to update message in database:", e);
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
        const conversation = Object.values(conversations).find(
          (c) => c.id === currentConversationId
        );
        if (!conversation) return;

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

      loadSavedSession: (sessionId: string, messages: MessageRecord[], clusterContext: string) => {
        // Convert MessageRecord to ChatMessage
        const chatMessages: ChatMessage[] = messages.map((msg) => ({
          id: msg.message_id,
          role: msg.role as MessageRole,
          content: msg.content,
          timestamp: new Date(msg.timestamp).getTime(),
          toolCalls: msg.tool_calls ? JSON.parse(msg.tool_calls) : undefined,
        }));

        const conversationId = generateId();

        set((state) => ({
          currentSessionId: sessionId,
          isSessionActive: false, // Not an active CLI session, just viewing history
          currentConversationId: conversationId,
          conversations: {
            ...state.conversations,
            [clusterContext]: {
              id: conversationId,
              clusterContext,
              messages: chatMessages,
              createdAt: chatMessages[0]?.timestamp || Date.now(),
              updatedAt: chatMessages[chatMessages.length - 1]?.timestamp || Date.now(),
            },
          },
        }));
      },

      updateSessionTitle: async (sessionId: string, title: string) => {
        try {
          await aiUpdateSessionTitle(sessionId, title);
        } catch (e) {
          console.error("Failed to update session title:", e);
        }
      },

      getPermissionMode: async () => {
        try {
          const mode = await aiGetPermissionMode();
          set({ permissionMode: mode });
          return mode;
        } catch (e) {
          console.error("Failed to get permission mode:", e);
          return get().permissionMode;
        }
      },

      setPermissionMode: async (mode: PermissionMode) => {
        try {
          await aiSetPermissionMode(mode);
          set({ permissionMode: mode });
        } catch (e) {
          set({ error: e instanceof Error ? e.message : "Failed to set permission mode" });
        }
      },

      setApprovalRequest: (request) => {
        set({ pendingApproval: request });
      },

      approveAction: async (requestId: string) => {
        try {
          await aiApproveAction(requestId);
          set({ pendingApproval: null });
        } catch (e) {
          set({ error: e instanceof Error ? e.message : "Failed to approve action" });
        }
      },

      rejectAction: async (requestId: string, reason?: string) => {
        try {
          await aiRejectAction(requestId, reason);
          set({ pendingApproval: null });
        } catch (e) {
          set({ error: e instanceof Error ? e.message : "Failed to reject action" });
        }
      },

      setPendingAnalysis: (analysis) => {
        set({ pendingAnalysis: analysis });
      },

      clearPendingAnalysis: () => {
        set({ pendingAnalysis: null });
      },

      getPendingAnalysis: () => {
        return get().pendingAnalysis;
      },

      setError: (error: string | null) => {
        set({ error });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: "kubeli-ai-store",
      // Don't persist anything - fresh sessions on app restart
      partialize: () => ({}),
    }
  )
);
