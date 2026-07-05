import { renderHook, waitFor } from "@testing-library/react";
import { usePendingAnalysis } from "../usePendingAnalysis";
import { useAIStore } from "@/lib/stores/ai-store";
import { useClusterStore } from "@/lib/stores/cluster-store";
import type { ExtractState } from "zustand";

// Mock the stores
jest.mock("@/lib/stores/ai-store");
jest.mock("@/lib/stores/cluster-store");

const mockUseAIStore = useAIStore as jest.MockedFunction<typeof useAIStore>;
const mockUseClusterStore = useClusterStore as jest.MockedFunction<typeof useClusterStore>;

type AIState = ExtractState<typeof useAIStore>;
type ClusterState = ExtractState<typeof useClusterStore>;

const setAIStoreState = (state: Partial<Record<keyof AIState, unknown>>) =>
  mockUseAIStore.mockImplementation(((selector: (s: AIState) => unknown) =>
    selector(state as AIState)) as unknown as typeof useAIStore);

const setClusterStoreState = (state: Partial<Record<keyof ClusterState, unknown>>) =>
  mockUseClusterStore.mockImplementation(((selector: (s: ClusterState) => unknown) =>
    selector(state as ClusterState)) as unknown as typeof useClusterStore);

describe("usePendingAnalysis", () => {
  const mockStartSession = jest.fn();
  const mockSendMessage = jest.fn();
  const mockSetError = jest.fn();
  const mockClearPendingAnalysis = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default mock implementations
    setAIStoreState({
      isSessionActive: false,
      startSession: mockStartSession,
      sendMessage: mockSendMessage,
      setError: mockSetError,
      pendingAnalysis: null,
      clearPendingAnalysis: mockClearPendingAnalysis,
    });

    setClusterStoreState({
      currentCluster: null,
    });
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
    setAIStoreState({
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
    });

    renderHook(() => usePendingAnalysis());

    jest.advanceTimersByTime(200);

    expect(mockClearPendingAnalysis).not.toHaveBeenCalled();
  });

  it("does nothing when cluster context does not match", () => {
    setAIStoreState({
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
    });

    setClusterStoreState({
      currentCluster: { context: "test-cluster" },
    });

    renderHook(() => usePendingAnalysis());

    jest.advanceTimersByTime(200);

    expect(mockClearPendingAnalysis).not.toHaveBeenCalled();
  });

  it("starts session and sends message when conditions are met", async () => {
    mockStartSession.mockResolvedValue(undefined);
    mockSendMessage.mockResolvedValue(undefined);

    setAIStoreState({
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
    });

    setClusterStoreState({
      currentCluster: { context: "test-cluster" },
    });

    renderHook(() => usePendingAnalysis());

    jest.advanceTimersByTime(200);

    await waitFor(() => {
      expect(mockClearPendingAnalysis).toHaveBeenCalled();
    });

    expect(mockStartSession).toHaveBeenCalledWith("test-cluster", "default");
  });

  it("skips starting session when already active", async () => {
    mockSendMessage.mockResolvedValue(undefined);

    setAIStoreState({
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
    });

    setClusterStoreState({
      currentCluster: { context: "test-cluster" },
    });

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

    setAIStoreState({
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
    });

    setClusterStoreState({
      currentCluster: { context: "test-cluster" },
    });

    renderHook(() => usePendingAnalysis());

    jest.advanceTimersByTime(200);

    await waitFor(() => {
      expect(mockSetError).toHaveBeenCalledWith("Send failed");
    });
  });
});
