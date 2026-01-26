import { act } from "@testing-library/react";
import { useClusterStore } from "../cluster-store";

// Mock Tauri commands
const mockListClusters = jest.fn();
const mockConnectCluster = jest.fn();
const mockDisconnectCluster = jest.fn();
const mockGetConnectionStatus = jest.fn();
const mockGetNamespaces = jest.fn();
const mockCheckConnectionHealth = jest.fn();

jest.mock("../../tauri/commands", () => ({
  listClusters: () => mockListClusters(),
  connectCluster: (context: string) => mockConnectCluster(context),
  disconnectCluster: () => mockDisconnectCluster(),
  getConnectionStatus: () => mockGetConnectionStatus(),
  getNamespaces: () => mockGetNamespaces(),
  checkConnectionHealth: () => mockCheckConnectionHealth(),
}));

// Test data
const mockClusters = [
  {
    id: "1",
    name: "test-cluster",
    context: "test-context",
    current: true,
    server: "https://test:6443",
    namespace: "default",
    user: "test-user",
    auth_type: "certificate" as const,
  },
  {
    id: "2",
    name: "prod-cluster",
    context: "prod-context",
    current: false,
    server: "https://prod:6443",
    namespace: "default",
    user: "prod-user",
    auth_type: "certificate" as const,
  },
];

