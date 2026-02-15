## Context

Kubeli's current architecture is built around a single active cluster connection. The Rust backend holds one `Option<Client>`, the frontend store tracks one `currentCluster`, and all IPC commands operate on this implicit context. The cluster-management spec already requires simultaneous multi-cluster support, but the implementation deferred it. Analysis of other Tauri-based Kubernetes tools with the same stack (Tauri 2.7 + kube-rs 1.1.0) shows that multi-cluster is achieved through a client pool with per-context resource watchers and explicit context routing on all commands.

### References
- Current `KubeClientManager` in `src-tauri/src/k8s/client.rs` (single client)
- Current `cluster-store.ts` (single `currentCluster`)
- Existing per-context favorites/tabs in `Dashboard.tsx` (already scoped by `clusterContext`)
- Existing kubeconfig multi-source support (add-kubeconfig-sources change)

## Goals / Non-Goals

### Goals
- Support 2-10 simultaneously connected clusters with independent state
- Instant switching between connected clusters (< 100ms UI response)
- Per-cluster isolation: namespace selection, health status, resource watchers, tab history
- Cluster tab bar for visual indication and quick switching
- Graceful degradation: disconnecting one cluster doesn't affect others
- Preserve existing per-cluster favorites and tab restoration logic

### Non-Goals
- Cross-cluster resource aggregation view (future feature, out of scope)
- Cross-cluster resource comparison side-by-side (future feature)
- Cluster grouping / workspace management (future feature)
- Maximum connection limit enforcement (trust user judgment)
- Multi-cluster RBAC unification (each cluster has its own auth)

## Decisions

### 1. Client Pool Architecture (Rust Backend)

Replace the single client with a `HashMap<String, Client>` pool:

```rust
pub struct KubeClientManager {
    // BEFORE: single client
    // client: Arc<RwLock<Option<Client>>>,
    // current_context: Arc<RwLock<Option<String>>>,

    // AFTER: client pool keyed by context name
    clients: Arc<RwLock<HashMap<String, Client>>>,
    kubeconfig: Arc<RwLock<Option<ParsedKubeConfig>>>,
    connection_logs: Arc<RwLock<HashMap<String, String>>>,
}
```

**Key operations:**
- `connect_cluster(context: &str)` - Creates client, adds to pool
- `disconnect_cluster(context: &str)` - Removes client from pool, aborts watchers
- `get_client(context: &str) -> Result<Client>` - Retrieves client from pool
- `get_connected_contexts() -> Vec<String>` - Lists active connections

Each `Client` from kube-rs is `Clone` (uses `Arc` internally), so cloning for concurrent operations is cheap.

**Rationale**: HashMap pool is the proven pattern used by other Tauri+kube-rs tools. Per-context locking via RwLock allows concurrent reads across clusters.

### 2. Explicit Context Parameter on All Commands

Every IPC command that touches a cluster gets an explicit `context: String` parameter:

```rust
// BEFORE
#[tauri::command]
pub async fn list_namespaces(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let manager = state.kube_client.lock().await;
    let client = manager.get_client()?;
    // ...
}

// AFTER
#[tauri::command]
pub async fn list_namespaces(
    context: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let manager = state.kube_client.lock().await;
    let client = manager.get_client(&context)?;
    // ...
}
```

Frontend TypeScript bindings update accordingly:

```typescript
// BEFORE
export async function listNamespaces(): Promise<string[]> {
    return invoke('cluster:get_namespaces');
}

// AFTER
export async function listNamespaces(context: string): Promise<string[]> {
    return invoke('cluster:get_namespaces', { context });
}
```

**Rationale**: Explicit context routing eliminates ambiguity about which cluster a command targets. This is how the reference Tauri K8s tools solve multi-cluster routing.

### 3. Frontend State Model

Replace single-cluster state with a multi-connection map:

```typescript
interface ConnectedClusterState {
    cluster: Cluster;
    currentNamespace: string;
    namespaces: string[];
    isHealthy: boolean;
    lastHealthCheck: Date | null;
    healthCheckInterval: NodeJS.Timer | null;
}

interface ClusterStoreState {
    // Available clusters (from kubeconfig)
    clusters: Cluster[];

    // Connected cluster pool (subset of clusters that are active)
    connectedClusters: Map<string, ConnectedClusterState>;

    // Which connected cluster the UI is currently showing
    activeClusterContext: string | null;

    // Convenience getter
    activeCluster: ConnectedClusterState | null;

    // Actions
    connect: (context: string) => Promise<void>;
    disconnect: (context: string) => Promise<void>;
    setActiveCluster: (context: string) => void;
    setNamespace: (context: string, namespace: string) => void;
}
```

**Derived state** (`isConnected`, `currentCluster`) computed from the map:
```typescript
// Backward-compatible getters during migration
get isConnected() { return this.connectedClusters.size > 0; }
get currentCluster() { return this.activeCluster?.cluster ?? null; }
```

**Rationale**: Map keyed by context name provides O(1) lookup. Backward-compatible getters ease the migration of 200+ component references.

### 4. Cluster Tab Bar UI

Add a horizontal cluster tab bar below the sidebar header:

```
┌──────────────────────┐
│  Kubeli               │
├──────────────────────┤
│  [prod-us] [stg-eu]  │  ← Cluster tabs
│  [+ Add]              │
├──────────────────────┤
│  Workloads            │
│    Pods               │
│    Deployments        │
│  ...                  │
└──────────────────────┘
```

