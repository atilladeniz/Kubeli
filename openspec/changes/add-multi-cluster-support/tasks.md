## 1. Rust Backend - Client Pool

- [ ] 1.1 Refactor `KubeClientManager` to use `HashMap<String, Client>` instead of `Option<Client>`
- [ ] 1.2 Implement `connect_cluster(context)` that adds a client to the pool
- [ ] 1.3 Implement `disconnect_cluster(context)` that removes a client and aborts its watchers
- [ ] 1.4 Implement `get_client(context)` for retrieving a specific client from the pool
- [ ] 1.5 Implement `get_connected_contexts()` returning list of active context names
- [ ] 1.6 Add per-context connection logging to `connection_logs: HashMap<String, String>`
- [ ] 1.7 Add per-context watcher registry (`resource_watchers: HashMap<WatcherKey, JoinHandle>`)

## 2. Rust Backend - Command Refactoring

- [ ] 2.1 Add `context: String` parameter to `list_namespaces` command
- [ ] 2.2 Add `context: String` parameter to `get_resources` / `list_resources` commands
- [ ] 2.3 Add `context: String` parameter to `watch_resources` command
- [ ] 2.4 Add `context: String` parameter to `test_connection` / health check commands
- [ ] 2.5 Refactor `connect_cluster` command to add to pool (not replace)
- [ ] 2.6 Add `disconnect_cluster` command with explicit context
- [ ] 2.7 Add `get_connected_clusters` command returning connected cluster info
- [ ] 2.8 Update all remaining commands (scale, delete, exec, logs, port-forward) with context parameter

## 3. Frontend - Cluster Store Refactoring

- [ ] 3.1 Replace `currentCluster: Cluster | null` with `connectedClusters: Map<string, ConnectedClusterState>`
- [ ] 3.2 Add `activeClusterContext: string | null` field
- [ ] 3.3 Implement `connect(context)` action that adds to pool and sets as active
- [ ] 3.4 Implement `disconnect(context)` action that removes from pool
- [ ] 3.5 Implement `setActiveCluster(context)` for instant switching
- [ ] 3.6 Add backward-compatible getters (`isConnected`, `currentCluster`) during migration
- [ ] 3.7 Implement per-cluster health monitoring with independent intervals
- [ ] 3.8 Implement per-cluster namespace watch and selection
- [ ] 3.9 Migrate `lastConnectedContext: string` to `lastConnectedContexts: string[]`
- [ ] 3.10 Add store rehydration migration for existing users (single→multi format)

## 4. Frontend - Tauri Command Bindings

- [ ] 4.1 Update `commands.ts` - add `context` parameter to all cluster/resource commands
- [ ] 4.2 Add `connectCluster(context)` binding
- [ ] 4.3 Add `disconnectCluster(context)` binding
- [ ] 4.4 Add `getConnectedClusters()` binding

## 5. Frontend - Cluster Tab Bar UI

- [ ] 5.1 Create `ClusterTabs` component showing connected clusters as tabs
- [ ] 5.2 Implement tab click to switch `activeClusterContext`
- [ ] 5.3 Add close (x) button on tabs to disconnect
- [ ] 5.4 Add [+ Add Cluster] button/tab to navigate to HomePage
- [ ] 5.5 Add health indicator dot (green/red) on each tab
- [ ] 5.6 Implement horizontal scroll with arrows for tab overflow
- [ ] 5.7 Integrate `ClusterTabs` into Sidebar below header

## 6. Frontend - Home Page Multi-Connect

- [ ] 6.1 Show checkmark on already-connected clusters in ClusterGrid
- [ ] 6.2 Change "Connect" button to "Disconnect" for connected clusters
- [ ] 6.3 Add "Back to Dashboard" navigation when clusters are already connected
- [ ] 6.4 Support connecting additional clusters without disconnecting existing ones

## 7. Frontend - Component Migration

- [ ] 7.1 Update `Dashboard.tsx` to scope all operations to `activeClusterContext`
- [ ] 7.2 Update `Sidebar.tsx` to show cluster tabs instead of single cluster info
- [ ] 7.3 Update all resource list components to pass `context` to queries
- [ ] 7.4 Update resource detail views to pass `context`
- [ ] 7.5 Update favorites system to work with new store shape
- [ ] 7.6 Update tab restoration to work with new store shape
- [ ] 7.7 Update resource diagram to scope by `activeClusterContext`

## 8. Auto-Reconnect

- [ ] 8.1 Persist `lastConnectedContexts` list on disconnect/app close
- [ ] 8.2 On app start, reconnect to all previously connected clusters in parallel
- [ ] 8.3 Handle partial reconnect failure (show which clusters failed)
- [ ] 8.4 Set the first successfully reconnected cluster as active

## 9. Testing

- [ ] 9.1 Rust unit tests for `KubeClientManager` pool operations
- [ ] 9.2 Rust unit tests for watcher cleanup on disconnect
- [ ] 9.3 Frontend store tests for multi-cluster connect/disconnect/switch
- [ ] 9.4 Frontend store tests for migration from single to multi format
- [ ] 9.5 Integration test: connect two clusters, switch between them
- [ ] 9.6 Integration test: disconnect one cluster, verify other is unaffected
