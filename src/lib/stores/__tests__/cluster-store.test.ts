import { act } from "@testing-library/react";
import { listen } from "@tauri-apps/api/event";
import { useClusterStore } from "../cluster-store";
import { toKubeliError } from "../../types/errors";

// Mock Tauri commands
const mockListClusters = jest.fn();
const mockConnectCluster = jest.fn();
const mockDisconnectCluster = jest.fn();
const mockGetConnectionStatus = jest.fn();
const mockGetNamespaces = jest.fn();
const mockCheckConnectionHealth = jest.fn();
const mockWatchNamespaces = jest.fn();
const mockStopWatch = jest.fn();
const mockOidcStartAuth = jest.fn();
const mockOidcHandleCallback = jest.fn();
const mockSetClusterPreferKubeconfigAuth = jest.fn();
const mockSetClusterAccessibleNamespaces = jest.fn();

jest.mock("../../tauri/commands", () => ({
  listClusters: () => mockListClusters(),
  connectCluster: (context: string) => mockConnectCluster(context),
  disconnectCluster: () => mockDisconnectCluster(),
  getConnectionStatus: () => mockGetConnectionStatus(),
  getNamespaces: () => mockGetNamespaces(),
  checkConnectionHealth: () => mockCheckConnectionHealth(),
  watchNamespaces: (watchId: string) => mockWatchNamespaces(watchId),
  stopWatch: (watchId: string) => mockStopWatch(watchId),
  setClusterPreferKubeconfigAuth: (context: string, prefer: boolean) =>
    mockSetClusterPreferKubeconfigAuth(context, prefer),
  setClusterAccessibleNamespaces: (context: string, namespaces: string[]) =>
    mockSetClusterAccessibleNamespaces(context, namespaces),
}));

