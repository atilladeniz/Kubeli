import {
  buildFallbackSystemPrompt,
  findConversationById,
  generateId,
  getErrorMessage,
  removeConversationByClusterContext,
  STORE_NAME,
  toChatMessages,
} from "../helpers";
import type { Conversation } from "../types";

describe("ai-store helpers", () => {
  it("exposes the expected store name", () => {
    expect(STORE_NAME).toBe("kubeli-ai-store");
  });

  it("builds ids from the current timestamp and random suffix", () => {
    jest.spyOn(Date, "now").mockReturnValue(1700000000000);
    jest.spyOn(Math, "random").mockReturnValue(0.123456789);

    expect(generateId()).toBe("1700000000000-4fzzzxjyl");
  });

  it("extracts helper error messages with a fallback", () => {
    expect(getErrorMessage(new Error("boom"), "fallback")).toBe("boom");
    expect(getErrorMessage("nope", "fallback")).toBe("fallback");
  });

  it("builds a fallback system prompt for a cluster", () => {
    const prompt = buildFallbackSystemPrompt("kind-dev");

    expect(prompt).toContain("Current cluster context: kind-dev");
    expect(prompt).toContain("Analyzing pod status and health");
  });

  it("finds and removes conversations by cluster context", () => {
    const conversations: Record<string, Conversation> = {
      alpha: {
        id: "conv-1",
        clusterContext: "alpha",
        messages: [],
        createdAt: 1,
        updatedAt: 1,
      },
      beta: {
        id: "conv-2",
        clusterContext: "beta",
        messages: [],
        createdAt: 2,
        updatedAt: 2,
      },
    };

    expect(findConversationById(conversations, "conv-2")).toEqual(conversations.beta);
    expect(findConversationById(conversations, null)).toBeUndefined();
    expect(removeConversationByClusterContext(conversations, "alpha")).toEqual({
      beta: conversations.beta,
    });
  });

  it("maps stored message records to chat messages", () => {
    const messages = toChatMessages([
      {
        message_id: "m1",
        session_id: "s1",
        role: "assistant",
        content: "done",
        tool_calls: JSON.stringify([{ name: "kubectl", status: "completed" }]),
        timestamp: "2026-03-07T10:00:00.000Z",
      },
      {
        message_id: "m2",
        session_id: "s1",
        role: "user",
        content: "hi",
        tool_calls: null,
        timestamp: "2026-03-07T10:01:00.000Z",
      },
    ]);

    expect(messages).toEqual([
      {
        id: "m1",
        role: "assistant",
        content: "done",
        timestamp: new Date("2026-03-07T10:00:00.000Z").getTime(),
        toolCalls: [{ name: "kubectl", status: "completed" }],
      },
      {
        id: "m2",
        role: "user",
        content: "hi",
        timestamp: new Date("2026-03-07T10:01:00.000Z").getTime(),
        toolCalls: undefined,
      },
    ]);
  });
});