describe("ClusterStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useClusterStore.setState({
      clusters: [],
      currentCluster: null,
      currentNamespace: "",
      namespaces: [],
      isConnected: false,
      isLoading: false,
      error: null,
      lastConnectionErrorContext: null,
      lastConnectionErrorMessage: null,
      latencyMs: null,
      lastHealthCheck: null,
      isHealthy: false,
      healthCheckInterval: null,
      reconnectAttempts: 0,
      isReconnecting: false,
      autoReconnectEnabled: true,
      lastConnectedContext: null,
      maxReconnectAttempts: 5,
    });

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe("fetchClusters", () => {
    it("should fetch and set clusters", async () => {
      mockListClusters.mockResolvedValue(mockClusters);

      await act(async () => {
        await useClusterStore.getState().fetchClusters();
      });

      const state = useClusterStore.getState();
      expect(state.clusters).toEqual(mockClusters);
      expect(state.currentCluster).toEqual(mockClusters[0]); // First cluster is current
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("should set loading state while fetching", async () => {
      mockListClusters.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockClusters), 100))
      );

      const fetchPromise = useClusterStore.getState().fetchClusters();

      // Check loading state immediately
      expect(useClusterStore.getState().isLoading).toBe(true);

      await act(async () => {
        await fetchPromise;
      });

      expect(useClusterStore.getState().isLoading).toBe(false);
    });

    it("should handle fetch error", async () => {
      mockListClusters.mockRejectedValue(new Error("Network error"));

      await act(async () => {
        await useClusterStore.getState().fetchClusters();
      });

      const state = useClusterStore.getState();
      expect(state.error).toBe("Network error");
      expect(state.isLoading).toBe(false);
      expect(state.clusters).toEqual([]);
    });
  });

  describe("connect", () => {
    beforeEach(() => {
      // Set up clusters first
      useClusterStore.setState({ clusters: mockClusters });
    });

    it("should connect to a cluster successfully", async () => {
      mockConnectCluster.mockResolvedValue({
        connected: true,
        context: "test-context",
        latency_ms: 50,
      });
      mockGetNamespaces.mockResolvedValue(["default", "kube-system"]);
      mockCheckConnectionHealth.mockResolvedValue({ healthy: true, latency_ms: 50 });

      await act(async () => {
        await useClusterStore.getState().connect("test-context");
      });

      const state = useClusterStore.getState();
      expect(state.isConnected).toBe(true);
      expect(state.currentCluster?.context).toBe("test-context");
      expect(state.latencyMs).toBe(50);
      expect(state.isHealthy).toBe(true);
      expect(state.error).toBeNull();
      expect(mockConnectCluster).toHaveBeenCalledWith("test-context");
    });

    it("should handle connection failure", async () => {
      mockConnectCluster.mockResolvedValue({
        connected: false,
        context: "test-context",
        error: "Connection refused",
      });

      await act(async () => {
        await useClusterStore.getState().connect("test-context");
      });

      const state = useClusterStore.getState();
      expect(state.isConnected).toBe(false);
      expect(state.error).toBe("Connection refused");
      expect(state.lastConnectionErrorContext).toBe("test-context");
      expect(state.lastConnectionErrorMessage).toBe("Connection refused");
    });

    it("should handle connection exception", async () => {
      mockConnectCluster.mockRejectedValue(new Error("Timeout"));

      await act(async () => {
        await useClusterStore.getState().connect("test-context");
      });

      const state = useClusterStore.getState();
      expect(state.isConnected).toBe(false);
      expect(state.error).toBe("Timeout");
    });
  });

  describe("disconnect", () => {
    beforeEach(() => {
      useClusterStore.setState({
        isConnected: true,
        currentCluster: mockClusters[0],
        namespaces: ["default"],
        lastConnectedContext: "test-context",
      });
    });

    it("should disconnect successfully", async () => {
      mockDisconnectCluster.mockResolvedValue(undefined);

      await act(async () => {
        await useClusterStore.getState().disconnect();
      });

      const state = useClusterStore.getState();
      expect(state.isConnected).toBe(false);
      expect(state.namespaces).toEqual([]);
      expect(state.lastConnectedContext).toBeNull();
      expect(state.error).toBeNull();
    });

    it("should handle disconnect error", async () => {
      mockDisconnectCluster.mockRejectedValue(new Error("Disconnect failed"));

      await act(async () => {
        await useClusterStore.getState().disconnect();
      });

      const state = useClusterStore.getState();
      expect(state.error).toBe("Disconnect failed");
    });
  });

  describe("setCurrentNamespace", () => {
    it("should set current namespace", () => {
      act(() => {
        useClusterStore.getState().setCurrentNamespace("kube-system");
      });

      expect(useClusterStore.getState().currentNamespace).toBe("kube-system");
    });
  });

  describe("setError", () => {
    it("should set error message", () => {
      act(() => {
        useClusterStore.getState().setError("Test error");
      });

      expect(useClusterStore.getState().error).toBe("Test error");
    });

    it("should clear error when set to null", () => {
      useClusterStore.setState({ error: "Previous error" });

      act(() => {
        useClusterStore.getState().setError(null);
      });

      expect(useClusterStore.getState().error).toBeNull();
    });
  });

  describe("fetchNamespaces", () => {
    it("should fetch namespaces when connected", async () => {
      useClusterStore.setState({ isConnected: true });
      mockGetNamespaces.mockResolvedValue(["default", "kube-system", "monitoring"]);

      await act(async () => {
        await useClusterStore.getState().fetchNamespaces();
      });

      expect(useClusterStore.getState().namespaces).toEqual([
        "default",
        "kube-system",
        "monitoring",
      ]);
    });

    it("should not fetch namespaces when disconnected", async () => {
      useClusterStore.setState({ isConnected: false });

      await act(async () => {
        await useClusterStore.getState().fetchNamespaces();
      });

      expect(mockGetNamespaces).not.toHaveBeenCalled();
    });
  });

  describe("checkHealth", () => {
    it("should update health status", async () => {
      useClusterStore.setState({ isConnected: true, isHealthy: true });
      mockCheckConnectionHealth.mockResolvedValue({ healthy: true, latency_ms: 25 });

      await act(async () => {
        await useClusterStore.getState().checkHealth();
      });

      const state = useClusterStore.getState();
      expect(state.isHealthy).toBe(true);
      expect(state.latencyMs).toBe(25);
      expect(state.lastHealthCheck).toBeInstanceOf(Date);
    });

    it("should detect unhealthy connection", async () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      useClusterStore.setState({
        isConnected: true,
        isHealthy: true,
        autoReconnectEnabled: false,
      });
      mockCheckConnectionHealth.mockResolvedValue({
        healthy: false,
        latency_ms: null,
        error: "Connection lost",
      });

      await act(async () => {
        await useClusterStore.getState().checkHealth();
      });

      const state = useClusterStore.getState();
      expect(state.isHealthy).toBe(false);
      expect(state.isConnected).toBe(false);
      expect(state.error).toBe("Connection lost");
      expect(warnSpy).toHaveBeenCalledWith("Connection health check failed, connection lost");

      warnSpy.mockRestore();
    });
  });

  describe("auto-reconnect", () => {
    it("should respect maxReconnectAttempts", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      useClusterStore.setState({
        lastConnectedContext: "test-context",
        reconnectAttempts: 5,
        maxReconnectAttempts: 5,
      });

      const result = await useClusterStore.getState().attemptReconnect();

      expect(result).toBe(false);
      expect(useClusterStore.getState().error).toContain("Failed to reconnect");
      expect(errorSpy).toHaveBeenCalledWith("Max reconnect attempts (5) reached");

      errorSpy.mockRestore();
    });

    it("should not reconnect when already reconnecting", async () => {
      useClusterStore.setState({
        lastConnectedContext: "test-context",
        isReconnecting: true,
      });

      const result = await useClusterStore.getState().attemptReconnect();

      expect(result).toBe(false);
      expect(mockConnectCluster).not.toHaveBeenCalled();
    });

    it("should toggle auto-reconnect setting", () => {
      expect(useClusterStore.getState().autoReconnectEnabled).toBe(true);

      act(() => {
        useClusterStore.getState().setAutoReconnect(false);
      });

      expect(useClusterStore.getState().autoReconnectEnabled).toBe(false);
    });

    it("should reset reconnect attempts", () => {
      useClusterStore.setState({ reconnectAttempts: 3, isReconnecting: true });

      act(() => {
        useClusterStore.getState().resetReconnectAttempts();
      });

      const state = useClusterStore.getState();
      expect(state.reconnectAttempts).toBe(0);
      expect(state.isReconnecting).toBe(false);
    });
  });

  describe("refreshConnectionStatus", () => {
    it("should update connection status", async () => {
      mockGetConnectionStatus.mockResolvedValue({ connected: true });

      await act(async () => {
        await useClusterStore.getState().refreshConnectionStatus();
      });

      expect(useClusterStore.getState().isConnected).toBe(true);
    });

    it("should handle status check failure", async () => {
      useClusterStore.setState({ isConnected: true });
      mockGetConnectionStatus.mockRejectedValue(new Error("Status check failed"));

      await act(async () => {
        await useClusterStore.getState().refreshConnectionStatus();
      });

      expect(useClusterStore.getState().isConnected).toBe(false);
    });
  });
});
