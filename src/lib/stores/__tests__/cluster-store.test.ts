import { act } from "@testing-library/react";
import { listen } from "@tauri-apps/api/event";
import { useClusterStore } from "../cluster-store";

// Mock Tauri commands
const mockListClusters = jest.fn();
const mockConnectCluster = jest.fn();
const mockDisconnectCluster = jest.fn();
const mockGetConnectionStatus = jest.fn();
const mockGetNamespaces = jest.fn();
const mockCheckConnectionHealth = jest.fn();
const mockWatchNamespaces = jest.fn();
const mockStopWatch = jest.fn();

jest.mock("../../tauri/commands", () => ({
  listClusters: () => mockListClusters(),
  connectCluster: (context: string) => mockConnectCluster(context),
  disconnectCluster: () => mockDisconnectCluster(),
  getConnectionStatus: () => mockGetConnectionStatus(),
  getNamespaces: () => mockGetNamespaces(),
  checkConnectionHealth: () => mockCheckConnectionHealth(),
  watchNamespaces: (watchId: string) => mockWatchNamespaces(watchId),
  stopWatch: (watchId: string) => mockStopWatch(watchId),
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
    source_file: null,
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
    source_file: null,
  },
];

const defaultState = {
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
  namespaceWatchId: null,
  namespaceWatchUnlisten: null,
  reconnectAttempts: 0,
  isReconnecting: false,
  autoReconnectEnabled: true,
  lastConnectedContext: null,
  maxReconnectAttempts: 5,
};

describe("ClusterStore", () => {
  beforeEach(() => {
    useClusterStore.setState(defaultState);
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
      mockWatchNamespaces.mockResolvedValue(undefined);

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

    it("should start namespace watch on successful connect", async () => {
      mockConnectCluster.mockResolvedValue({
        connected: true,
        context: "test-context",
        latency_ms: 50,
      });
      mockGetNamespaces.mockResolvedValue(["default"]);
      mockCheckConnectionHealth.mockResolvedValue({ healthy: true, latency_ms: 50 });
      mockWatchNamespaces.mockResolvedValue(undefined);

      await act(async () => {
        await useClusterStore.getState().connect("test-context");
      });

      expect(mockWatchNamespaces).toHaveBeenCalled();
      expect(useClusterStore.getState().namespaceWatchId).not.toBeNull();
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

    it("should stop namespace watch on disconnect", async () => {
      const mockUnlisten = jest.fn();
      useClusterStore.setState({
        namespaceWatchId: "ns-watch-123",
        namespaceWatchUnlisten: mockUnlisten,
      });
      mockDisconnectCluster.mockResolvedValue(undefined);
      mockStopWatch.mockResolvedValue(undefined);

      await act(async () => {
        await useClusterStore.getState().disconnect();
      });

      expect(mockUnlisten).toHaveBeenCalled();
      expect(mockStopWatch).toHaveBeenCalledWith("ns-watch-123");
      expect(useClusterStore.getState().namespaceWatchId).toBeNull();
      expect(useClusterStore.getState().namespaceWatchUnlisten).toBeNull();
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

  describe("namespace watch", () => {
    it("should start namespace watch and set watchId", async () => {
      mockWatchNamespaces.mockResolvedValue(undefined);

      await act(async () => {
        await useClusterStore.getState().startNamespaceWatch();
      });

      const state = useClusterStore.getState();
      expect(state.namespaceWatchId).toMatch(/^namespaces-\d+$/);
      expect(mockWatchNamespaces).toHaveBeenCalledWith(state.namespaceWatchId);
      expect(listen).toHaveBeenCalledWith(
        `namespaces-watch-${state.namespaceWatchId}`,
        expect.any(Function)
      );
    });

    it("should add namespace on Added event", async () => {
      // Capture the event callback from listen
      let eventCallback: (event: { payload: unknown }) => void = () => {};
      (listen as jest.Mock).mockImplementation((_channel: string, cb: typeof eventCallback) => {
        eventCallback = cb;
        return Promise.resolve(jest.fn());
      });
      mockWatchNamespaces.mockResolvedValue(undefined);

      useClusterStore.setState({ namespaces: ["default", "kube-system"] });

      await act(async () => {
        await useClusterStore.getState().startNamespaceWatch();
      });

      // Simulate a namespace Added event
      act(() => {
        eventCallback({
          payload: { type: "Added", data: { name: "new-namespace" } },
        });
      });

      expect(useClusterStore.getState().namespaces).toEqual([
        "default",
        "kube-system",
        "new-namespace",
      ]);
    });

    it("should not duplicate namespace on Added event for existing namespace", async () => {
      let eventCallback: (event: { payload: unknown }) => void = () => {};
      (listen as jest.Mock).mockImplementation((_channel: string, cb: typeof eventCallback) => {
        eventCallback = cb;
        return Promise.resolve(jest.fn());
      });
      mockWatchNamespaces.mockResolvedValue(undefined);

      useClusterStore.setState({ namespaces: ["default", "kube-system"] });

      await act(async () => {
        await useClusterStore.getState().startNamespaceWatch();
      });

      act(() => {
        eventCallback({
          payload: { type: "Added", data: { name: "default" } },
        });
      });

      expect(useClusterStore.getState().namespaces).toEqual(["default", "kube-system"]);
    });

    it("should remove namespace on Deleted event", async () => {
      let eventCallback: (event: { payload: unknown }) => void = () => {};
      (listen as jest.Mock).mockImplementation((_channel: string, cb: typeof eventCallback) => {
        eventCallback = cb;
        return Promise.resolve(jest.fn());
      });
      mockWatchNamespaces.mockResolvedValue(undefined);

      useClusterStore.setState({ namespaces: ["default", "kube-system", "to-delete"] });

      await act(async () => {
        await useClusterStore.getState().startNamespaceWatch();
      });

      act(() => {
        eventCallback({
          payload: { type: "Deleted", data: { name: "to-delete" } },
        });
      });

      expect(useClusterStore.getState().namespaces).toEqual(["default", "kube-system"]);
    });

    it("should reset to All Namespaces when active namespace is deleted", async () => {
      let eventCallback: (event: { payload: unknown }) => void = () => {};
      (listen as jest.Mock).mockImplementation((_channel: string, cb: typeof eventCallback) => {
        eventCallback = cb;
        return Promise.resolve(jest.fn());
      });
      mockWatchNamespaces.mockResolvedValue(undefined);

      useClusterStore.setState({
        namespaces: ["default", "kube-system", "active-ns"],
        currentNamespace: "active-ns",
      });

      await act(async () => {
        await useClusterStore.getState().startNamespaceWatch();
      });

      act(() => {
        eventCallback({
          payload: { type: "Deleted", data: { name: "active-ns" } },
        });
      });

      expect(useClusterStore.getState().namespaces).toEqual(["default", "kube-system"]);
      expect(useClusterStore.getState().currentNamespace).toBe("");
    });

    it("should not reset namespace when a different namespace is deleted", async () => {
      let eventCallback: (event: { payload: unknown }) => void = () => {};
      (listen as jest.Mock).mockImplementation((_channel: string, cb: typeof eventCallback) => {
        eventCallback = cb;
        return Promise.resolve(jest.fn());
      });
      mockWatchNamespaces.mockResolvedValue(undefined);

      useClusterStore.setState({
        namespaces: ["default", "kube-system", "other-ns"],
        currentNamespace: "default",
      });

      await act(async () => {
        await useClusterStore.getState().startNamespaceWatch();
      });

      act(() => {
        eventCallback({
          payload: { type: "Deleted", data: { name: "other-ns" } },
        });
      });

      expect(useClusterStore.getState().namespaces).toEqual(["default", "kube-system"]);
      expect(useClusterStore.getState().currentNamespace).toBe("default");
    });

    it("should sort namespaces on Added event", async () => {
      let eventCallback: (event: { payload: unknown }) => void = () => {};
      (listen as jest.Mock).mockImplementation((_channel: string, cb: typeof eventCallback) => {
        eventCallback = cb;
        return Promise.resolve(jest.fn());
      });
      mockWatchNamespaces.mockResolvedValue(undefined);

      useClusterStore.setState({ namespaces: ["default", "monitoring"] });

      await act(async () => {
        await useClusterStore.getState().startNamespaceWatch();
      });

      act(() => {
        eventCallback({
          payload: { type: "Added", data: { name: "beta-ns" } },
        });
      });

      expect(useClusterStore.getState().namespaces).toEqual([
        "beta-ns",
        "default",
        "monitoring",
      ]);
    });

    it("should stop existing watch before starting new one", async () => {
      const mockUnlisten = jest.fn();
      useClusterStore.setState({
        namespaceWatchId: "old-watch",
        namespaceWatchUnlisten: mockUnlisten,
      });
      mockStopWatch.mockResolvedValue(undefined);
      mockWatchNamespaces.mockResolvedValue(undefined);

      await act(async () => {
        await useClusterStore.getState().startNamespaceWatch();
      });

      expect(mockUnlisten).toHaveBeenCalled();
      expect(mockStopWatch).toHaveBeenCalledWith("old-watch");
    });

    it("should stop namespace watch cleanly", async () => {
      const mockUnlisten = jest.fn();
      useClusterStore.setState({
        namespaceWatchId: "test-watch",
        namespaceWatchUnlisten: mockUnlisten,
      });
      mockStopWatch.mockResolvedValue(undefined);

      await act(async () => {
        await useClusterStore.getState().stopNamespaceWatch();
      });

      expect(mockUnlisten).toHaveBeenCalled();
      expect(mockStopWatch).toHaveBeenCalledWith("test-watch");
      expect(useClusterStore.getState().namespaceWatchId).toBeNull();
      expect(useClusterStore.getState().namespaceWatchUnlisten).toBeNull();
    });

    it("should handle stopWatch failure gracefully", async () => {
      useClusterStore.setState({
        namespaceWatchId: "test-watch",
        namespaceWatchUnlisten: jest.fn(),
      });
      mockStopWatch.mockRejectedValue(new Error("Watch not found"));

      await act(async () => {
        await useClusterStore.getState().stopNamespaceWatch();
      });

      // Should still clean up state despite error
      expect(useClusterStore.getState().namespaceWatchId).toBeNull();
      expect(useClusterStore.getState().namespaceWatchUnlisten).toBeNull();
    });

    it("should handle watch start failure", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      mockWatchNamespaces.mockRejectedValue(new Error("Watch failed"));

      await act(async () => {
        await useClusterStore.getState().startNamespaceWatch();
      });

      expect(errorSpy).toHaveBeenCalledWith(
        "Failed to start namespace watch:",
        expect.any(Error)
      );
      errorSpy.mockRestore();
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
