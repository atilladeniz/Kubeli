import { create } from "zustand";
import type { Cluster, ConnectionStatus, HealthCheckResult } from "../types";
import {
  listClusters,
  connectCluster,
  disconnectCluster,
  getConnectionStatus,
  getNamespaces,
  checkConnectionHealth,
} from "../tauri/commands";

// Debug logger - only logs in development
const isDev = process.env.NODE_ENV === "development";
const debug = (...args: unknown[]) => {
  if (isDev) console.log("[Cluster]", ...args);
};

interface ClusterState {
  clusters: Cluster[];
  currentCluster: Cluster | null;
  currentNamespace: string;
  namespaces: string[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  lastConnectionErrorContext: string | null;
  lastConnectionErrorMessage: string | null;

  // Health monitoring
  latencyMs: number | null;
  lastHealthCheck: Date | null;
  isHealthy: boolean;
  healthCheckInterval: ReturnType<typeof setInterval> | null;

  // Auto-reconnect
  reconnectAttempts: number;
  isReconnecting: boolean;
  autoReconnectEnabled: boolean;
  lastConnectedContext: string | null;
  maxReconnectAttempts: number;

  // Actions
  fetchClusters: () => Promise<void>;
  connect: (context: string) => Promise<ConnectionStatus>;
  disconnect: () => Promise<void>;
  refreshConnectionStatus: () => Promise<void>;
  fetchNamespaces: () => Promise<void>;
  setCurrentNamespace: (namespace: string) => void;
  setError: (error: string | null) => void;

  // Health & Reconnect actions
  checkHealth: () => Promise<HealthCheckResult>;
  startHealthMonitoring: (intervalMs?: number) => void;
  stopHealthMonitoring: () => void;
  attemptReconnect: () => Promise<boolean>;
  setAutoReconnect: (enabled: boolean) => void;
  resetReconnectAttempts: () => void;
}

// Calculate exponential backoff delay
const getBackoffDelay = (attempt: number, baseDelay = 1000, maxDelay = 30000): number => {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add jitter (±10%)
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.floor(delay + jitter);
};

export const useClusterStore = create<ClusterState>((set, get) => ({
  clusters: [],
  currentCluster: null,
  currentNamespace: "",
  namespaces: [],
  isConnected: false,
  isLoading: false,
  error: null,
  lastConnectionErrorContext: null,
  lastConnectionErrorMessage: null,

  // Health monitoring initial state
  latencyMs: null,
  lastHealthCheck: null,
  isHealthy: false,
  healthCheckInterval: null,

  // Auto-reconnect initial state
  reconnectAttempts: 0,
  isReconnecting: false,
  autoReconnectEnabled: true,
  lastConnectedContext: null,
  maxReconnectAttempts: 5,

  fetchClusters: async () => {
    set({ isLoading: true, error: null });
    try {
      // Minimum delay for visible loading feedback
      const [clusters] = await Promise.all([
        listClusters(),
        new Promise((resolve) => setTimeout(resolve, 400)),
      ]);
      const currentCluster = clusters.find((c) => c.current) || null;
      set({
        clusters,
        currentCluster,
        currentNamespace: "",
        isLoading: false,
      });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to fetch clusters",
        isLoading: false,
      });
    }
  },

  connect: async (context: string) => {
    set({ isLoading: true, error: null, isReconnecting: false });
    try {
      const status = await connectCluster(context);
      if (status.connected) {
        const clusters = get().clusters;
        const currentCluster = clusters.find((c) => c.context === context) || null;
        set({
          isConnected: true,
          currentCluster,
          currentNamespace: "",
          error: null,
          isLoading: false,
          latencyMs: status.latency_ms,
          lastHealthCheck: new Date(),
          isHealthy: true,
          lastConnectedContext: context,
          reconnectAttempts: 0,
          lastConnectionErrorContext: null,
          lastConnectionErrorMessage: null,
        });
        // Fetch namespaces after connecting
        get().fetchNamespaces();
        // Start health monitoring
        get().startHealthMonitoring();
      } else {
        const errorMessage = status.error || "Failed to connect";
        set({
          isConnected: false,
          error: errorMessage,
          isLoading: false,
          isHealthy: false,
          lastConnectionErrorContext: context,
          lastConnectionErrorMessage: errorMessage,
        });
      }
      return status;
    } catch (e) {
      const error = e instanceof Error ? e.message : "Failed to connect";
      set({
        error,
        isLoading: false,
        isConnected: false,
        isHealthy: false,
        lastConnectionErrorContext: context,
        lastConnectionErrorMessage: error,
      });
      return { connected: false, context, error, latency_ms: null };
    }
  },

  disconnect: async () => {
    // Stop health monitoring before disconnecting
    get().stopHealthMonitoring();
    try {
      await disconnectCluster();
      // Keep currentCluster so port forward badge still shows on the correct cluster card
      set({
        isConnected: false,
        namespaces: [],
        error: null,
        isHealthy: false,
        latencyMs: null,
        lastConnectedContext: null,
        reconnectAttempts: 0,
        lastConnectionErrorContext: null,
        lastConnectionErrorMessage: null,
      });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to disconnect",
      });
    }
  },

  refreshConnectionStatus: async () => {
    try {
      const status = await getConnectionStatus();
      set({ isConnected: status.connected });
    } catch {
      set({ isConnected: false });
    }
  },

  fetchNamespaces: async () => {
    if (!get().isConnected) return;
    try {
      const namespaces = await getNamespaces();
      set({ namespaces });
    } catch (e) {
      console.error("Failed to fetch namespaces:", e);
    }
  },

  setCurrentNamespace: (namespace) => set({ currentNamespace: namespace }),
  setError: (error) =>
    set((state) => ({
      error,
      lastConnectionErrorContext: error ? state.lastConnectionErrorContext : null,
      lastConnectionErrorMessage: error ? state.lastConnectionErrorMessage : null,
    })),

  // Health check action
  checkHealth: async () => {
    try {
      const result = await checkConnectionHealth();
      const wasHealthy = get().isHealthy;
      const wasConnected = get().isConnected;

      set({
        isHealthy: result.healthy,
        latencyMs: result.latency_ms,
        lastHealthCheck: new Date(),
      });

      // Refresh namespaces periodically when healthy
      if (result.healthy) {
        get().fetchNamespaces();
      }

      // If connection was healthy and is now unhealthy, trigger auto-reconnect
      if (wasConnected && wasHealthy && !result.healthy) {
        console.warn("Connection health check failed, connection lost");
        set({ isConnected: false, error: result.error || "Connection lost" });

        // Attempt auto-reconnect if enabled
        if (get().autoReconnectEnabled && get().lastConnectedContext) {
          get().attemptReconnect();
        }
      }

      // If reconnecting and health is restored
      if (get().isReconnecting && result.healthy) {
        set({ isConnected: true, isReconnecting: false, reconnectAttempts: 0, error: null });
      }

      return result;
    } catch (e) {
      const error = e instanceof Error ? e.message : "Health check failed";
      set({
        isHealthy: false,
        lastHealthCheck: new Date(),
        error,
      });
      return { healthy: false, latency_ms: null, error };
    }
  },

  startHealthMonitoring: (intervalMs = 15000) => {
    // Stop any existing monitoring
    get().stopHealthMonitoring();

    // Initial health check
    get().checkHealth();

    // Start periodic health checks
    const interval = setInterval(() => {
      if (get().isConnected || get().isReconnecting) {
        get().checkHealth();
      }
    }, intervalMs);

    set({ healthCheckInterval: interval });
  },

  stopHealthMonitoring: () => {
    const interval = get().healthCheckInterval;
    if (interval) {
      clearInterval(interval);
      set({ healthCheckInterval: null });
    }
  },

  attemptReconnect: async () => {
    const { lastConnectedContext, reconnectAttempts, maxReconnectAttempts, isReconnecting } = get();

    if (!lastConnectedContext || isReconnecting) {
      return false;
    }

    if (reconnectAttempts >= maxReconnectAttempts) {
      console.error(`Max reconnect attempts (${maxReconnectAttempts}) reached`);
      set({
        isReconnecting: false,
        error: `Failed to reconnect after ${maxReconnectAttempts} attempts`,
      });
      return false;
    }

    set({ isReconnecting: true, reconnectAttempts: reconnectAttempts + 1 });

    // Calculate backoff delay
    const delay = getBackoffDelay(reconnectAttempts);
    debug(`Attempting reconnect in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);

    // Wait for backoff delay
    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      const status = await connectCluster(lastConnectedContext);
      if (status.connected) {
        const clusters = get().clusters;
        const currentCluster = clusters.find((c) => c.context === lastConnectedContext) || null;
        set({
          isConnected: true,
          currentCluster,
          isReconnecting: false,
          reconnectAttempts: 0,
          error: null,
          latencyMs: status.latency_ms,
          lastHealthCheck: new Date(),
          isHealthy: true,
        });
        // Refetch namespaces
        get().fetchNamespaces();
        debug("Reconnected successfully");
        return true;
      } else {
        // Retry
        return get().attemptReconnect();
      }
    } catch (e) {
      console.error("Reconnect attempt failed:", e);
      // Retry
      return get().attemptReconnect();
    }
  },

  setAutoReconnect: (enabled) => set({ autoReconnectEnabled: enabled }),
  resetReconnectAttempts: () => set({ reconnectAttempts: 0, isReconnecting: false }),
}));
