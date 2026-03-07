jest.mock("../../../../tauri/commands", () => ({
  aiGetSystemPrompt: jest.fn(),
  aiInterrupt: jest.fn(),
  aiListSessions: jest.fn(),
  aiSaveMessage: jest.fn(),
  aiSaveSession: jest.fn(),
  aiSendMessage: jest.fn(),
  aiStartSession: jest.fn(),
  aiStopSession: jest.fn(),
  aiUpdateSessionTitle: jest.fn(),
}));

jest.mock("../../../ui-store", () => ({
  useUIStore: {
    getState: jest.fn(),
  },
}));

jest.mock("../../helpers", () => {
  const actual = jest.requireActual("../../helpers");
  return {
    ...actual,
    buildFallbackSystemPrompt: jest.fn((clusterContext: string) => `fallback:${clusterContext}`),
    generateId: jest.fn(),
  };
});

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
} from "../../../../tauri/commands";
import { useUIStore } from "../../../ui-store";
import { buildFallbackSystemPrompt, generateId } from "../../helpers";
import { createSessionActions } from "../session-actions";

type HarnessConversation = {
  id: string;
  clusterContext: string;
  messages: Array<Record<string, unknown>>;
  createdAt: number;
  updatedAt: number;
};

type HarnessState = {
  currentSessionId: string | null;
  isSessionActive: boolean;
  conversations: Record<string, HarnessConversation>;
  currentConversationId: string | null;
  isThinking: boolean;
  isStreaming: boolean;
  error: string | null;
  permissionMode: "default" | "plan" | "acceptedits";
  pendingApproval: unknown;
  pendingAnalysis: unknown;
};

function createHarness(overrides: Record<string, unknown> = {}) {
  const state: HarnessState = {
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
    ...(overrides as Partial<HarnessState>),
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
    actions: createSessionActions(set as never, (() => state) as never),
  };
}

