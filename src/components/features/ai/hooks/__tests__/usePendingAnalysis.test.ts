import { renderHook, waitFor } from "@testing-library/react";
import { usePendingAnalysis } from "../usePendingAnalysis";
import { useAIStore } from "@/lib/stores/ai-store";
import { useClusterStore } from "@/lib/stores/cluster-store";

// Mock the stores
jest.mock("@/lib/stores/ai-store");
jest.mock("@/lib/stores/cluster-store");

const mockUseAIStore = useAIStore as jest.MockedFunction<typeof useAIStore>;
const mockUseClusterStore = useClusterStore as jest.MockedFunction<typeof useClusterStore>;

describe("usePendingAnalysis", () => {
  const mockStartSession = jest.fn();
  const mockSendMessage = jest.fn();
  const mockSetError = jest.fn();
  const mockClearPendingAnalysis = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default mock implementations
    mockUseAIStore.mockReturnValue({
      isSessionActive: false,
      startSession: mockStartSession,
      sendMessage: mockSendMessage,
      setError: mockSetError,
      pendingAnalysis: null,
      clearPendingAnalysis: mockClearPendingAnalysis,
    } as ReturnType<typeof useAIStore>);

    mockUseClusterStore.mockReturnValue({
      currentCluster: null,
    } as ReturnType<typeof useClusterStore>);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does nothing when pendingAnalysis is null", () => {
    renderHook(() => usePendingAnalysis());

    jest.advanceTimersByTime(200);

    expect(mockClearPendingAnalysis).not.toHaveBeenCalled();
    expect(mockStartSession).not.toHaveBeenCalled();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("does nothing when currentCluster is null", () => {
    mockUseAIStore.mockReturnValue({
      isSessionActive: false,
      startSession: mockStartSession,
      sendMessage: mockSendMessage,
      setError: mockSetError,
      pendingAnalysis: {
        clusterContext: "test-cluster",
        message: "Test message",
        namespace: "default",
      },
      clearPendingAnalysis: mockClearPendingAnalysis,
    } as ReturnType<typeof useAIStore>);

    renderHook(() => usePendingAnalysis());

    jest.advanceTimersByTime(200);

    expect(mockClearPendingAnalysis).not.toHaveBeenCalled();
  });

  it("does nothing when cluster context does not match", () => {
    mockUseAIStore.mockReturnValue({
      isSessionActive: false,
      startSession: mockStartSession,
      sendMessage: mockSendMessage,
      setError: mockSetError,
      pendingAnalysis: {
        clusterContext: "different-cluster",
        message: "Test message",
        namespace: "default",
      },
      clearPendingAnalysis: mockClearPendingAnalysis,
    } as ReturnType<typeof useAIStore>);

    mockUseClusterStore.mockReturnValue({
      currentCluster: { context: "test-cluster" },
    } as ReturnType<typeof useClusterStore>);

    renderHook(() => usePendingAnalysis());

    jest.advanceTimersByTime(200);

    expect(mockClearPendingAnalysis).not.toHaveBeenCalled();
  });

  it("starts session and sends message when conditions are met", async () => {
    mockStartSession.mockResolvedValue(undefined);
    mockSendMessage.mockResolvedValue(undefined);

    mockUseAIStore.mockReturnValue({
      isSessionActive: false,
      startSession: mockStartSession,
      sendMessage: mockSendMessage,
      setError: mockSetError,
      pendingAnalysis: {
        clusterContext: "test-cluster",
        message: "Analyze this pod",
        namespace: "default",
      },
      clearPendingAnalysis: mockClearPendingAnalysis,
    } as ReturnType<typeof useAIStore>);

    mockUseClusterStore.mockReturnValue({
      currentCluster: { context: "test-cluster" },
    } as ReturnType<typeof useClusterStore>);

    renderHook(() => usePendingAnalysis());

    jest.advanceTimersByTime(200);

    await waitFor(() => {
      expect(mockClearPendingAnalysis).toHaveBeenCalled();
    });

    expect(mockStartSession).toHaveBeenCalledWith("test-cluster", "default");
  });

  it("skips starting session when already active", async () => {
    mockSendMessage.mockResolvedValue(undefined);

    mockUseAIStore.mockReturnValue({
      isSessionActive: true,
      startSession: mockStartSession,
      sendMessage: mockSendMessage,
      setError: mockSetError,
      pendingAnalysis: {
        clusterContext: "test-cluster",
        message: "Analyze this pod",
        namespace: "default",
      },
      clearPendingAnalysis: mockClearPendingAnalysis,
    } as ReturnType<typeof useAIStore>);

    mockUseClusterStore.mockReturnValue({
      currentCluster: { context: "test-cluster" },
    } as ReturnType<typeof useClusterStore>);

    renderHook(() => usePendingAnalysis());

    jest.advanceTimersByTime(200);

    await waitFor(() => {
      expect(mockClearPendingAnalysis).toHaveBeenCalled();
    });

    expect(mockStartSession).not.toHaveBeenCalled();
    expect(mockSendMessage).toHaveBeenCalledWith("Analyze this pod");
  });

  it("sets error when sendMessage fails", async () => {
    mockSendMessage.mockRejectedValue(new Error("Send failed"));

    mockUseAIStore.mockReturnValue({
      isSessionActive: true,
      startSession: mockStartSession,
      sendMessage: mockSendMessage,
      setError: mockSetError,
      pendingAnalysis: {
        clusterContext: "test-cluster",
        message: "Analyze this pod",
        namespace: "default",
      },
      clearPendingAnalysis: mockClearPendingAnalysis,
    } as ReturnType<typeof useAIStore>);

    mockUseClusterStore.mockReturnValue({
      currentCluster: { context: "test-cluster" },
    } as ReturnType<typeof useClusterStore>);

    renderHook(() => usePendingAnalysis());

    jest.advanceTimersByTime(200);

    await waitFor(() => {
      expect(mockSetError).toHaveBeenCalledWith("Send failed");
    });
  });
});
