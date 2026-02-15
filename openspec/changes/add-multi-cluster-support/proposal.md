# Change: Add Multi-Cluster Simultaneous Connection Support

## Why

Kubeli currently supports only one active cluster connection at a time. Users working across multiple environments (dev/staging/prod) must disconnect and reconnect each time they switch context, losing their resource view state, tab history, and namespace selection. Modern Kubernetes desktop tools allow users to connect to multiple clusters simultaneously and switch between them instantly. This is a core requirement already documented in the cluster-management spec but not yet implemented.

## What Changes

- **MODIFIED**: `KubeClientManager` (Rust) - Replace single `Option<Client>` with `HashMap<String, Client>` pool for concurrent connections
- **MODIFIED**: All Tauri resource commands - Add explicit `context: String` parameter instead of using implicit current context
- **MODIFIED**: `cluster-store.ts` - Replace `currentCluster: Cluster | null` with `connectedClusters: Map<string, ConnectedClusterState>` + `activeClusterContext: string | null`
- **ADDED**: Cluster tab bar in sidebar/header - Visual tabs for each connected cluster, click to switch active view
- **ADDED**: Per-cluster state isolation - Each connected cluster maintains its own namespace selection, health status, resource watchers, and tab history
- **ADDED**: `cluster:connect` / `cluster:disconnect` commands with explicit context parameter (replaces implicit single-connection model)
- **MODIFIED**: Home page cluster selection - "Connect" button adds cluster to connected pool instead of replacing current connection
- **MODIFIED**: Health monitoring - Per-cluster health check intervals instead of single global interval
- **MODIFIED**: Namespace watch - Per-cluster namespace watchers instead of single watcher
- **BREAKING**: All IPC commands that previously used implicit current context now require explicit `context` parameter

## Impact

- Affected specs: `cluster-management`
- Affected code:
  - `src-tauri/src/k8s/client.rs` (modified - client pool instead of single client)
  - `src-tauri/src/commands/clusters.rs` (modified - context parameter on all commands)
  - `src-tauri/src/commands/resources.rs` (modified - context parameter)
  - `src/lib/stores/cluster-store.ts` (modified - multi-connection state model)
  - `src/lib/tauri/commands.ts` (modified - context parameter on all invocations)
  - `src/components/features/dashboard/Dashboard.tsx` (modified - scoped to active context)
  - `src/components/features/dashboard/Sidebar.tsx` (modified - cluster tabs)
  - `src/components/features/home/HomePage.tsx` (modified - connect adds to pool)
  - `src/components/features/home/components/ClusterGrid.tsx` (modified - multi-select UX)
  - All resource view components (~30 files) - use `activeClusterContext` instead of `currentCluster`

## Trade-offs

### Benefits
1. **Workflow efficiency**: No more disconnect/reconnect cycle when working across environments
2. **State preservation**: Each cluster retains its view state, tabs, namespace selection
3. **Industry parity**: Matches the UX of leading Kubernetes desktop tools
4. **Foundation for cross-cluster views**: Enables future features like multi-cluster resource comparison

### Costs
1. **Memory increase**: Each connected cluster holds its own kube-rs `Client`, watchers, and cached state (~10-20 MB per cluster)
2. **Breaking IPC change**: All existing commands need context parameter - large refactor across ~30 component files
3. **Complexity**: Per-cluster health monitoring, reconnection, and error handling multiply the state management surface
4. **Migration**: Existing users' persisted store state must be migrated from single-cluster to multi-cluster format

## Alternatives Considered

1. **Tab-per-window model** (Cmd+Shift+N for new cluster window)
   - Rejected: Higher memory overhead (full WebView per window), harder to compare across clusters, platform-specific window management issues

2. **Quick-switch without simultaneous connections** (fast context swap preserving state)
   - Rejected: Still requires disconnect/reconnect, loses real-time watchers during switch, doesn't match user expectations

3. **Lazy connection model** (only connect when tab is focused)
   - Partially adopted: Watchers can be paused for background clusters, but the TCP connection and client stay alive for instant switching
