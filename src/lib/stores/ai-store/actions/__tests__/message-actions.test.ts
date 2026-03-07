jest.mock("../../../../tauri/commands", () => ({
  aiUpdateMessage: jest.fn(),
}));

import { aiUpdateMessage } from "../../../../tauri/commands";
import { createMessageActions } from "../message-actions";

function createHarness(overrides: Record<string, unknown> = {}) {
  const assistantMessage = {
    id: "assistant-1",
    role: "assistant",
    content: "Hello",
    timestamp: 1,
    isStreaming: true,
    toolCalls: [{ name: "kubectl", status: "pending" }],
  };

  const state = {
    currentSessionId: "session-1",
    currentConversationId: "conv-1",
    conversations: {
      kind: {
        id: "conv-1",
        clusterContext: "kind",
        messages: [assistantMessage],
        createdAt: 1,
        updatedAt: 1,
      },
    },
    isStreaming: false,
    isThinking: false,
    ...overrides,
  };

  const set = (update: unknown) => {
    if (typeof update === "function") {
      Object.assign(state, update(state));
      return;
    }
    Object.assign(state, update);
  };

  return {
    state,
    actions: createMessageActions(set as never, (() => state) as never),
  };
}

describe("createMessageActions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (aiUpdateMessage as jest.Mock).mockResolvedValue(undefined);
  });

  it("appends streaming chunks and persists the final assistant message", async () => {
    const { state, actions } = createHarness();

    actions.appendMessageChunk(" world", false);
    expect(state.conversations.kind.messages[0]).toMatchObject({
      content: "Hello world",
      isStreaming: true,
    });
    expect(state.isStreaming).toBe(true);
    expect(state.isThinking).toBe(true);
    expect(aiUpdateMessage).not.toHaveBeenCalled();

    actions.appendMessageChunk("!", true);
    expect(state.conversations.kind.messages[0]).toMatchObject({
      content: "Hello world!",
      isStreaming: false,
    });
    expect(aiUpdateMessage).toHaveBeenCalledWith(
      "assistant-1",
      "Hello world!",
      JSON.stringify([{ name: "kubectl", status: "pending" }])
    );
    expect(state.isStreaming).toBe(false);
    expect(state.isThinking).toBe(false);
  });

  it("warns when persistence fails but still updates local state", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    (aiUpdateMessage as jest.Mock).mockRejectedValueOnce(new Error("db down"));
    const { state, actions } = createHarness();

    actions.appendMessageChunk("!", true);
    await Promise.resolve();

    expect(state.conversations.kind.messages[0].content).toBe("Hello!");
    expect(console.warn).toHaveBeenCalled();
  });

  it("adds tool calls to the active assistant message", () => {
    const { state, actions } = createHarness();

    actions.addToolCall({ name: "describe", status: "completed", output: "ok" });

    expect(state.conversations.kind.messages[0].toolCalls).toEqual([
      { name: "kubectl", status: "pending" },
      { name: "describe", status: "completed", output: "ok" },
    ]);
  });

  it("supports reading, clearing, and ignoring missing conversations", () => {
    const { state, actions } = createHarness();

    expect(actions.getConversation("kind")).toEqual(state.conversations.kind);
    actions.clearConversation("kind");
    expect(actions.getConversation("kind")).toBeUndefined();

    const missing = createHarness({ currentConversationId: "missing" });
    missing.actions.appendMessageChunk("no-op", true);
    missing.actions.addToolCall({ name: "ignored", status: "failed" });
    expect(missing.state.conversations.kind.messages[0].content).toBe("Hello");
  });

  it("can directly toggle the thinking state", () => {
    const { state, actions } = createHarness();

    actions.setThinking(true);
    expect(state.isThinking).toBe(true);
  });
});
