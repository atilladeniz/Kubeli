# Auto-Reconnect Specification

## Purpose
Provide automatic reconnection on cluster disconnect and continuous connection health monitoring to ensure reliable cluster connectivity.

## Requirements

### Requirement: Connection Health Monitoring
The system SHALL continuously monitor cluster connection health.

#### Scenario: Periodic health check
- GIVEN a cluster is connected
- WHEN the health check interval elapses (default: 30s)
- THEN an API server ping is performed
- AND connection status is updated

#### Scenario: Display connection latency
- GIVEN a cluster is connected
- WHEN health check succeeds
- THEN the API server latency is displayed in the status bar

#### Scenario: Detect connection loss
- GIVEN a cluster is connected
- WHEN the health check fails
- THEN the UI shows "Disconnected" status
- AND auto-reconnect is triggered

### Requirement: Automatic Reconnection
The system SHALL automatically reconnect when connection is lost.

#### Scenario: Reconnect on network loss
- GIVEN connection to cluster is lost
- WHEN auto-reconnect is enabled
- THEN reconnection attempts start automatically
- AND exponential backoff is applied

#### Scenario: Reconnect attempts display
- GIVEN reconnection is in progress
- WHEN attempts are being made
- THEN the UI shows attempt count and next retry time

#### Scenario: Successful reconnection
- GIVEN reconnection succeeds
- WHEN connection is restored
- THEN the UI shows "Connected" status
- AND all watches are re-established

#### Scenario: Manual reconnect
- GIVEN auto-reconnect has failed multiple times
- WHEN the user clicks "Reconnect Now"
- THEN an immediate reconnection attempt is made

### Requirement: Watch Restoration
The system SHALL restore active watches after reconnection.

#### Scenario: Restore resource watches
- GIVEN the user was watching resources before disconnect
- WHEN connection is restored
- THEN all active watches are re-established
- AND resource lists are refreshed

#### Scenario: Restore log streams
- GIVEN log streaming was active before disconnect
- WHEN connection is restored
- THEN log streams resume from where they left off (if possible)

#### Scenario: Restore port forwards
- GIVEN port forwards were active before disconnect
- WHEN connection is restored
- THEN port forwards are automatically re-established

### Requirement: Offline Mode
The system SHALL provide graceful degradation when offline.

#### Scenario: Show cached data
- GIVEN connection is lost
- WHEN the user views resources
- THEN cached data is displayed with "Offline" indicator
- AND last update timestamp is shown

#### Scenario: Queue offline actions
- GIVEN the user is offline
- WHEN they attempt an action (e.g., delete pod)
- THEN a message explains the action requires connectivity

#### Scenario: Sync on reconnect
- GIVEN cached data was displayed offline
- WHEN connection is restored
- THEN data is refreshed from the cluster

### Requirement: User Configuration
The system SHALL allow configuring reconnection behavior.

#### Scenario: Toggle auto-reconnect
- GIVEN the user is in Settings
- WHEN they toggle auto-reconnect
- THEN the setting is saved and applied immediately

#### Scenario: Configure retry settings
- GIVEN the user is in Settings
- WHEN they adjust reconnection settings
- THEN max retries and backoff times are customizable

#### Scenario: Configure health check interval
- GIVEN the user is in Settings
- WHEN they adjust health check interval
- THEN the interval is applied to all clusters

## IPC Commands

```typescript
invoke('connection:get_health'): Promise<ConnectionHealth>

invoke('connection:reconnect', {
  cluster_name: string
}): Promise<void>

invoke('connection:set_auto_reconnect', {
  enabled: boolean
}): Promise<void>

invoke('connection:get_settings'): Promise<ConnectionSettings>

invoke('connection:set_settings', {
  settings: ConnectionSettings
}): Promise<void>

// Events
listen('connection:status_changed', (event: ConnectionStatusEvent) => void)
listen('connection:health_update', (event: HealthUpdateEvent) => void)
listen('connection:reconnect_attempt', (event: ReconnectAttemptEvent) => void)
```

## Data Model

