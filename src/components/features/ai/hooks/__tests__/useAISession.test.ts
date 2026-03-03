import { renderHook, act } from "@testing-library/react";
import { useAISession } from "../useAISession";
import { useAIStore } from "@/lib/stores/ai-store";
import { useClusterStore } from "@/lib/stores/cluster-store";

// Mock the stores
jest.mock("@/lib/stores/ai-store");
jest.mock("@/lib/stores/cluster-store");

const mockUseAIStore = useAIStore as jest.MockedFunction<typeof useAIStore>;
const mockUseClusterStore = useClusterStore as jest.MockedFunction<typeof useClusterStore>;

describe("useAISession", () => {
  const mockStartSession = jest.fn();
  const mockSendMessage = jest.fn();
  const mockSetError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAIStore.mockReturnValue({
      isSessionActive: false,
      isStreaming: false,
      startSession: mockStartSession,
      sendMessage: mockSendMessage,
      setError: mockSetError,
    } as ReturnType<typeof useAIStore>);

    mockUseClusterStore.mockReturnValue({
      currentCluster: { context: "test-cluster" },
      currentNamespace: "default",
    } as ReturnType<typeof useClusterStore>);
  });

  it("returns textareaRef", () => {
    const { result } = renderHook(() => useAISession());
    expect(result.current.textareaRef).toBeDefined();
    expect(result.current.textareaRef.current).toBeNull();
  });

  it("returns canSend as true when cluster is connected and not streaming", () => {
    const { result } = renderHook(() => useAISession());
    expect(result.current.canSend).toBe(true);
  });

  it("returns canSend as false when no cluster", () => {
    mockUseClusterStore.mockReturnValue({
      currentCluster: null,
      currentNamespace: null,
    } as ReturnType<typeof useClusterStore>);

    const { result } = renderHook(() => useAISession());
    expect(result.current.canSend).toBe(false);
  });

  it("returns canSend as false when streaming", () => {
    mockUseAIStore.mockReturnValue({
      isSessionActive: true,
      isStreaming: true,
      startSession: mockStartSession,
      sendMessage: mockSendMessage,
      setError: mockSetError,
    } as ReturnType<typeof useAIStore>);

    const { result } = renderHook(() => useAISession());
    expect(result.current.canSend).toBe(false);
  });

  it("handleSend returns false for empty input", async () => {
    const { result } = renderHook(() => useAISession());

    let sendResult: boolean | undefined;
    await act(async () => {
      sendResult = await result.current.handleSend("");
    });

    expect(sendResult).toBe(false);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("handleSend returns false for whitespace-only input", async () => {
    const { result } = renderHook(() => useAISession());

    let sendResult: boolean | undefined;
    await act(async () => {
      sendResult = await result.current.handleSend("   ");
    });

    expect(sendResult).toBe(false);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("handleSend returns false when streaming", async () => {
    mockUseAIStore.mockReturnValue({
      isSessionActive: true,
      isStreaming: true,
      startSession: mockStartSession,
      sendMessage: mockSendMessage,
      setError: mockSetError,
    } as ReturnType<typeof useAIStore>);

    const { result } = renderHook(() => useAISession());

    let sendResult: boolean | undefined;
    await act(async () => {
      sendResult = await result.current.handleSend("Test message");
    });

    expect(sendResult).toBe(false);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("handleSend starts session when not active", async () => {
    mockStartSession.mockResolvedValue(undefined);
    mockSendMessage.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAISession());

    await act(async () => {
      await result.current.handleSend("Test message");
    });

    expect(mockStartSession).toHaveBeenCalledWith("test-cluster", "default");
    expect(mockSendMessage).toHaveBeenCalledWith("Test message", undefined);
  });

  it("handleSend skips starting session when already active", async () => {
    mockUseAIStore.mockReturnValue({
      isSessionActive: true,
      isStreaming: false,
      startSession: mockStartSession,
      sendMessage: mockSendMessage,
      setError: mockSetError,
    } as ReturnType<typeof useAIStore>);
    mockSendMessage.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAISession());

    await act(async () => {
      await result.current.handleSend("Test message");
    });

    expect(mockStartSession).not.toHaveBeenCalled();
    expect(mockSendMessage).toHaveBeenCalledWith("Test message", undefined);
  });

  it("handleSend returns true on success", async () => {
    mockUseAIStore.mockReturnValue({
      isSessionActive: true,
      isStreaming: false,
      startSession: mockStartSession,
      sendMessage: mockSendMessage,
      setError: mockSetError,
    } as ReturnType<typeof useAIStore>);
    mockSendMessage.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAISession());

    let sendResult: boolean | undefined;
    await act(async () => {
      sendResult = await result.current.handleSend("Test message");
    });

    expect(sendResult).toBe(true);
  });

  it("handleSend sets error and returns false on failure", async () => {
    mockUseAIStore.mockReturnValue({
      isSessionActive: true,
      isStreaming: false,
      startSession: mockStartSession,
      sendMessage: mockSendMessage,
      setError: mockSetError,
    } as ReturnType<typeof useAIStore>);
    mockSendMessage.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAISession());

    let sendResult: boolean | undefined;
    await act(async () => {
      sendResult = await result.current.handleSend("Test message");
    });

    expect(sendResult).toBe(false);
    expect(mockSetError).toHaveBeenCalledWith("Network error");
  });

  it("handleSend calls onError callback on failure", async () => {
    mockUseAIStore.mockReturnValue({
      isSessionActive: true,
      isStreaming: false,
      startSession: mockStartSession,
      sendMessage: mockSendMessage,
      setError: mockSetError,
    } as ReturnType<typeof useAIStore>);
    mockSendMessage.mockRejectedValue(new Error("Network error"));

    const onError = jest.fn();
    const { result } = renderHook(() => useAISession({ onError }));

    await act(async () => {
      await result.current.handleSend("Test message");
    });

    expect(onError).toHaveBeenCalledWith("Network error");
  });

  it("handleSend trims input message", async () => {
    mockUseAIStore.mockReturnValue({
      isSessionActive: true,
      isStreaming: false,
      startSession: mockStartSession,
      sendMessage: mockSendMessage,
      setError: mockSetError,
    } as ReturnType<typeof useAIStore>);
    mockSendMessage.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAISession());

    await act(async () => {
      await result.current.handleSend("  Test message  ");
    });

    expect(mockSendMessage).toHaveBeenCalledWith("Test message", undefined);
  });

  it("handleSend returns false when startSession fails", async () => {
    mockStartSession.mockRejectedValue(new Error("Session failed"));

    const { result } = renderHook(() => useAISession());

    let sendResult: boolean | undefined;
    await act(async () => {
      sendResult = await result.current.handleSend("Test message");
    });

    expect(sendResult).toBe(false);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