**Tab behavior:**
- Click tab → switches `activeClusterContext` (instant, no reconnection)
- Right-click tab → context menu with "Disconnect" option
- Close (x) button on tab → disconnects cluster, removes from pool
- [+ Add] button → navigates to HomePage to add another cluster
- Active tab has accent border/background
- Tabs show cluster name + health indicator dot (green/red)
- Tab overflow: horizontal scroll with arrow buttons

**Rationale**: Tabbed interface is the proven UX pattern for multi-context switching in developer tools (browser tabs, IDE tabs, terminal tabs).

### 5. Per-Cluster Resource Watchers

Resource watchers are created per `(context, namespace, resourceKind)` tuple:

```rust
pub struct WatcherKey {
    context: String,
    namespace: String,
    kind: String,
}

pub struct AppState {
    pub kube_client: Mutex<KubeClientManager>,
    pub resource_watchers: RwLock<HashMap<WatcherKey, JoinHandle<()>>>,
}
```

When a cluster is disconnected, all watchers for that context are aborted:
```rust
pub fn disconnect_cluster(&self, context: &str) {
    // Remove client from pool
    self.clients.write().unwrap().remove(context);
    // Abort all watchers for this context
    self.resource_watchers.write().unwrap()
        .retain(|key, handle| {
            if key.context == context {
                handle.abort();
                false
            } else {
                true
            }
        });
}
```

**Rationale**: Per-context watcher isolation ensures disconnecting one cluster doesn't affect others. JoinHandle abort provides clean cleanup.

### 6. Health Monitoring Per Cluster

Each connected cluster gets its own health check interval:

```typescript
// In cluster-store
connect: async (context: string) => {
    // ... create connection
    const intervalId = setInterval(() => {
        checkClusterHealth(context);
    }, 30_000);

    set((state) => ({
        connectedClusters: new Map(state.connectedClusters).set(context, {
            ...clusterState,
            healthCheckInterval: intervalId,
        }),
    }));
},

disconnect: (context: string) => {
    const cluster = get().connectedClusters.get(context);
    if (cluster?.healthCheckInterval) {
        clearInterval(cluster.healthCheckInterval);
    }
    // Remove from map...
},
```

**Rationale**: Independent health intervals allow detecting and handling failures per-cluster without affecting the others.

### 7. Home Page Multi-Connect UX

Modify the cluster selection page to support adding clusters to the pool:

**When no clusters are connected** (fresh start):
- Show existing HomePage with "Connect" buttons
- Clicking "Connect" on a cluster connects it AND sets it as active

**When clusters are already connected** (adding more):
- Navigation to HomePage shows connected clusters with green checkmarks
- Unconnected clusters still show "Connect" button
- Connected clusters show "Disconnect" button
- A "Back to Dashboard" link returns to the active cluster view
- Optionally: "Connect" button text changes to "Add" for clarity

**Rationale**: Reuse existing HomePage component with minimal changes. The checkmark pattern clearly communicates which clusters are already in the pool.

### 8. Store Migration Strategy

For users upgrading from single-cluster to multi-cluster:

```typescript
// In cluster-store rehydration
const migrateToMultiCluster = (persistedState: any) => {
    // If old format detected (has currentCluster but no connectedClusters)
    if (persistedState.currentCluster && !persistedState.connectedClusters) {
        return {
            ...persistedState,
            connectedClusters: new Map(),  // Start fresh, no auto-reconnect
            activeClusterContext: null,
            // Remove deprecated fields
            currentCluster: undefined,
            isConnected: undefined,
        };
    }
    return persistedState;
};
```

Auto-reconnect on app start uses the last known connected contexts list (persisted separately):

```typescript
// Persisted in localStorage
lastConnectedContexts: string[];  // replaces lastConnectedContext: string
```

**Rationale**: Clean migration without trying to maintain backward compatibility. Users reconnect on first launch - a minor one-time cost.

### 9. Dashboard Scoping

The Dashboard component receives `activeClusterContext` and scopes all operations:

```typescript
function Dashboard() {
    const { activeClusterContext, activeCluster } = useClusterStore();

    // All resource queries scoped to active context
    const pods = usePods(activeClusterContext);
    const deployments = useDeployments(activeClusterContext);

    // Tab restoration scoped to context (already implemented)
    const savedTabs = restoreTabsForContext(activeClusterContext);
    // ...
}
```

**Key principle**: Dashboard re-renders when `activeClusterContext` changes, but connected clusters in the background keep their watchers alive for instant data when switching back.

**Rationale**: Existing Dashboard tab/favorites scoping by `clusterContext` is already forward-compatible. The main change is the data source routing.

## Risks / Trade-offs

- **Risk**: Memory growth with many connected clusters
  - Mitigation: Each kube-rs Client is lightweight (~2-5 MB). Watchers are the main cost. Consider pausing watchers for background clusters after 5 minutes.

- **Risk**: Large refactor touching 200+ component files
  - Mitigation: Introduce backward-compatible getters (`currentCluster`, `isConnected`) during migration phase. Refactor components incrementally.

- **Risk**: Race conditions with concurrent cluster operations
  - Mitigation: RwLock on client pool, per-context locking for state updates. No cross-cluster operations in scope.

- **Risk**: Auto-reconnect failure for multiple clusters on app start
  - Mitigation: Reconnect in parallel with per-cluster error handling. Show partial success in UI.

## Open Questions

- Should background clusters pause their watchers after a configurable idle timeout to save resources?
- Should the cluster tab bar support drag-to-reorder?
- Maximum recommended simultaneous connections (soft limit with warning)?