```typescript
interface ConnectionHealth {
  cluster: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  latencyMs?: number;
  lastCheck: string;
  apiServerVersion?: string;
  error?: string;
}

interface ConnectionSettings {
  autoReconnect: boolean;
  healthCheckIntervalSeconds: number;  // default: 30
  maxReconnectAttempts: number;        // default: 10, 0 = unlimited
  initialBackoffMs: number;            // default: 1000
  maxBackoffMs: number;                // default: 60000
  backoffMultiplier: number;           // default: 2
}

interface ConnectionStatusEvent {
  cluster: string;
  previousStatus: string;
  currentStatus: string;
  timestamp: string;
}

interface HealthUpdateEvent {
  cluster: string;
  health: ConnectionHealth;
}

interface ReconnectAttemptEvent {
  cluster: string;
  attempt: number;
  maxAttempts: number;
  nextRetryMs: number;
  error?: string;
}

interface CachedResourceState {
  resourceType: string;
  namespace?: string;
  lastUpdated: string;
  itemCount: number;
  stale: boolean;
}
```

## Backend Implementation

### Rust Module Structure
```
src-tauri/src/
├── commands/
│   └── connection.rs     # Tauri command handlers
└── k8s/
    ├── health.rs         # Health check implementation
    ├── reconnect.rs      # Reconnection logic
    └── cache.rs          # Offline data caching
```

### Health Check Implementation
```rust
use tokio::time::{interval, Duration};

async fn health_check_loop(
    client: Client,
    interval_secs: u64,
    tx: mpsc::Sender<HealthUpdateEvent>,
) {
    let mut interval = interval(Duration::from_secs(interval_secs));

    loop {
        interval.tick().await;

        let start = Instant::now();
        match client.apiserver_version().await {
            Ok(version) => {
                tx.send(HealthUpdateEvent {
                    status: ConnectionStatus::Connected,
                    latency_ms: start.elapsed().as_millis() as u64,
                    api_version: Some(version.git_version),
                    error: None,
                }).await;
            }
            Err(e) => {
                tx.send(HealthUpdateEvent {
                    status: ConnectionStatus::Disconnected,
                    latency_ms: None,
                    api_version: None,
                    error: Some(e.to_string()),
                }).await;
            }
        }
    }
}
```

### Exponential Backoff
```rust
fn calculate_backoff(attempt: u32, settings: &ConnectionSettings) -> Duration {
    let backoff = settings.initial_backoff_ms
        * settings.backoff_multiplier.pow(attempt);
    Duration::from_millis(backoff.min(settings.max_backoff_ms))
}
```

## Frontend Components

### Components Structure
```
src/components/features/connection/
├── ConnectionStatus.tsx      # Status indicator in header
├── ConnectionHealth.tsx      # Detailed health info
├── ReconnectingOverlay.tsx   # Overlay during reconnect
└── OfflineIndicator.tsx      # Offline mode indicator
```

### Status Bar UI
```
┌─────────────────────────────────────────────────────────┐
│ [●] Connected to production-cluster (23ms)              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ [○] Reconnecting... Attempt 3/10 (retry in 8s)  [Retry]│
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ [◌] Offline - Showing cached data (5 min ago) [Reconnect]
└─────────────────────────────────────────────────────────┘
```

### Status Colors
- **Green (●)**: Connected, healthy
- **Yellow (◐)**: Connected, high latency (>500ms)
- **Orange (○)**: Reconnecting
- **Red (◌)**: Disconnected/Offline
- **Gray (○)**: Unknown/Checking

## Watch Restoration Strategy

### Priority Order
1. Namespace list (required for other watches)
2. Currently viewed resource list
3. Active log streams
4. Active port forwards
5. Background resource watches

### Restoration Process
```typescript
async function restoreWatches(previousState: WatchState) {
  // 1. Restore namespace watch
  await watchNamespaces();

  // 2. Restore current view
  if (previousState.currentView) {
    await watchResource(previousState.currentView);
  }

  // 3. Restore log streams
  for (const logStream of previousState.logStreams) {
    await restoreLogStream(logStream);
  }

  // 4. Restore port forwards
  for (const forward of previousState.portForwards) {
    await restorePortForward(forward);
  }
}
```

## Performance Considerations

### Health Check Optimization
- Use lightweight API calls (`/version` or `/healthz`)
- Don't block main thread during health checks
- Batch multiple cluster health checks

### Cache Management
- Cache resource lists in memory
- Limit cache size per resource type
- Clear stale cache after successful reconnect

## Priority

This is a **P2 (Medium Priority)** feature for improved reliability.

## Dependencies

- Builds on cluster connection from Task 2
- Integrates with resource watching from Task 3
- Affects log streaming (Task 5), shell (Task 6), port forwarding (Task 7)
- Settings storage from Task 9
