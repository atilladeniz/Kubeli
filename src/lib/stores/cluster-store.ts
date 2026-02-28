import { create } from "zustand";
import type { Cluster, ConnectionStatus, HealthCheckResult, NamespaceSource } from "../types";
import { type KubeliError, toKubeliError, getErrorMessage } from "../types/errors";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  listClusters,
  connectCluster,
  disconnectCluster,
  getConnectionStatus,
  getNamespaces,
  checkConnectionHealth,
  watchNamespaces,
  stopWatch,
  setClusterAccessibleNamespaces,
  clearClusterSettings,
} from "../tauri/commands";
import { useResourceCacheStore } from "./resource-cache-store";
import type { WatchEvent } from "../types";

// Debug logger - only logs in development
const isDev = process.env.NODE_ENV === "development";
const debug = (...args: unknown[]) => {
  if (isDev) console.log("[Cluster]", ...args);
};

interface ClusterState {
  clusters: Cluster[];
  currentCluster: Cluster | null;
  selectedNamespaces: string[];
  /** @deprecated Use selectedNamespaces. Derived: single selected ns or "" */
  currentNamespace: string;
  namespaces: string[];
  namespaceSource: NamespaceSource;
  isConnected: boolean;
  isLoading: boolean;
  error: KubeliError | null;
  lastConnectionErrorContext: string | null;
  lastConnectionErrorMessage: string | null;

  // Health monitoring
  latencyMs: number | null;
  lastHealthCheck: Date | null;
  isHealthy: boolean;
  healthCheckInterval: ReturnType<typeof setInterval> | null;

  // Namespace watch
  namespaceWatchId: string | null;
  namespaceWatchUnlisten: UnlistenFn | null;

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
  setSelectedNamespaces: (namespaces: string[]) => void;
  toggleNamespace: (ns: string) => void;
  selectAllNamespaces: () => void;
  /** @deprecated Use setSelectedNamespaces. Kept for backward compatibility. */
  setCurrentNamespace: (namespace: string) => void;
  setError: (error: KubeliError | null) => void;

  // Accessible namespace actions
  saveAccessibleNamespaces: (context: string, namespaces: string[]) => Promise<void>;
  clearAccessibleNamespaces: (context: string) => Promise<void>;

