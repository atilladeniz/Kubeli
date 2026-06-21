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
  setClusterPreferKubeconfigAuth,
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
  // Bumped on every connect() start and on cancel/disconnect. A connect attempt
  // captures it and drops its result if the value changed while it was awaiting,
  // so a cancelled-but-still-running connect can't flip state back to connected.
  connectGeneration: number;
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

  // OIDC interactive auth (browser flow in progress)
  oidcPendingContext: string | null;
  oidcCallbackUnlisten: UnlistenFn | null;
  oidcAuthTimeout: ReturnType<typeof setTimeout> | null;
  /** Context whose native OIDC flow just timed out — drives the
   *  "use kubeconfig auth instead" suggestion in the error banner (#335). */
  oidcTimedOutContext: string | null;

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
  /** Cancel any in-flight OIDC browser auth, clearing its listener and timeout. */
  cancelOidcAuth: () => void;
  /** User-initiated abort of a pending connect (e.g. closed the OIDC browser):
   *  cancels the OIDC wait and drops the loading state so the card resets. */
  cancelConnect: () => void;
  /** Enable "use kubeconfig auth only" for a context and immediately reconnect (#335). */
  fallbackToKubeconfigAuth: (
    context: string,
    expectedGeneration?: number,
  ) => Promise<ConnectionStatus>;
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
  connectGeneration: 0,
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

  // OIDC interactive auth initial state
  oidcPendingContext: null,
  oidcCallbackUnlisten: null,
  oidcAuthTimeout: null,
  oidcTimedOutContext: null,

  // Auto-reconnect initial state
  reconnectAttempts: 0,
  isReconnecting: false,
  autoReconnectEnabled: true,
  lastConnectedContext: null,
  maxReconnectAttempts: 5,

  fetchClusters: async () => {
    set({ isLoading: true, error: null });
    try {
      const clusters = await listClusters();
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
    const generation = get().connectGeneration + 1;
    set({
      connectGeneration: generation,
      isLoading: true,
      isReconnecting: false,
      oidcTimedOutContext: null,
    });
    // True once a newer connect started or the user cancelled/disconnected while
    // this attempt was awaiting — then we must not apply its (stale) result.
    const superseded = () => get().connectGeneration !== generation;
    useResourceCacheStore.getState().clearCache();
    try {
      const status = await connectCluster(context);
      // A hung non-OIDC connect (exec/cert) can resolve long after the user hit
      // Cancel; dropping it here keeps the cancel from being undone.
      if (superseded()) return status;
      if (status.oidc_auth_required) {
        const { issuer_url, client_id, extra_scopes } = status.oidc_auth_required;
        set({ isLoading: true });

        const { oidcStartAuth, oidcHandleCallback } = await import("../tauri/commands/oidc");

        // The module import is awaited; if the user cancelled / a newer attempt
        // started meanwhile, bail BEFORE cancelOidcAuth — otherwise we'd clear a
        // newer attempt's listener/timeout from the shared OIDC state. No local
        // listener exists yet, so there's nothing of ours to tear down.
        if (superseded()) return status;

        // Clear any previous in-flight OIDC auth so repeated connects during the
        // browser wait cannot accumulate duplicate listeners/timeouts.
        get().cancelOidcAuth();

        // Register the oidc-callback listener BEFORE oidcStartAuth opens the
        // browser. With a warm SSO session the browser can round-trip and emit
        // "oidc-callback" almost immediately; a listener registered only after
        // oidcStartAuth resolved could miss it and strand the flow until the
        // 120s timeout, since Tauri does not buffer events for late listeners.
        const { listen } = await import("@tauri-apps/api/event");
        let callbackHandled = false;
        const unlisten = await listen<{ code: string; state: string }>(
          "oidc-callback",
          async (event) => {
            // If the user cancelled/disconnected while the browser was open, a
            // late warm-SSO callback must not resurrect the connect. The
            // superseding actor already removed this listener; just drop the
            // event (don't call cancelOidcAuth, which could tear down a newer
            // attempt's listener).
            if (superseded()) return;
            callbackHandled = true;
            get().cancelOidcAuth();
            try {
              const callbackResult = await oidcHandleCallback(
                event.payload.code,
                event.payload.state
              );
              // The token exchange can take >1s (e.g. Entra); if the user
              // cancelled/disconnected during it, neither resurrect the connect
              // nor overwrite the terminal state with an auth error.
              if (superseded()) return;
              if (callbackResult.status === "authenticated") {
                await get().connect(context);
              } else {
                set({ error: toKubeliError("OIDC authentication failed"), isLoading: false });
              }
            } catch {
              if (superseded()) return;
              set({ error: toKubeliError("OIDC authentication failed"), isLoading: false });
            }
          }
        );

        // listen() is awaited; if the user cancelled / a newer attempt started
        // meanwhile, tear down only OUR just-registered listener and bail BEFORE
        // writing it into shared state — otherwise we'd overwrite a newer
        // attempt's oidcCallbackUnlisten and strand it.
        if (superseded()) {
          unlisten();
          return status;
        }

        // Track the listener in state immediately (not only after auth_pending),
        // so a cancel/disconnect during the oidcStartAuth wait can tear it down.
        set({ oidcCallbackUnlisten: unlisten });

        let authResult: Awaited<ReturnType<typeof oidcStartAuth>>;
        try {
          authResult = await oidcStartAuth(issuer_url, client_id, extra_scopes);
        } catch (e) {
          // Check superseded BEFORE touching OIDC state: a late rejection from a
          // cancelled attempt must not call cancelOidcAuth and tear down a newer
          // attempt's listener/timeout (which would strand it). It also must not
          // auto-fall-back, which would persist prefer_kubeconfig_auth=true and
          // reconnect behind the user's back.
          if (superseded()) {
            unlisten();
            return status;
          }
          get().cancelOidcAuth();
          // Native OIDC couldn't even start — typically OIDC discovery failing
          // (unreachable issuer, private-CA/TLS error, or an Azure/Entra issuer
          // the generic OIDC discovery can't handle). We only got here because
          // the kubeconfig has an oidc-login exec provider, which already works
          // with kubectl, so fall back to it automatically instead of dead-ending
          // on the error (#335).
          debug("Native OIDC start failed, falling back to kubeconfig auth:", e);
          return get().fallbackToKubeconfigAuth(context, generation);
        }

        // The browser auth started; if the user cancelled/disconnected meanwhile,
        // tear down only our listener and bail before arming a timeout, driving
        // the callback flow, or writing state for an abandoned attempt.
        if (superseded()) {
          unlisten();
          return status;
        }

        // A cached/refreshed token authenticated without opening the browser, so
        // the callback listener is unused — tear it down and retry the connect.
        if (authResult.status === "authenticated") {
          get().cancelOidcAuth();
          const retryStatus = await connectCluster(context);
          if (superseded()) return retryStatus;
          if (retryStatus.connected) {
            const clusters = get().clusters;
            const currentCluster = clusters.find((c) => c.context === context) || null;
            set({
              isConnected: true,
              currentCluster,
              selectedNamespaces: [],
              error: null,
              isLoading: false,
              latencyMs: retryStatus.latency_ms,
              lastHealthCheck: new Date(),
              isHealthy: true,
              lastConnectedContext: context,
              reconnectAttempts: 0,
              lastConnectionErrorContext: null,
              lastConnectionErrorMessage: null,
            });
            await get().fetchNamespaces();
            // A disconnect during fetchNamespaces() would leave a leaked watch
            // and health interval running for a connection that's already gone.
            if (superseded()) return retryStatus;
            if (get().namespaceSource === "auto") {
              get().startNamespaceWatch();
            }
            get().startHealthMonitoring();
            return retryStatus;
          }
          const retryError = retryStatus.error || "Connection failed after OIDC authentication";
          set({
            isConnected: false,
            error: toKubeliError(retryError),
            isLoading: false,
            isHealthy: false,
            lastConnectionErrorContext: context,
            lastConnectionErrorMessage: retryError,
          });
          return retryStatus;
        }

        if (authResult.status === "auth_pending") {
          // The browser is open; the listener is already armed. If the callback
          // already arrived during the start-auth round trip, the handler has
          // driven the flow — don't arm a stale timeout over a finished auth.
          if (callbackHandled) {
            get().cancelOidcAuth();
            return status;
          }
          const OIDC_TIMEOUT_MS = 120_000;
          const timeout = setTimeout(() => {
            get().cancelOidcAuth();
            // A non-OIDC connect to another cluster doesn't clear this timeout
            // (only cancelOidcAuth/a new auth does). If such a connect happened
            // while the browser sat open, don't write a stale timeout error over
            // the newer connection's state ~120s later.
            if (superseded()) return;
            set({
              error: toKubeliError("OIDC authentication timed out — no response from browser"),
              isLoading: false,
              // Remember which context timed out so the error banner can offer
              // the kubeconfig-auth fallback for it (#335).
              oidcTimedOutContext: context,
            });
          }, OIDC_TIMEOUT_MS);
          set({
            oidcPendingContext: context,
            oidcCallbackUnlisten: unlisten,
            oidcAuthTimeout: timeout,
          });
          return status;
        }

        // Unexpected status — don't leak the listener.
        get().cancelOidcAuth();
      }
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
        // A disconnect during fetchNamespaces() would leave a leaked watch and
        // health interval running for a connection that's already gone.
        if (superseded()) return status;
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
      // A failure from a cancelled/superseded attempt must not overwrite the
      // state the newer attempt (or the cancel) already set.
      if (superseded()) {
        return { connected: false, context, error: errorMsg, latency_ms: null, oidc_auth_required: null };
      }
      set({
        error: toKubeliError(e),
        isLoading: false,
        isConnected: false,
        isHealthy: false,
        lastConnectionErrorContext: context,
        lastConnectionErrorMessage: errorMsg,
      });
      return { connected: false, context, error: errorMsg, latency_ms: null, oidc_auth_required: null };
    }
  },

  cancelOidcAuth: () => {
    const { oidcAuthTimeout, oidcCallbackUnlisten } = get();
    if (oidcAuthTimeout) clearTimeout(oidcAuthTimeout);
    oidcCallbackUnlisten?.();
    set({ oidcAuthTimeout: null, oidcCallbackUnlisten: null, oidcPendingContext: null });
  },

  cancelConnect: () => {
    get().cancelOidcAuth();
    // Bump the generation so an in-flight connect (including a hung non-OIDC
    // exec/cert connect) drops its result instead of flipping us to connected.
    set({
      connectGeneration: get().connectGeneration + 1,
      isLoading: false,
      oidcTimedOutContext: null,
    });
  },

  fallbackToKubeconfigAuth: async (context, expectedGeneration) => {
    get().cancelOidcAuth();
    // Auto-fallback (connect() catch) passes the originating attempt's
    // generation; the manual banner button passes none, so baseline against the
    // current generation. Either way, if a connect/cancel/disconnect happens
    // while the preference write is in flight, abort rather than reconnect
    // behind the user's newer action.
    const baseline = expectedGeneration ?? get().connectGeneration;
    await setClusterPreferKubeconfigAuth(context, true);
    if (get().connectGeneration !== baseline) {
      return { connected: false, context, error: null, latency_ms: null, oidc_auth_required: null };
    }
    set({ error: null, oidcTimedOutContext: null });
    return get().connect(context);
  },

  disconnect: async () => {
    // Stop any in-flight OIDC auth, health monitoring and namespace watch first.
    // Bumping the generation also drops any connect that's still awaiting.
    get().cancelOidcAuth();
    get().stopHealthMonitoring();
    get().stopNamespaceWatch();
    const generation = get().connectGeneration + 1;
    set({ connectGeneration: generation });
    useResourceCacheStore.getState().clearCache();
    try {
      await disconnectCluster();
      // A connect started after this disconnect (newer generation) wins — don't
      // clobber its freshly-established state with our teardown.
      if (get().connectGeneration !== generation) return;
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
      // A connect that started during disconnectCluster()'s await (newer
      // generation) wins — don't overwrite its state with a stale disconnect error.
      if (get().connectGeneration !== generation) return;
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
    // Clear only the namespace list, not the whole context entry, so the
    // prefer_kubeconfig_auth flag (#335) survives. The Rust setter drops the
    // entry automatically if nothing meaningful remains.
    await setClusterAccessibleNamespaces(context, []);
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

    // Capture the connect generation so a manual connect or an explicit
    // disconnect during the backoff/connect drops this auto-reconnect instead
    // of resurrecting a connection the user already moved on from.
    const generation = get().connectGeneration;
    const superseded = () => get().connectGeneration !== generation;

    // Calculate backoff delay
    const delay = getBackoffDelay(reconnectAttempts);
    debug(`Attempting reconnect in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);

    // Wait for backoff delay
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (superseded()) {
      set({ isReconnecting: false });
      return false;
    }

    try {
      const status = await connectCluster(lastConnectedContext);
      if (superseded()) {
        set({ isReconnecting: false });
        return false;
      }
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
      // A manual connect / explicit disconnect during the failed attempt wins —
      // stop retrying instead of fighting the user's newer action.
      if (superseded()) {
        set({ isReconnecting: false });
        return false;
      }
      // Retry
      return get().attemptReconnect();
    }
  },

  setAutoReconnect: (enabled) => set({ autoReconnectEnabled: enabled }),
  resetReconnectAttempts: () => set({ reconnectAttempts: 0, isReconnecting: false }),
}));
