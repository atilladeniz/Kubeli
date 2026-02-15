## MODIFIED Requirements

### Requirement: Multi-Cluster Connection
The system SHALL support connecting to multiple Kubernetes clusters simultaneously, maintaining independent client connections in a pool keyed by context name.

#### Scenario: Import kubeconfig file
- GIVEN a user has a valid kubeconfig file
- WHEN the user imports the kubeconfig
- THEN the application parses and stores the cluster configurations
- AND the clusters appear in the cluster list

#### Scenario: Add cluster manually
- GIVEN a user has cluster credentials
- WHEN the user provides server URL and credentials
- THEN a new cluster connection is created

#### Scenario: Connect to additional cluster
- GIVEN one or more clusters are already connected
- WHEN the user connects to another cluster from the cluster list
- THEN the new cluster is added to the connection pool
- AND the existing connections remain active and unaffected
- AND the newly connected cluster becomes the active context

#### Scenario: Disconnect single cluster
- GIVEN multiple clusters are connected
- WHEN the user disconnects one cluster (via tab close or disconnect button)
- THEN only that cluster's connection is removed from the pool
- AND its resource watchers and health monitors are stopped
- AND the other connected clusters remain active
- AND if the disconnected cluster was the active context, the next cluster in the tab list becomes active

#### Scenario: View connected clusters
- GIVEN one or more clusters are connected
- WHEN viewing the dashboard
- THEN a cluster tab bar shows all connected clusters
- AND each tab displays the cluster name and a health indicator
- AND the active cluster tab is visually highlighted

### Requirement: Context Switching
The system SHALL allow users to switch between connected cluster contexts instantly via the cluster tab bar.

#### Scenario: Switch active context
- GIVEN multiple clusters are connected
- WHEN the user clicks a different cluster tab
- THEN the active context changes immediately (< 100ms)
- AND all resource views update to show the selected cluster's data
- AND the previous cluster's connection and watchers remain active in the background

#### Scenario: Return to cluster selection
- GIVEN one or more clusters are connected
- WHEN the user clicks the [+ Add Cluster] tab or navigates to the home page
- THEN the cluster selection page shows all available clusters
- AND already-connected clusters are marked with a checkmark
- AND the user can connect additional clusters or disconnect existing ones

### Requirement: Namespace Selection
The system SHALL provide namespace filtering for all resource views, scoped per connected cluster.

#### Scenario: List namespaces
- GIVEN a cluster connection is active
- WHEN the user opens the namespace selector
- THEN all namespaces the user has access to are displayed for the active cluster

#### Scenario: Switch namespace
- GIVEN namespaces are listed
- WHEN the user selects a namespace
- THEN resource lists filter to show only that namespace for the active cluster
- AND the namespace selection is preserved independently per cluster

#### Scenario: All namespaces view
- GIVEN the user needs cross-namespace visibility
- WHEN the user selects "All Namespaces"
- THEN resources from all accessible namespaces are shown for the active cluster

### Requirement: Connection Status
The system SHALL display connection health for each connected cluster independently.

#### Scenario: Healthy connection
- GIVEN a cluster is properly connected
- WHEN viewing the cluster tab bar
- THEN a green health indicator is shown on that cluster's tab

#### Scenario: Connection failure
- GIVEN a connected cluster's connection fails
- WHEN the health check detects the failure
- THEN a red health indicator is shown on that cluster's tab
- AND a retry option is available
- AND other connected clusters are not affected

#### Scenario: Auto-reconnect on app start
- GIVEN the user had multiple clusters connected in a previous session
- WHEN the application starts
- THEN it attempts to reconnect to all previously connected clusters in parallel
- AND successfully reconnected clusters appear in the tab bar
- AND failed reconnections show an error notification with retry option

### Requirement: Secure Credential Storage
The system MUST store kubeconfig credentials securely using OS keychain.

#### Scenario: Store credentials
- GIVEN the user imports a kubeconfig with credentials
- WHEN the credentials are saved
- THEN they are stored in the OS keychain (macOS Keychain / Linux Secret Service / Windows Credential Manager)
- AND credentials are never written to plain text files

## MODIFIED IPC Commands

```typescript
// Cluster management
invoke('cluster:list'): Promise<Cluster[]>
invoke('cluster:connect', { context: string }): Promise<void>
invoke('cluster:disconnect', { context: string }): Promise<void>
invoke('cluster:get_connected'): Promise<ConnectedClusterInfo[]>
invoke('cluster:add', { kubeconfig: string }): Promise<void>
invoke('cluster:remove', { id: string }): Promise<void>

// All resource commands now require explicit context
invoke('cluster:get_namespaces', { context: string }): Promise<string[]>
invoke('resource:list', { context: string, kind: string, namespace?: string }): Promise<Resource[]>
invoke('resource:get', { context: string, kind: string, name: string, namespace: string }): Promise<Resource>
invoke('resource:watch', { context: string, kind: string, namespace?: string }): Promise<void>
```

## MODIFIED Data Model

```typescript
interface Cluster {
    id: string;
    name: string;
    context: string;
    server: string;
    current: boolean;        // default context in kubeconfig
    namespace: string | null;
    user: string;
    auth_type: AuthType;
    source_file: string | null;
}

interface ConnectedClusterState {
    cluster: Cluster;
    currentNamespace: string;
    namespaces: string[];
    isHealthy: boolean;
    lastHealthCheck: Date | null;
}

interface ClusterStoreState {
    clusters: Cluster[];
    connectedClusters: Map<string, ConnectedClusterState>;
    activeClusterContext: string | null;
}
```