  // Namespace watch actions
  startNamespaceWatch: () => Promise<void>;
  stopNamespaceWatch: () => Promise<void>;

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

// Helper: derive currentNamespace from selectedNamespaces for backward compat
const deriveCurrentNamespace = (selectedNamespaces: string[]): string =>
  selectedNamespaces.length === 1 ? selectedNamespaces[0] : "";

export const useClusterStore = create<ClusterState>((set, get) => ({
  clusters: [],
  currentCluster: null,
  selectedNamespaces: [],
  currentNamespace: "",
  namespaces: [],
  namespaceSource: "none",
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

  // Namespace watch initial state
  namespaceWatchId: null,
  namespaceWatchUnlisten: null,

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
        selectedNamespaces: [],
        isLoading: false,
      });
    } catch (e) {
      set({
        error: toKubeliError(e),
        isLoading: false,
      });
    }
  },

  connect: async (context: string) => {
    set({ isLoading: true, isReconnecting: false });
    useResourceCacheStore.getState().clearCache();
    try {
      const status = await connectCluster(context);
      if (status.connected) {
        const clusters = get().clusters;
        const currentCluster = clusters.find((c) => c.context === context) || null;
        set({
          isConnected: true,
          currentCluster,
          selectedNamespaces: [],
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
        // Fetch namespaces after connecting, then start watch for live updates
        await get().fetchNamespaces();
        // Only start namespace watch for auto-discovered namespaces (not configured)
        if (get().namespaceSource === "auto") {
          get().startNamespaceWatch();
        }
        // Start health monitoring
        get().startHealthMonitoring();
      } else {
        const errorMessage = status.error || "Failed to connect";
        set({
          isConnected: false,
          error: toKubeliError(errorMessage),
          isLoading: false,
          isHealthy: false,
          lastConnectionErrorContext: context,
          lastConnectionErrorMessage: errorMessage,
        });
      }
      return status;
    } catch (e) {
      const errorMsg = getErrorMessage(e);
      set({
        error: toKubeliError(e),
        isLoading: false,
        isConnected: false,
        isHealthy: false,
        lastConnectionErrorContext: context,
        lastConnectionErrorMessage: errorMsg,
      });
      return { connected: false, context, error: errorMsg, latency_ms: null };
    }
  },

  disconnect: async () => {
    // Stop health monitoring and namespace watch before disconnecting
    get().stopHealthMonitoring();
    get().stopNamespaceWatch();
    useResourceCacheStore.getState().clearCache();
    try {
      await disconnectCluster();
      // Keep currentCluster so port forward badge still shows on the correct cluster card
      set({
        isConnected: false,
        selectedNamespaces: [],
        namespaces: [],
        namespaceSource: "none",
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
        error: toKubeliError(e),
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
      const result = await getNamespaces();
      set({
        namespaces: result.namespaces,
        namespaceSource: result.source as NamespaceSource,
      });
    } catch (e) {
      console.error("Failed to fetch namespaces:", e);
    }
  },

  setSelectedNamespaces: (namespaces) =>
    set({ selectedNamespaces: namespaces, currentNamespace: deriveCurrentNamespace(namespaces) }),
  toggleNamespace: (ns) => {
    const { selectedNamespaces } = get();
    const next = selectedNamespaces.includes(ns)
      ? selectedNamespaces.filter((n) => n !== ns)
      : [...selectedNamespaces, ns];
    set({ selectedNamespaces: next, currentNamespace: deriveCurrentNamespace(next) });
  },
  selectAllNamespaces: () => set({ selectedNamespaces: [], currentNamespace: "" }),
  setCurrentNamespace: (namespace) => {
    const next = namespace ? [namespace] : [];
    set({ selectedNamespaces: next, currentNamespace: deriveCurrentNamespace(next) });
  },
  setError: (error) =>
    set((state) => ({
      error,
      lastConnectionErrorContext: error ? state.lastConnectionErrorContext : null,
      lastConnectionErrorMessage: error ? state.lastConnectionErrorMessage : null,
    })),

  saveAccessibleNamespaces: async (context, namespaces) => {
    await setClusterAccessibleNamespaces(context, namespaces);
    // Stop any active namespace watch (configured namespaces are static)
    await get().stopNamespaceWatch();
    set({
      namespaces,
      namespaceSource: "configured",
      selectedNamespaces: [],
      currentNamespace: "",
    });
  },

  clearAccessibleNamespaces: async (context) => {
    await clearClusterSettings(context);
    set({ namespaceSource: "none", namespaces: [], selectedNamespaces: [], currentNamespace: "" });
    // Re-fetch namespaces via auto-discovery
    await get().fetchNamespaces();
    if (get().namespaceSource === "auto") {
      get().startNamespaceWatch();
    }
  },

  startNamespaceWatch: async () => {
    // Stop any existing watch first
    await get().stopNamespaceWatch();

    const id = `namespaces-${Date.now()}`;
    try {
      await watchNamespaces(id);
      set({ namespaceWatchId: id });

      const unlisten = await listen<WatchEvent<{ name: string }>>(
        `namespaces-watch-${id}`,
        (event) => {
          const watchEvent = event.payload;
          const { namespaces } = get();

          switch (watchEvent.type) {
            case "Added":
            case "Modified": {
              const name = (watchEvent.data as { name: string }).name;
              if (!namespaces.includes(name)) {
                set({ namespaces: [...namespaces, name].sort() });
              }
              break;
            }
            case "Deleted": {
              const name = (watchEvent.data as { name: string }).name;
              const { selectedNamespaces } = get();
              const updates: Partial<ClusterState> = {
                namespaces: namespaces.filter((ns) => ns !== name),
              };
              // Remove deleted namespace from selection
              if (selectedNamespaces.includes(name)) {
                const next = selectedNamespaces.filter((ns) => ns !== name);
                updates.selectedNamespaces = next;
                updates.currentNamespace = deriveCurrentNamespace(next);
              }
              set(updates);
              break;
            }
            case "Error": {
              debug("Namespace watch error:", watchEvent.data);
              break;
            }
          }
        }
      );

      set({ namespaceWatchUnlisten: unlisten });
      debug("Started namespace watch:", id);
    } catch (e) {
      console.error("Failed to start namespace watch:", e);
    }
  },

  stopNamespaceWatch: async () => {
    const { namespaceWatchId, namespaceWatchUnlisten } = get();
    if (namespaceWatchUnlisten) {
      namespaceWatchUnlisten();
    }
    if (namespaceWatchId) {
      try {
        await stopWatch(namespaceWatchId);
      } catch {
        // Watch may already be stopped
      }
    }
    set({ namespaceWatchId: null, namespaceWatchUnlisten: null });
  },

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

      // If connection was healthy and is now unhealthy, trigger auto-reconnect
      if (wasConnected && wasHealthy && !result.healthy) {
        console.warn("Connection health check failed, connection lost");
        set({ isConnected: false, error: toKubeliError(result.error || "Connection lost") });

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
      const errorMsg = getErrorMessage(e);
      set({
        isHealthy: false,
        lastHealthCheck: new Date(),
        error: toKubeliError(e),
      });
      return { healthy: false, latency_ms: null, error: errorMsg };
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
        error: toKubeliError(`Failed to reconnect after ${maxReconnectAttempts} attempts`),
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
        // Refetch namespaces and restart watch
        get().fetchNamespaces();
        get().startNamespaceWatch();
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
