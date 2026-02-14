import type {
  ChatMessage,
  Conversation,
  MessageRole,
} from "./types";
import type { MessageRecord } from "../../tauri/commands";

export const STORE_NAME = "kubeli-ai-store";

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

export function removeConversationByClusterContext(
  conversations: Record<string, Conversation>,
  clusterContext: string
): Record<string, Conversation> {
  const { [clusterContext]: _removed, ...rest } = conversations;
  return rest;
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
