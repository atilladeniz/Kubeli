# Metrics Monitoring Specification

## Purpose
Provide real-time resource metrics visualization for nodes and pods including CPU, memory usage charts and historical data.

## Requirements

### Requirement: Node Metrics Display
The system SHALL display real-time resource metrics for cluster nodes.

#### Scenario: View node CPU usage
- GIVEN a cluster is connected with metrics-server installed
- WHEN the user views the Nodes list or Node detail
- THEN current CPU usage percentage is displayed
- AND a mini sparkline chart shows recent usage trend

#### Scenario: View node memory usage
- GIVEN a cluster is connected with metrics-server installed
- WHEN the user views the Nodes list or Node detail
- THEN current memory usage (used/allocatable) is displayed
- AND usage percentage is shown with visual indicator

#### Scenario: Node metrics unavailable
- GIVEN metrics-server is not installed
- WHEN the user views node metrics
- THEN a helpful message indicates metrics are unavailable
- AND instructions to install metrics-server are provided

### Requirement: Pod Metrics Display
The system SHALL display real-time resource metrics for pods.

#### Scenario: View pod CPU usage
- GIVEN a pod is running
- WHEN the user views the Pods list or Pod detail
- THEN current CPU usage (cores/millicores) is displayed
- AND usage relative to requests/limits is shown if defined

#### Scenario: View pod memory usage
- GIVEN a pod is running
- WHEN the user views the Pods list or Pod detail
- THEN current memory usage (Mi/Gi) is displayed
- AND usage relative to requests/limits is shown if defined

#### Scenario: Container-level metrics
- GIVEN a multi-container pod exists
- WHEN viewing pod detail
- THEN metrics are broken down per container

### Requirement: Metrics Charts
The system SHALL provide interactive charts for metrics visualization.

#### Scenario: Real-time chart updates
- GIVEN metrics view is open
- WHEN new metrics data arrives
- THEN charts update smoothly without flickering
- AND data points are added to the timeline

#### Scenario: Historical data display
- GIVEN metrics are being collected
- WHEN viewing a resource
- THEN the last 15 minutes of data is shown by default
- AND the user can adjust the time range

#### Scenario: Chart interactions
- GIVEN a metrics chart is displayed
- WHEN the user hovers over data points
- THEN exact values are shown in a tooltip
- AND timestamp is displayed

### Requirement: Cluster Overview Metrics
The system SHALL display aggregated cluster metrics in the overview.

#### Scenario: Cluster resource summary
- GIVEN a cluster is connected
- WHEN viewing the Cluster Overview
- THEN total CPU capacity vs usage is shown
- AND total memory capacity vs usage is shown
- AND percentage utilization is displayed

#### Scenario: Top resource consumers
- GIVEN cluster metrics are available
- WHEN viewing the Cluster Overview
- THEN top 5 pods by CPU usage are listed
- AND top 5 pods by memory usage are listed

## IPC Commands

```typescript
invoke('metrics:get_node_metrics', {
  node_name?: string
}): Promise<NodeMetrics[]>

invoke('metrics:get_pod_metrics', {
  namespace?: string,
  pod_name?: string
}): Promise<PodMetrics[]>

invoke('metrics:get_cluster_summary'): Promise<ClusterMetricsSummary>

// Event for streaming metrics updates
listen('metrics:update', (event: MetricsUpdateEvent) => void)
```

## Data Model

```typescript
interface NodeMetrics {
  name: string;
  timestamp: string;
  cpu: {
    usage: string;        // e.g., "500m"
    usageNanoCores: number;
    allocatable: string;  // e.g., "4"
    percentage: number;
  };
  memory: {
    usage: string;        // e.g., "2Gi"
    usageBytes: number;
    allocatable: string;  // e.g., "8Gi"
    percentage: number;
  };
}

interface PodMetrics {
  name: string;
  namespace: string;
  timestamp: string;
  containers: ContainerMetrics[];
  totalCpu: string;
  totalMemory: string;
}

interface ContainerMetrics {
  name: string;
  cpu: {
    usage: string;
    usageNanoCores: number;
    request?: string;
    limit?: string;
  };
  memory: {
    usage: string;
    usageBytes: number;
    request?: string;
    limit?: string;
  };
}

interface ClusterMetricsSummary {
  timestamp: string;
  nodes: {
    total: number;
    ready: number;
  };
  cpu: {
    capacity: string;
    allocatable: string;
    usage: string;
    percentage: number;
  };
  memory: {
    capacity: string;
    allocatable: string;
    usage: string;
    percentage: number;
  };
  topCpuPods: PodMetrics[];
  topMemoryPods: PodMetrics[];
}

interface MetricsUpdateEvent {
  type: 'node' | 'pod' | 'cluster';
  data: NodeMetrics | PodMetrics | ClusterMetricsSummary;
}
```

## Backend Implementation

### Rust Module Structure
```
src-tauri/src/
├── commands/
│   └── metrics.rs      # Tauri command handlers
└── k8s/
    └── metrics.rs      # Kubernetes metrics API client
```

### Required Dependencies
```toml
# Already using kube crate with metrics support
kube = { version = "1.1.0", features = ["client", "config", "derive", "ws", "runtime"] }
k8s-openapi = { version = "0.24", features = ["v1_32"] }
```

### Metrics API Integration
- Use Kubernetes Metrics API (`metrics.k8s.io/v1beta1`)
- Poll metrics at configurable intervals (default: 15s)
- Cache recent metrics for historical display
- Handle metrics-server unavailability gracefully

## Frontend Components

### Components Structure
```
src/components/features/metrics/
├── MetricsChart.tsx        # Reusable chart component
├── NodeMetricsCard.tsx     # Node metrics display
├── PodMetricsCard.tsx      # Pod metrics display
├── ClusterMetricsSummary.tsx
└── MetricsSparkline.tsx    # Mini inline chart
```

### Chart Implementation Options
1. **Lightweight custom SVG** - Minimal bundle size
2. **Recharts** - React-friendly, good for simple charts
3. **uPlot** - High performance for real-time data

## Performance Requirements

| Metric | Target |
|--------|--------|
| Metrics fetch latency | < 500ms |
| Chart render time | < 100ms |
| Memory for 15min history | < 5MB per resource |
| Update frequency | 15s default, 5s minimum |

## Priority

This is a **P1 (High Priority)** feature as metrics visualization is a core differentiator for Kubernetes management tools.

## Dependencies

- Requires metrics-server to be installed in the cluster
- Uses existing cluster connection from Task 2
- Integrates with Node and Pod views from Task 4
