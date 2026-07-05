import { renderHook } from "@testing-library/react";
import { listen } from "@tauri-apps/api/event";
import { useAIEvents } from "../useAIEvents";
import { useAIStore } from "@/lib/stores/ai-store";
import type { ExtractState } from "zustand";
import type { AIEventData } from "../../types";

jest.mock("@tauri-apps/api/event", () => ({
  listen: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

jest.mock("@/lib/stores/ai-store");

const mockUseAIStore = useAIStore as jest.MockedFunction<typeof useAIStore>;

type AIState = ExtractState<typeof useAIStore>;

const setAIStoreState = (state: Partial<Record<keyof AIState, unknown>>) =>
  mockUseAIStore.mockImplementation(((selector: (s: AIState) => unknown) =>
    selector(state as AIState)) as unknown as typeof useAIStore);

describe("useAIEvents", () => {
  const appendMessageChunk = jest.fn();
  const finalizeStreaming = jest.fn();
  const setThinking = jest.fn();
  const setError = jest.fn();
  const addToolCall = jest.fn();
  const markSessionEnded = jest.fn();

  const i18n = {
    unknownError: "Unknown error",
  };

  let emit: (event: { payload: AIEventData }) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    (listen as jest.Mock).mockImplementation((_event, handler) => {
      emit = handler;
      return Promise.resolve(jest.fn());
    });
    setAIStoreState({
      appendMessageChunk,
      finalizeStreaming,
      setThinking,
      setError,
      addToolCall,
      markSessionEnded,
    });
  });

  it("sets the error and finalizes streaming state on an Error event", () => {
    renderHook(() => useAIEvents("session-1", i18n));

    emit({ payload: { type: "Error", data: { message: "agent crashed" } } });

    expect(setError).toHaveBeenCalledWith("agent crashed");
    expect(finalizeStreaming).toHaveBeenCalled();
  });

  it("falls back to the unknown error label when the Error event has no message", () => {
    renderHook(() => useAIEvents("session-1", i18n));

    emit({ payload: { type: "Error", data: {} } });

    expect(setError).toHaveBeenCalledWith("Unknown error");
    expect(finalizeStreaming).toHaveBeenCalled();
  });

  it("marks the session ended when the backend terminates it", () => {
    renderHook(() => useAIEvents("session-1", i18n));

    emit({ payload: { type: "SessionEnded", data: {} } });

    expect(markSessionEnded).toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
  });

  it("does not subscribe without a session id", () => {
    renderHook(() => useAIEvents(null, i18n));

    expect(listen).not.toHaveBeenCalled();
  });
});