jest.mock("../../tauri/commands/oidc", () => ({
  oidcStartAuth: (issuer: string, clientId: string, scopes: string[]) =>
    mockOidcStartAuth(issuer, clientId, scopes),
  oidcHandleCallback: (code: string, state: string) =>
    mockOidcHandleCallback(code, state),
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
  selectedNamespaces: [] as string[],
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
      expect(state.error?.message).toBe("Network error");
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
      mockGetNamespaces.mockResolvedValue({ namespaces: ["default", "kube-system"], source: "auto" });
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
      mockGetNamespaces.mockResolvedValue({ namespaces: ["default"], source: "auto" });
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
      expect(state.error?.message).toBe("Connection refused");
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
      expect(state.error?.message).toBe("Timeout");
    });
  });

  describe("connect with OIDC auth", () => {
    beforeEach(() => {
      useClusterStore.setState({ clusters: mockClusters });
    });

    it("registers the oidc-callback listener before opening the browser", async () => {
      mockConnectCluster.mockResolvedValue({
        connected: false,
        context: "oidc-context",
        oidc_auth_required: {
          issuer_url: "https://issuer.example.com",
          client_id: "kubeli",
          extra_scopes: [],
        },
      });
      const unlisten = jest.fn();
      (listen as jest.Mock).mockResolvedValue(unlisten);
      mockOidcStartAuth.mockResolvedValue({
        status: "auth_pending",
        auth_url: "https://issuer.example.com/auth",
        token: null,
      });

      await act(async () => {
        await useClusterStore.getState().connect("oidc-context");
      });

      // Regression: a warm SSO session can emit "oidc-callback" the instant the
      // browser opens. The listener must be registered before oidcStartAuth (which
      // opens the browser), or the event is lost and the flow stalls for 120s.
      const callbackListenIdx = (listen as jest.Mock).mock.calls.findIndex(
        ([channel]) => channel === "oidc-callback"
      );
      expect(callbackListenIdx).toBeGreaterThanOrEqual(0);
      const listenOrder = (listen as jest.Mock).mock.invocationCallOrder[
        callbackListenIdx
      ];
      expect(listenOrder).toBeLessThan(mockOidcStartAuth.mock.invocationCallOrder[0]);

      // The pending flow is tracked so disconnect()/a later connect() can cancel it.
      const state = useClusterStore.getState();
      expect(state.oidcPendingContext).toBe("oidc-context");
      expect(state.oidcCallbackUnlisten).toBe(unlisten);

      useClusterStore.getState().cancelOidcAuth();
    });

    it("tears down the listener when a cached token authenticates without a browser", async () => {
      mockConnectCluster
        .mockResolvedValueOnce({
          connected: false,
          context: "oidc-context",
          oidc_auth_required: {
            issuer_url: "https://issuer.example.com",
            client_id: "kubeli",
            extra_scopes: [],
          },
        })
        .mockResolvedValueOnce({
          connected: true,
          context: "oidc-context",
          latency_ms: 12,
        });
      const unlisten = jest.fn();
      (listen as jest.Mock).mockResolvedValue(unlisten);
      mockOidcStartAuth.mockResolvedValue({
        status: "authenticated",
        auth_url: null,
        token: "id-token",
      });
      mockGetNamespaces.mockResolvedValue({ namespaces: ["default"], source: "auto" });
      mockCheckConnectionHealth.mockResolvedValue({ healthy: true, latency_ms: 12 });
      mockWatchNamespaces.mockResolvedValue(undefined);

      await act(async () => {
        await useClusterStore.getState().connect("oidc-context");
      });

      // No browser round-trip happened, so the unused listener must be removed and
      // no pending OIDC state left behind.
      expect(unlisten).toHaveBeenCalledTimes(1);
      const state = useClusterStore.getState();
      expect(state.isConnected).toBe(true);
      expect(state.oidcPendingContext).toBeNull();
      expect(state.oidcAuthTimeout).toBeNull();
    });

    it("falls back to kubeconfig auth when native OIDC discovery fails (#335)", async () => {
      // 1st connect → needs OIDC; native start fails (e.g. discovery/TLS); the
      // retry after enabling the flag connects via the exec provider.
      mockConnectCluster
        .mockResolvedValueOnce({
          connected: false,
          context: "oidc-context",
          oidc_auth_required: {
            issuer_url: "https://host.minikube.internal:5556/dex",
            client_id: "kubeli",
            extra_scopes: [],
          },
        })
        .mockResolvedValueOnce({ connected: true, context: "oidc-context", latency_ms: 7 });
      const unlisten = jest.fn();
      (listen as jest.Mock).mockResolvedValue(unlisten);
      mockOidcStartAuth.mockRejectedValue(new Error("Failed OIDC discovery: Request failed"));
      mockSetClusterPreferKubeconfigAuth.mockResolvedValue(undefined);
      mockGetNamespaces.mockResolvedValue({ namespaces: ["default"], source: "auto" });
      mockCheckConnectionHealth.mockResolvedValue({ healthy: true, latency_ms: 7 });
      mockWatchNamespaces.mockResolvedValue(undefined);

      await act(async () => {
        await useClusterStore.getState().connect("oidc-context");
      });

      // The flag was persisted and a reconnect happened, ending connected with no error.
      expect(mockSetClusterPreferKubeconfigAuth).toHaveBeenCalledWith("oidc-context", true);
      expect(mockConnectCluster).toHaveBeenCalledTimes(2);
      const state = useClusterStore.getState();
      expect(state.isConnected).toBe(true);
      expect(state.error).toBeNull();
      expect(state.oidcPendingContext).toBeNull();
    });

    it("does not persist kubeconfig-auth fallback if cancelled during OIDC start", async () => {
      // If the user cancels while native OIDC is starting and it then fails, the
      // auto-fallback must NOT run — it would write prefer_kubeconfig_auth=true to
      // disk and reconnect behind the user's back (review finding).
      mockConnectCluster.mockResolvedValue({
        connected: false,
        context: "oidc-context",
        oidc_auth_required: {
          issuer_url: "https://issuer.example.com",
          client_id: "kubeli",
          extra_scopes: [],
        },
      });
      const unlisten = jest.fn();
      (listen as jest.Mock).mockResolvedValue(unlisten);
      let rejectStart!: (e: unknown) => void;
      mockOidcStartAuth.mockImplementation(
        () => new Promise((_, reject) => { rejectStart = reject; }),
      );
      mockSetClusterPreferKubeconfigAuth.mockResolvedValue(undefined);

      let connectPromise!: Promise<unknown>;
      await act(async () => {
        connectPromise = useClusterStore.getState().connect("oidc-context");
        // Let connect() reach the pending oidcStartAuth await.
        await new Promise((r) => setTimeout(r, 0));
      });

      // User cancels while oidcStartAuth is still pending.
      useClusterStore.getState().cancelConnect();

      await act(async () => {
        rejectStart(new Error("Failed OIDC discovery"));
        await connectPromise;
      });

      // Fallback was suppressed: nothing persisted, listener torn down, no reconnect.
      expect(mockSetClusterPreferKubeconfigAuth).not.toHaveBeenCalled();
      expect(unlisten).toHaveBeenCalled();
      expect(mockConnectCluster).toHaveBeenCalledTimes(1);
      expect(useClusterStore.getState().isConnected).toBe(false);
    });

    it("ignores an oidc-callback that arrives after cancel during OIDC start", async () => {
      // A warm SSO session can emit oidc-callback while oidcStartAuth is still
      // pending. If the user already cancelled, the callback must not resurrect
      // the connect (recursive connect / disk persist) — review finding.
      mockConnectCluster.mockResolvedValue({
        connected: false,
        context: "oidc-context",
        oidc_auth_required: {
          issuer_url: "https://issuer.example.com",
          client_id: "kubeli",
          extra_scopes: [],
        },
      });
      const unlisten = jest.fn();
      let capturedCallback!: (event: {
        payload: { code: string; state: string };
      }) => Promise<void> | void;
      (listen as jest.Mock).mockImplementation((_channel, cb) => {
        capturedCallback = cb;
        return Promise.resolve(unlisten);
      });
      // oidcStartAuth stays pending so we can cancel mid-flight.
      mockOidcStartAuth.mockImplementation(() => new Promise(() => {}));
      mockOidcHandleCallback.mockResolvedValue({ status: "authenticated" });
      mockSetClusterPreferKubeconfigAuth.mockResolvedValue(undefined);

      await act(async () => {
        void useClusterStore.getState().connect("oidc-context");
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 0));
      });

      // User cancels while oidcStartAuth is pending; the listener is torn down.
      useClusterStore.getState().cancelConnect();
      expect(unlisten).toHaveBeenCalled();

      // A late callback fires anyway — the superseded() guard must drop it.
      await act(async () => {
        await capturedCallback({ payload: { code: "c", state: "s" } });
      });

      expect(mockOidcHandleCallback).not.toHaveBeenCalled();
      expect(mockSetClusterPreferKubeconfigAuth).not.toHaveBeenCalled();
      expect(mockConnectCluster).toHaveBeenCalledTimes(1);
      expect(useClusterStore.getState().isConnected).toBe(false);
    });

    it("ignores a callback whose token exchange completes after cancel", async () => {
      // The callback passes the entry guard, then the token exchange (which can
      // take >1s on Entra) is still in flight when the user cancels. The result
      // must not resurrect the connect or overwrite the cancelled state.
      mockConnectCluster.mockResolvedValue({
        connected: false,
        context: "oidc-context",
        oidc_auth_required: {
          issuer_url: "https://issuer.example.com",
          client_id: "kubeli",
          extra_scopes: [],
        },
      });
      const unlisten = jest.fn();
      let capturedCallback!: (event: {
        payload: { code: string; state: string };
      }) => Promise<void> | void;
      (listen as jest.Mock).mockImplementation((_channel, cb) => {
        capturedCallback = cb;
        return Promise.resolve(unlisten);
      });
      mockOidcStartAuth.mockResolvedValue({
        status: "auth_pending",
        auth_url: "https://issuer.example.com/auth",
        token: null,
      });
      // The token exchange stays pending so we can cancel during it.
      let resolveHandle!: (value: unknown) => void;
      mockOidcHandleCallback.mockImplementation(
        () => new Promise((resolve) => { resolveHandle = resolve; }),
      );

      await act(async () => {
        void useClusterStore.getState().connect("oidc-context");
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 0));
      });

      // Callback arrives (passes the entry guard) and starts the token exchange.
      await act(async () => {
        void capturedCallback({ payload: { code: "c", state: "s" } });
        await Promise.resolve();
      });
      expect(mockOidcHandleCallback).toHaveBeenCalledTimes(1);

      // User cancels while the exchange is in flight.
      useClusterStore.getState().cancelConnect();

      // The exchange then resolves "authenticated" — must be dropped.
      await act(async () => {
        resolveHandle({ status: "authenticated" });
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockConnectCluster).toHaveBeenCalledTimes(1); // no recursive connect
      expect(useClusterStore.getState().isConnected).toBe(false);
      expect(useClusterStore.getState().error).toBeNull(); // no stale error write
    });

    it("a cancelled attempt's late failure does not tear down a newer attempt's listener", async () => {
      // Cancel+retry: attempt A is cancelled, attempt B registers its own
      // listener, then A's oidcStartAuth finally rejects. A's catch must tear
      // down only A's listener, not B's (which would strand B). Review finding.
      mockConnectCluster.mockResolvedValue({
        connected: false,
        context: "oidc-context",
        oidc_auth_required: {
          issuer_url: "https://issuer.example.com",
          client_id: "kubeli",
          extra_scopes: [],
        },
      });
      const unlistenA = jest.fn();
      const unlistenB = jest.fn();
      const unlistens = [unlistenA, unlistenB];
      let listenIdx = 0;
      (listen as jest.Mock).mockImplementation(() =>
        Promise.resolve(unlistens[listenIdx++] ?? jest.fn()),
      );
      let rejectA!: (e: unknown) => void;
      mockOidcStartAuth
        .mockImplementationOnce(() => new Promise((_, reject) => { rejectA = reject; }))
        .mockResolvedValueOnce({
          status: "auth_pending",
          auth_url: "https://issuer.example.com/auth",
          token: null,
        });
      mockSetClusterPreferKubeconfigAuth.mockResolvedValue(undefined);

      // Attempt A, then cancel it.
      await act(async () => {
        void useClusterStore.getState().connect("oidc-context");
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 0));
      });
      useClusterStore.getState().cancelConnect();
      expect(unlistenA).toHaveBeenCalled();

      // Attempt B registers its own listener and arms (auth_pending).
      await act(async () => {
        void useClusterStore.getState().connect("oidc-context");
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 0));
      });
      expect(useClusterStore.getState().oidcCallbackUnlisten).toBe(unlistenB);
      const bCallsBefore = unlistenB.mock.calls.length;

      // A's oidcStartAuth finally rejects — must not touch B's listener/state.
      await act(async () => {
        rejectA(new Error("discovery failed"));
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(unlistenB.mock.calls.length).toBe(bCallsBefore); // B intact
      expect(useClusterStore.getState().oidcCallbackUnlisten).toBe(unlistenB);
      expect(mockSetClusterPreferKubeconfigAuth).not.toHaveBeenCalled(); // no stale fallback

      useClusterStore.getState().cancelConnect(); // clear B's armed timeout
    });

    it("a superseded attempt in the setup window does not clobber a newer attempt's listener", async () => {
      // Attempt A parks at `await listen()`; while it's parked it gets cancelled
      // and attempt B fully arms. When A's listen() finally resolves, A must tear
      // down only its own listener and bail BEFORE writing to shared state — it
      // must not overwrite B's oidcCallbackUnlisten (review finding).
      mockConnectCluster.mockResolvedValue({
        connected: false,
        context: "oidc-context",
        oidc_auth_required: {
          issuer_url: "https://issuer.example.com",
          client_id: "kubeli",
          extra_scopes: [],
        },
      });
      const unlistenA = jest.fn();
      const unlistenB = jest.fn();
      let resolveListenA!: (fn: unknown) => void;
      const listenReturns: Array<Promise<unknown>> = [
        new Promise((resolve) => { resolveListenA = resolve; }), // A parks here
        Promise.resolve(unlistenB), // B resolves immediately
      ];
      let listenIdx = 0;
      (listen as jest.Mock).mockImplementation(
        () => listenReturns[listenIdx++] ?? Promise.resolve(jest.fn()),
      );
      mockOidcStartAuth.mockResolvedValue({
        status: "auth_pending",
        auth_url: "https://issuer.example.com/auth",
        token: null,
      });
      mockSetClusterPreferKubeconfigAuth.mockResolvedValue(undefined);

      // Attempt A starts and parks at await listen().
      await act(async () => {
        void useClusterStore.getState().connect("oidc-context");
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 0));
      });
      // Cancel A (it hasn't registered its listener yet).
      useClusterStore.getState().cancelConnect();

      // Attempt B starts, completes, and arms (its listener is in state).
      await act(async () => {
        void useClusterStore.getState().connect("oidc-context");
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 0));
      });
      expect(useClusterStore.getState().oidcCallbackUnlisten).toBe(unlistenB);

      // A's listen() finally resolves — A must not clobber B.
      await act(async () => {
        resolveListenA(unlistenA);
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(useClusterStore.getState().oidcCallbackUnlisten).toBe(unlistenB); // B intact
      expect(unlistenB).not.toHaveBeenCalled(); // B not torn down by A
      expect(unlistenA).toHaveBeenCalled(); // A's own listener torn down

      useClusterStore.getState().cancelConnect(); // clear B's armed timeout
    });

    it("auto-fallback aborts the reconnect if cancelled during the preference write", async () => {
      // oidcStartAuth fails -> auto-fallback persists the flag then reconnects.
      // A cancel while that disk write is in flight must abort the reconnect.
      mockConnectCluster.mockResolvedValue({
        connected: false,
        context: "oidc-context",
        oidc_auth_required: {
          issuer_url: "https://issuer.example.com",
          client_id: "kubeli",
          extra_scopes: [],
        },
      });
      (listen as jest.Mock).mockResolvedValue(jest.fn());
      mockOidcStartAuth.mockRejectedValue(new Error("Failed OIDC discovery"));
      let resolvePref!: () => void;
      mockSetClusterPreferKubeconfigAuth.mockImplementation(
        () => new Promise<void>((resolve) => { resolvePref = resolve; }),
      );

      let connectPromise!: Promise<unknown>;
      await act(async () => {
        connectPromise = useClusterStore.getState().connect("oidc-context");
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 0));
      });

      // Now parked in fallbackToKubeconfigAuth awaiting the preference write.
      useClusterStore.getState().cancelConnect();

      await act(async () => {
        resolvePref();
        await connectPromise;
      });

      // No reconnect happened (connectCluster only the initial call).
      expect(mockConnectCluster).toHaveBeenCalledTimes(1);
      expect(useClusterStore.getState().isConnected).toBe(false);
    });

    it("the manual kubeconfig-auth fallback aborts if a newer connect starts during the write", async () => {
      // The error-banner button passes no generation. If the user starts another
      // connect while the preference write is in flight, the fallback must not
      // then reconnect to its own (older) context behind that newer action.
      let resolvePref!: () => void;
      mockSetClusterPreferKubeconfigAuth.mockImplementation(
        () => new Promise<void>((resolve) => { resolvePref = resolve; }),
      );
      mockConnectCluster.mockResolvedValue({
        connected: true,
        context: "prod-context",
        latency_ms: 5,
      });
      mockGetNamespaces.mockResolvedValue({ namespaces: ["default"], source: "auto" });
      mockCheckConnectionHealth.mockResolvedValue({ healthy: true, latency_ms: 5 });
      mockWatchNamespaces.mockResolvedValue(undefined);

      // Manual fallback for the old context (no generation passed).
      let fallbackPromise!: Promise<unknown>;
      await act(async () => {
        fallbackPromise = useClusterStore.getState().fallbackToKubeconfigAuth("oidc-context");
        await Promise.resolve();
      });

      // A newer connect bumps the generation while the pref write is pending.
      await act(async () => {
        await useClusterStore.getState().connect("prod-context");
      });

      // The pref write resolves — the fallback must abort, not connect to its context.
      await act(async () => {
        resolvePref();
        await fallbackPromise;
      });

      expect(mockConnectCluster).toHaveBeenCalledTimes(1);
      expect(mockConnectCluster).toHaveBeenCalledWith("prod-context");
      useClusterStore.getState().stopHealthMonitoring();
    });

    it("the OIDC timeout does not write a stale error over a newer connection", async () => {
      jest.useFakeTimers();
      try {
        mockConnectCluster
          .mockResolvedValueOnce({
            connected: false,
            context: "oidc-context",
            oidc_auth_required: {
              issuer_url: "https://issuer.example.com",
              client_id: "kubeli",
              extra_scopes: [],
            },
          })
          .mockResolvedValueOnce({ connected: true, context: "prod-context", latency_ms: 5 });
        (listen as jest.Mock).mockResolvedValue(jest.fn());
        mockOidcStartAuth.mockResolvedValue({
          status: "auth_pending",
          auth_url: "https://issuer.example.com/auth",
          token: null,
        });
        mockGetNamespaces.mockResolvedValue({ namespaces: ["default"], source: "auto" });
        mockCheckConnectionHealth.mockResolvedValue({ healthy: true, latency_ms: 5 });
        mockWatchNamespaces.mockResolvedValue(undefined);

        // A: OIDC reaches auth_pending and arms the 120s timeout.
        await act(async () => {
          await useClusterStore.getState().connect("oidc-context");
        });
        expect(useClusterStore.getState().oidcAuthTimeout).not.toBeNull();

        // B: a non-OIDC connect to another cluster (bumps generation, connected).
        await act(async () => {
          await useClusterStore.getState().connect("prod-context");
        });
        expect(useClusterStore.getState().isConnected).toBe(true);
        useClusterStore.getState().stopHealthMonitoring(); // isolate the OIDC timeout

        // ~120s later A's timeout fires — it must not error over B.
        await act(async () => {
          jest.advanceTimersByTime(120_000);
        });

        expect(useClusterStore.getState().error).toBeNull();
        expect(useClusterStore.getState().isConnected).toBe(true);
        expect(useClusterStore.getState().oidcTimedOutContext).toBeNull();
      } finally {
        jest.useRealTimers();
      }
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
      expect(state.error?.message).toBe("Disconnect failed");
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
    it("should set error", () => {
      act(() => {
        useClusterStore.getState().setError(toKubeliError("Test error"));
      });

      expect(useClusterStore.getState().error?.message).toBe("Test error");
    });

    it("should clear error when set to null", () => {
      useClusterStore.setState({ error: toKubeliError("Previous error") });

      act(() => {
        useClusterStore.getState().setError(null);
      });

      expect(useClusterStore.getState().error).toBeNull();
    });
  });

  describe("fetchNamespaces", () => {
    it("should fetch namespaces when connected", async () => {
      useClusterStore.setState({ isConnected: true });
      mockGetNamespaces.mockResolvedValue({ namespaces: ["default", "kube-system", "monitoring"], source: "auto" });

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
        selectedNamespaces: ["active-ns"],
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
        selectedNamespaces: ["default"],
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
      expect(state.error?.message).toBe("Connection lost");
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
      expect(useClusterStore.getState().error?.message).toContain("Failed to reconnect");
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

    // Regression: retries re-entered attemptReconnect while isReconnecting was
    // still true and were swallowed by the reentrancy guard, so only 1 of the
    // configured attempts ever ran.
    it("retries up to maxReconnectAttempts when attempts keep failing", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      jest.useFakeTimers();
      try {
        mockConnectCluster.mockRejectedValue(new Error("cluster down"));
        useClusterStore.setState({
          lastConnectedContext: "test-context",
          reconnectAttempts: 0,
          maxReconnectAttempts: 3,
          isReconnecting: false,
        });

        const promise = useClusterStore.getState().attemptReconnect();
        await jest.runAllTimersAsync();
        const result = await promise;

        expect(result).toBe(false);
        expect(mockConnectCluster).toHaveBeenCalledTimes(3);
        expect(useClusterStore.getState().isReconnecting).toBe(false);
      } finally {
        jest.useRealTimers();
        errorSpy.mockRestore();
      }
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

  describe("cancelOidcAuth", () => {
    it("clears the in-flight OIDC listener and timeout", () => {
      const unlisten = jest.fn();
      const timeout = setTimeout(() => {}, 100_000);
      useClusterStore.setState({
        oidcPendingContext: "test-context",
        oidcCallbackUnlisten: unlisten,
        oidcAuthTimeout: timeout,
      });

      useClusterStore.getState().cancelOidcAuth();

      // The listener is removed exactly once (prevents duplicate oidc-callback
      // listeners accumulating across repeated connects) and all handles reset.
      expect(unlisten).toHaveBeenCalledTimes(1);
      const state = useClusterStore.getState();
      expect(state.oidcPendingContext).toBeNull();
      expect(state.oidcCallbackUnlisten).toBeNull();
      expect(state.oidcAuthTimeout).toBeNull();
    });

    it("is a no-op when no OIDC auth is in flight", () => {
      useClusterStore.setState({
        oidcPendingContext: null,
        oidcCallbackUnlisten: null,
        oidcAuthTimeout: null,
      });
      expect(() => useClusterStore.getState().cancelOidcAuth()).not.toThrow();
    });

    it("cancelConnect aborts a pending sign-in and clears the loading state", () => {
      // User closed the OIDC browser; the card must reset without waiting 120s.
      const unlisten = jest.fn();
      useClusterStore.setState({
        oidcPendingContext: "oidc-context",
        oidcCallbackUnlisten: unlisten,
        oidcAuthTimeout: setTimeout(() => {}, 100_000),
        isLoading: true,
      });

      useClusterStore.getState().cancelConnect();

      expect(unlisten).toHaveBeenCalledTimes(1);
      const state = useClusterStore.getState();
      expect(state.oidcPendingContext).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it("drops a hung non-OIDC connect result after cancelConnect", async () => {
      // A slow exec/cert connect can resolve connected=true long after the user
      // hit Cancel. The stale-result guard must keep that from undoing the cancel.
      let resolveConnect!: (value: unknown) => void;
      mockConnectCluster.mockImplementation(
        () => new Promise((resolve) => { resolveConnect = resolve; }),
      );

      let connectPromise!: Promise<unknown>;
      await act(async () => {
        connectPromise = useClusterStore.getState().connect("hung-context");
        await Promise.resolve(); // let connect() reach the await
      });

      // User cancels while connectCluster is still pending.
      useClusterStore.getState().cancelConnect();

      await act(async () => {
        resolveConnect({
          connected: true,
          context: "hung-context",
          latency_ms: 5,
          oidc_auth_required: null,
        });
        await connectPromise;
      });

      const state = useClusterStore.getState();
      expect(state.isConnected).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it("is invoked by disconnect to tear down a pending browser flow", async () => {
      const unlisten = jest.fn();
      mockDisconnectCluster.mockResolvedValue(undefined);
      useClusterStore.setState({
        oidcPendingContext: "test-context",
        oidcCallbackUnlisten: unlisten,
        oidcAuthTimeout: setTimeout(() => {}, 100_000),
      });

      await act(async () => {
        await useClusterStore.getState().disconnect();
      });

      expect(unlisten).toHaveBeenCalledTimes(1);
      expect(useClusterStore.getState().oidcPendingContext).toBeNull();
    });
  });
});