describe("createSessionActions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(1700000000000);
    (useUIStore.getState as jest.Mock).mockReturnValue({
      settings: { aiCliProvider: "claude" },
    });
    (generateId as jest.Mock).mockReturnValue("generated-id");
    (aiGetSystemPrompt as jest.Mock).mockResolvedValue("system prompt");
    (aiStartSession as jest.Mock).mockResolvedValue("session-1");
    (aiSaveSession as jest.Mock).mockResolvedValue(undefined);
    (aiSaveMessage as jest.Mock).mockResolvedValue(undefined);
    (aiSendMessage as jest.Mock).mockResolvedValue(undefined);
    (aiInterrupt as jest.Mock).mockResolvedValue(undefined);
    (aiStopSession as jest.Mock).mockResolvedValue(undefined);
    (aiListSessions as jest.Mock).mockResolvedValue([{ session_id: "s1" }]);
    (aiUpdateSessionTitle as jest.Mock).mockResolvedValue(undefined);
  });

  it("starts a new session, creates a conversation, and persists the session", async () => {
    (useUIStore.getState as jest.Mock).mockReturnValue({
      settings: { aiCliProvider: "codex" },
    });
    (generateId as jest.Mock).mockReturnValueOnce("conversation-1");
    const { state, actions } = createHarness();

    await expect(actions.startSession("kind-dev", "default")).resolves.toBe("session-1");

    expect(aiGetSystemPrompt).toHaveBeenCalledWith("kind-dev", "default");
    expect(aiStartSession).toHaveBeenCalledWith(
      "kind-dev",
      "system prompt",
      "codex"
    );
    expect(state.conversations).toEqual({
      "kind-dev": {
        id: "conversation-1",
        clusterContext: "kind-dev",
        messages: [],
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      },
    });
    expect(state.currentSessionId).toBe("session-1");
    expect(state.currentConversationId).toBe("conversation-1");
    expect(state.isSessionActive).toBe(true);
    expect(state.isThinking).toBe(false);
    expect(aiSaveSession).toHaveBeenCalledWith("session-1", "kind-dev", "default");
  });

  it("reuses an existing conversation and falls back to the generated prompt when prompt building fails", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    (aiGetSystemPrompt as jest.Mock).mockRejectedValueOnce(new Error("prompt failed"));
    (aiSaveSession as jest.Mock).mockRejectedValueOnce(new Error("db failed"));
    const { state, actions } = createHarness({
      currentConversationId: "existing-conversation",
      conversations: {
        prod: {
          id: "existing-conversation",
          clusterContext: "prod",
          messages: [],
          createdAt: 1,
          updatedAt: 1,
        },
      },
    });

    await expect(actions.startSession("prod", "infra")).resolves.toBe("session-1");

    expect(buildFallbackSystemPrompt).toHaveBeenCalledWith("prod");
    expect(aiStartSession).toHaveBeenCalledWith("prod", "fallback:prod", "claude");
    expect(state.currentConversationId).toBe("existing-conversation");
    expect(Object.keys(state.conversations)).toEqual(["prod"]);
    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  it("stores a normalized error when starting a session fails", async () => {
    (aiStartSession as jest.Mock).mockRejectedValueOnce(new Error("start failed"));
    const { state, actions } = createHarness();

    await expect(actions.startSession("broken")).rejects.toThrow("start failed");
    expect(state.error).toBe("start failed");
    expect(state.isThinking).toBe(false);
  });

  it("appends user and assistant messages before sending the prompt", async () => {
    (generateId as jest.Mock)
      .mockReturnValueOnce("user-1")
      .mockReturnValueOnce("assistant-1");
    const { state, actions } = createHarness({
      currentSessionId: "session-1",
      currentConversationId: "conversation-1",
      conversations: {
        kind: {
          id: "conversation-1",
          clusterContext: "kind",
          messages: [],
          createdAt: 1,
          updatedAt: 1,
        },
      },
    });

    await actions.sendMessage("raw prompt", "visible prompt");

    expect(state.conversations.kind.messages).toEqual([
      {
        id: "user-1",
        role: "user",
        content: "visible prompt",
        timestamp: 1700000000000,
      },
      {
        id: "assistant-1",
        role: "assistant",
        content: "",
        timestamp: 1700000000000,
        isStreaming: true,
      },
    ]);
    expect(aiSaveMessage).toHaveBeenNthCalledWith(
      1,
      "user-1",
      "session-1",
      "user",
      "raw prompt"
    );
    expect(aiSaveMessage).toHaveBeenNthCalledWith(
      2,
      "assistant-1",
      "session-1",
      "assistant",
      ""
    );
    expect(aiSendMessage).toHaveBeenCalledWith("session-1", "raw prompt");
    expect(state.isStreaming).toBe(true);
    expect(state.isThinking).toBe(true);
  });

  it("warns on save failures and stores an error when sending the message fails", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    (generateId as jest.Mock)
      .mockReturnValueOnce("user-1")
      .mockReturnValueOnce("assistant-1");
    (aiSaveMessage as jest.Mock)
      .mockRejectedValueOnce(new Error("save user failed"))
      .mockRejectedValueOnce(new Error("save assistant failed"));
    (aiSendMessage as jest.Mock).mockRejectedValueOnce(new Error("send failed"));
    const { state, actions } = createHarness({
      currentSessionId: "session-1",
      currentConversationId: "conversation-1",
      conversations: {
        kind: {
          id: "conversation-1",
          clusterContext: "kind",
          messages: [],
          createdAt: 1,
          updatedAt: 1,
        },
      },
    });

    await actions.sendMessage("hello");

    expect(console.warn).toHaveBeenCalledTimes(2);
    expect(state.error).toBe("send failed");
    expect(state.isStreaming).toBe(false);
    expect(state.isThinking).toBe(false);
  });

  it("rejects sending when there is no active session or conversation", async () => {
    const noSession = createHarness();
    await expect(noSession.actions.sendMessage("hello")).rejects.toThrow(
      "No active session"
    );

    const noConversation = createHarness({
      currentSessionId: "session-1",
      currentConversationId: "missing",
    });
    await expect(noConversation.actions.sendMessage("hello")).rejects.toThrow(
      "No active conversation"
    );
  });

  it("interrupts an active session and captures interrupt errors", async () => {
    const { state, actions } = createHarness({
      currentSessionId: "session-1",
      isStreaming: true,
      isThinking: true,
    });

    await actions.interrupt();
    expect(aiInterrupt).toHaveBeenCalledWith("session-1");
    expect(state.isStreaming).toBe(false);
    expect(state.isThinking).toBe(false);

    (aiInterrupt as jest.Mock).mockRejectedValueOnce(new Error("interrupt failed"));
    await actions.interrupt();
    expect(state.error).toBe("interrupt failed");
  });

  it("no-ops interrupt when there is no active session", async () => {
    const { actions } = createHarness();
    await actions.interrupt();
    expect(aiInterrupt).not.toHaveBeenCalled();
  });

  it("stops a session, removes the active conversation, and ignores stop errors", async () => {
    (aiStopSession as jest.Mock).mockRejectedValueOnce(new Error("stop failed"));
    const { state, actions } = createHarness({
      currentSessionId: "session-1",
      currentConversationId: "conversation-1",
      isSessionActive: true,
      isStreaming: true,
      isThinking: true,
      conversations: {
        prod: {
          id: "conversation-1",
          clusterContext: "prod",
          messages: [],
          createdAt: 1,
          updatedAt: 1,
        },
      },
    });

    await actions.stopSession();

    expect(aiStopSession).toHaveBeenCalledWith("session-1");
    expect(state.conversations).toEqual({});
    expect(state.currentSessionId).toBeNull();
    expect(state.currentConversationId).toBeNull();
    expect(state.isSessionActive).toBe(false);
    expect(state.isStreaming).toBe(false);
    expect(state.isThinking).toBe(false);
  });

  it("resets session state even when no conversation is active", async () => {
    const { state, actions } = createHarness({
      currentSessionId: "session-1",
      currentConversationId: "missing",
      isSessionActive: true,
      isStreaming: true,
      isThinking: true,
    });

    await actions.stopSession();

    expect(state.currentSessionId).toBeNull();
    expect(state.currentConversationId).toBeNull();
    expect(state.isSessionActive).toBe(false);
    expect(state.isStreaming).toBe(false);
    expect(state.isThinking).toBe(false);
  });

  it("refreshes sessions, loads saved sessions, and updates titles", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    (generateId as jest.Mock).mockReturnValueOnce("conversation-2");
    const { state, actions } = createHarness();

    await expect(actions.refreshSessions()).resolves.toEqual([{ session_id: "s1" }]);

    actions.loadSavedSession(
      "session-2",
      [
        {
          message_id: "m1",
          session_id: "session-2",
          role: "user",
          content: "hello",
          tool_calls: null,
          timestamp: "2026-03-07T10:00:00.000Z",
        },
        {
          message_id: "m2",
          session_id: "session-2",
          role: "assistant",
          content: "hi",
          tool_calls: null,
          timestamp: "2026-03-07T10:01:00.000Z",
        },
      ],
      "kind-dev"
    );

    expect(state.currentSessionId).toBe("session-2");
    expect(state.currentConversationId).toBe("conversation-2");
    expect(state.conversations["kind-dev"].messages).toHaveLength(2);
    expect(state.conversations["kind-dev"].createdAt).toBe(
      new Date("2026-03-07T10:00:00.000Z").getTime()
    );
    expect(state.conversations["kind-dev"].updatedAt).toBe(
      new Date("2026-03-07T10:01:00.000Z").getTime()
    );

    await actions.updateSessionTitle("session-2", "Investigate cluster");
    expect(aiUpdateSessionTitle).toHaveBeenCalledWith(
      "session-2",
      "Investigate cluster"
    );

    (aiUpdateSessionTitle as jest.Mock).mockRejectedValueOnce(new Error("title failed"));
    await actions.updateSessionTitle("session-2", "Broken title");
    expect(console.error).toHaveBeenCalled();
  });
});
