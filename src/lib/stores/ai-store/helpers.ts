import type {
  ChatMessage,
  Conversation,
  MessageRole,
} from "./types";
import type { MessageRecord } from "../../tauri/commands";

export const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function buildFallbackSystemPrompt(clusterContext: string): string {
  return `You are an AI assistant helping manage a Kubernetes cluster.
Current cluster context: ${clusterContext}
You can help with:
- Analyzing pod status and health
- Troubleshooting deployment issues
- Explaining Kubernetes resources
- Suggesting optimizations

Be concise and helpful. When referencing resources, include the namespace and name.`;
}

export function findConversationById(
  conversations: Record<string, Conversation>,
  currentConversationId: string | null
): Conversation | undefined {
  return Object.values(conversations).find((conversation) => {
    return conversation.id === currentConversationId;
  });
}

export function finalizeStreamingMessage(
  conversation: Conversation
): Conversation {
  const messages = [...conversation.messages];
  const lastMessage = messages[messages.length - 1];

  if (
    !lastMessage ||
    lastMessage.role !== "assistant" ||
    !lastMessage.isStreaming
  ) {
    return conversation;
  }

  messages[messages.length - 1] = { ...lastMessage, isStreaming: false };
  return { ...conversation, messages, updatedAt: Date.now() };
}

// Character budget for the transcript injected when resuming a session.
// Oldest messages are dropped first when the history exceeds it.
export const RESUME_CONTEXT_MAX_CHARS = 10000;

/**
 * Builds a compact transcript of prior messages so a resumed session's
 * fresh backend CLI process knows what was already discussed.
 * Returns null when there is no usable history.
 */
export function buildResumeContext(messages: ChatMessage[]): string | null {
  const lines: string[] = [];
  let total = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    const { role, content } = messages[i];
    if ((role !== "user" && role !== "assistant") || !content.trim()) continue;

    const line = `${role === "user" ? "User" : "Assistant"}: ${content.trim()}`;
    if (total + line.length > RESUME_CONTEXT_MAX_CHARS) {
      // Keep at least the most recent message, truncated to the budget.
      if (lines.length === 0) {
        lines.unshift(line.slice(0, RESUME_CONTEXT_MAX_CHARS));
      }
      break;
    }
    lines.unshift(line);
    total += line.length;
  }

  if (lines.length === 0) return null;

  return `## Previous conversation
This session was resumed. The prior exchange with the user (oldest first):

${lines.join("\n\n")}`;
}

export function toChatMessages(records: MessageRecord[]): ChatMessage[] {
  return records.map((record) => ({
    id: record.message_id,
    role: record.role as MessageRole,
    content: record.content,
    timestamp: new Date(record.timestamp).getTime(),
    toolCalls: record.tool_calls ? JSON.parse(record.tool_calls) : undefined,
  }));
}
