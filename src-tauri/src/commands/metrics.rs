use crate::k8s::AppState;
use kube::api::ListParams;
use kube::{Api, Client};
use serde::{Deserialize, Serialize};
use tauri::{command, State};

// Kubernetes Metrics API types (metrics.k8s.io/v1beta1)
use kube::core::{ApiResource, DynamicObject};

/// Node metrics information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeMetrics {
    pub name: String,
    pub timestamp: String,
    pub cpu: CpuMetrics,
    pub memory: MemoryMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpuMetrics {
    pub usage: String, // e.g., "500m"
    pub usage_nano_cores: u64,
    pub allocatable: String, // e.g., "4"
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryMetrics {
    pub usage: String, // e.g., "2Gi"
    pub usage_bytes: u64,
    pub allocatable: String, // e.g., "8Gi"
    pub percentage: f64,
}

/// Pod metrics information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PodMetrics {
    pub name: String,
    pub namespace: String,
    pub timestamp: String,
    pub containers: Vec<ContainerMetrics>,
    pub total_cpu: String,
    pub total_cpu_nano_cores: u64,
    pub total_memory: String,
    pub total_memory_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerMetrics {
    pub name: String,
    pub cpu: ContainerCpuMetrics,
    pub memory: ContainerMemoryMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerCpuMetrics {
    pub usage: String,
    pub usage_nano_cores: u64,
    pub request: Option<String>,
    pub limit: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerMemoryMetrics {
    pub usage: String,
    pub usage_bytes: u64,
    pub request: Option<String>,
    pub limit: Option<String>,
}

/// Cluster metrics summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterMetricsSummary {
    pub timestamp: String,
    pub nodes: NodeSummary,
    pub cpu: ClusterCpuSummary,
    pub memory: ClusterMemorySummary,
    pub top_cpu_pods: Vec<PodMetrics>,
    pub top_memory_pods: Vec<PodMetrics>,
    pub metrics_available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeSummary {
    pub total: i32,
    pub ready: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterCpuSummary {
    pub capacity: String,
    pub capacity_milli: u64,
    pub allocatable: String,
    pub allocatable_milli: u64,
    pub usage: String,
    pub usage_milli: u64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterMemorySummary {
    pub capacity: String,
    pub capacity_bytes: u64,
    pub allocatable: String,
    pub allocatable_bytes: u64,
    pub usage: String,
    pub usage_bytes: u64,
    pub percentage: f64,
}

/// Check if metrics-server is available
async fn check_metrics_available(client: &Client) -> bool {
    let ar = ApiResource {
        group: "metrics.k8s.io".to_string(),
        version: "v1beta1".to_string(),
        api_version: "metrics.k8s.io/v1beta1".to_string(),
        kind: "NodeMetrics".to_string(),
        plural: "nodes".to_string(),
    };

    let api: Api<DynamicObject> = Api::all_with(client.clone(), &ar);
    api.list(&ListParams::default().limit(1)).await.is_ok()
}

/// Parse CPU quantity string to nanocores
fn parse_cpu_to_nanocores(cpu: &str) -> u64 {
    let cpu = cpu.trim();
    if cpu.ends_with('n') {
        cpu.trim_end_matches('n').parse().unwrap_or(0)
    } else if cpu.ends_with('u') {
        cpu.trim_end_matches('u').parse::<u64>().unwrap_or(0) * 1000
    } else if cpu.ends_with('m') {
        cpu.trim_end_matches('m').parse::<u64>().unwrap_or(0) * 1_000_000
    } else {
        // Whole cores
        (cpu.parse::<f64>().unwrap_or(0.0) * 1_000_000_000.0) as u64
    }
}

/// Parse memory quantity string to bytes
fn parse_memory_to_bytes(mem: &str) -> u64 {
    let mem = mem.trim();
    if mem.ends_with("Ki") {
        mem.trim_end_matches("Ki").parse::<u64>().unwrap_or(0) * 1024
    } else if mem.ends_with("Mi") {
        mem.trim_end_matches("Mi").parse::<u64>().unwrap_or(0) * 1024 * 1024
    } else if mem.ends_with("Gi") {
        mem.trim_end_matches("Gi").parse::<u64>().unwrap_or(0) * 1024 * 1024 * 1024
    } else if mem.ends_with("Ti") {
        mem.trim_end_matches("Ti").parse::<u64>().unwrap_or(0) * 1024 * 1024 * 1024 * 1024
    } else if mem.ends_with('K') || mem.ends_with('k') {
        mem.trim_end_matches(['K', 'k']).parse::<u64>().unwrap_or(0) * 1000
    } else if mem.ends_with('M') {
        mem.trim_end_matches('M').parse::<u64>().unwrap_or(0) * 1000 * 1000
    } else if mem.ends_with('G') {
        mem.trim_end_matches('G').parse::<u64>().unwrap_or(0) * 1000 * 1000 * 1000
    } else if mem.ends_with('T') {
        mem.trim_end_matches('T').parse::<u64>().unwrap_or(0) * 1000 * 1000 * 1000 * 1000
    } else {
        mem.parse().unwrap_or(0)
    }
}

/// Format nanocores to human readable string
fn format_cpu(nano_cores: u64) -> String {
    if nano_cores >= 1_000_000_000 {
        format!("{:.2}", nano_cores as f64 / 1_000_000_000.0)
    } else if nano_cores >= 1_000_000 {
        format!("{}m", nano_cores / 1_000_000)
    } else if nano_cores > 0 {
        // Sub-millicore: show as decimal millicores (e.g., 0.5m, 0.08m)
        let milli = nano_cores as f64 / 1_000_000.0;
        if milli >= 0.1 {
            format!("{:.1}m", milli)
        } else {
            format!("{:.2}m", milli)
        }
    } else {
        "0m".to_string()
    }
}

/// Format bytes to human readable string
fn format_memory(bytes: u64) -> String {
    if bytes >= 1024 * 1024 * 1024 * 1024 {
        format!(
            "{:.2}Ti",
            bytes as f64 / (1024.0 * 1024.0 * 1024.0 * 1024.0)
        )
    } else if bytes >= 1024 * 1024 * 1024 {
        format!("{:.2}Gi", bytes as f64 / (1024.0 * 1024.0 * 1024.0))
    } else if bytes >= 1024 * 1024 {
        format!("{:.2}Mi", bytes as f64 / (1024.0 * 1024.0))
    } else if bytes >= 1024 {
        format!("{:.2}Ki", bytes as f64 / 1024.0)
    } else {
        format!("{}B", bytes)
    }
}

/// Get node metrics
#[command]
pub async fn get_node_metrics(
    state: State<'_, AppState>,
    node_name: Option<String>,
) -> Result<Vec<NodeMetrics>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    if !check_metrics_available(&client).await {
        return Err(
            "Metrics server not available. Please install metrics-server in your cluster."
                .to_string(),
        );
    }

    // Get node metrics from metrics API
    let ar = ApiResource {
        group: "metrics.k8s.io".to_string(),
        version: "v1beta1".to_string(),
        api_version: "metrics.k8s.io/v1beta1".to_string(),
        kind: "NodeMetrics".to_string(),
        plural: "nodes".to_string(),
    };

    let metrics_api: Api<DynamicObject> = Api::all_with(client.clone(), &ar);

    // Get node capacity/allocatable info
    use k8s_openapi::api::core::v1::Node;
    let nodes_api: Api<Node> = Api::all(client.clone());
    let nodes_list = nodes_api
        .list(&ListParams::default())
        .await
        .map_err(|e| format!("Failed to list nodes: {}", e))?;

    let mut node_capacities: std::collections::HashMap<String, (u64, u64)> =
        std::collections::HashMap::new();
    for node in nodes_list.items {
        if let Some(name) = node.metadata.name {
            let status = node.status.unwrap_or_default();
            let allocatable = status.allocatable.unwrap_or_default();

            let cpu_alloc = allocatable
                .get("cpu")
                .map(|q| parse_cpu_to_nanocores(&q.0))
                .unwrap_or(0);
            let mem_alloc = allocatable
                .get("memory")
                .map(|q| parse_memory_to_bytes(&q.0))
                .unwrap_or(0);

            node_capacities.insert(name, (cpu_alloc, mem_alloc));
        }
    }

    let metrics_list = if let Some(name) = node_name {
        match metrics_api.get(&name).await {
            Ok(m) => vec![m],
            Err(e) => return Err(format!("Failed to get node metrics: {}", e)),
        }
    } else {
        metrics_api
            .list(&ListParams::default())
            .await
            .map_err(|e| format!("Failed to list node metrics: {}", e))?
            .items
    };

    let node_metrics: Vec<NodeMetrics> = metrics_list
        .into_iter()
        .filter_map(|metric| {
            let name = metric.metadata.name?;
            let data = metric.data;

            let timestamp = data
                .get("timestamp")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let usage = data.get("usage")?;
            let cpu_usage_str = usage.get("cpu").and_then(|v| v.as_str()).unwrap_or("0");
            let mem_usage_str = usage.get("memory").and_then(|v| v.as_str()).unwrap_or("0");

            let cpu_usage_nano = parse_cpu_to_nanocores(cpu_usage_str);
            let mem_usage_bytes = parse_memory_to_bytes(mem_usage_str);

            let (cpu_alloc, mem_alloc) = node_capacities.get(&name).copied().unwrap_or((0, 0));

            let cpu_percentage = if cpu_alloc > 0 {
                (cpu_usage_nano as f64 / cpu_alloc as f64) * 100.0
            } else {
                0.0
            };

            let mem_percentage = if mem_alloc > 0 {
                (mem_usage_bytes as f64 / mem_alloc as f64) * 100.0
            } else {
                0.0
            };

            Some(NodeMetrics {
                name,
                timestamp,
                cpu: CpuMetrics {
                    usage: format_cpu(cpu_usage_nano),
                    usage_nano_cores: cpu_usage_nano,
                    allocatable: format_cpu(cpu_alloc),
                    percentage: cpu_percentage,
                },
                memory: MemoryMetrics {
                    usage: format_memory(mem_usage_bytes),
                    usage_bytes: mem_usage_bytes,
                    allocatable: format_memory(mem_alloc),
                    percentage: mem_percentage,
                },
            })
        })
        .collect();

    tracing::info!("Got metrics for {} nodes", node_metrics.len());
    Ok(node_metrics)
}

/// Get pod metrics
#[command]
pub async fn get_pod_metrics(
    state: State<'_, AppState>,
    namespace: Option<String>,
    pod_name: Option<String>,
) -> Result<Vec<PodMetrics>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    if !check_metrics_available(&client).await {
        return Err(
            "Metrics server not available. Please install metrics-server in your cluster."
                .to_string(),
        );
    }

    let ar = ApiResource {
        group: "metrics.k8s.io".to_string(),
        version: "v1beta1".to_string(),
        api_version: "metrics.k8s.io/v1beta1".to_string(),
        kind: "PodMetrics".to_string(),
        plural: "pods".to_string(),
    };

    let metrics_api: Api<DynamicObject> = if let Some(ns) = &namespace {
        Api::namespaced_with(client.clone(), ns, &ar)
    } else {
        Api::all_with(client.clone(), &ar)
    };

    let metrics_list = if let Some(name) = pod_name {
        let ns = namespace.ok_or("Namespace required when specifying pod name")?;
        let api: Api<DynamicObject> = Api::namespaced_with(client.clone(), &ns, &ar);
        match api.get(&name).await {
            Ok(m) => vec![m],
            Err(e) => return Err(format!("Failed to get pod metrics: {}", e)),
        }
    } else {
        metrics_api
            .list(&ListParams::default())
            .await
            .map_err(|e| format!("Failed to list pod metrics: {}", e))?
            .items
    };

    let pod_metrics: Vec<PodMetrics> = metrics_list
        .into_iter()
        .filter_map(|metric| {
            let name = metric.metadata.name?;
            let namespace = metric.metadata.namespace.unwrap_or_default();
            let data = metric.data;

            let timestamp = data
                .get("timestamp")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let containers_data = data.get("containers").and_then(|v| v.as_array())?;

            let mut total_cpu_nano: u64 = 0;
            let mut total_mem_bytes: u64 = 0;

            let containers: Vec<ContainerMetrics> = containers_data
                .iter()
                .filter_map(|c| {
                    let container_name = c.get("name")?.as_str()?.to_string();
                    let usage = c.get("usage")?;

                    let cpu_str = usage.get("cpu").and_then(|v| v.as_str()).unwrap_or("0");
                    let mem_str = usage.get("memory").and_then(|v| v.as_str()).unwrap_or("0");

                    let cpu_nano = parse_cpu_to_nanocores(cpu_str);
                    let mem_bytes = parse_memory_to_bytes(mem_str);

                    total_cpu_nano += cpu_nano;
                    total_mem_bytes += mem_bytes;

                    Some(ContainerMetrics {
                        name: container_name,
                        cpu: ContainerCpuMetrics {
                            usage: format_cpu(cpu_nano),
                            usage_nano_cores: cpu_nano,
                            request: None,
                            limit: None,
                        },
                        memory: ContainerMemoryMetrics {
                            usage: format_memory(mem_bytes),
                            usage_bytes: mem_bytes,
                            request: None,
                            limit: None,
                        },
                    })
                })
                .collect();

            Some(PodMetrics {
                name,
                namespace,
                timestamp,
                containers,
                total_cpu: format_cpu(total_cpu_nano),
                total_cpu_nano_cores: total_cpu_nano,
                total_memory: format_memory(total_mem_bytes),
                total_memory_bytes: total_mem_bytes,
            })
        })
        .collect();

    tracing::info!("Got metrics for {} pods", pod_metrics.len());
    Ok(pod_metrics)
}

/// Get cluster metrics summary
#[command]
pub async fn get_cluster_metrics_summary(
    state: State<'_, AppState>,
) -> Result<ClusterMetricsSummary, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let metrics_available = check_metrics_available(&client).await;
    let timestamp = chrono::Utc::now().to_rfc3339();

    // Get nodes info
    use k8s_openapi::api::core::v1::Node;
    let nodes_api: Api<Node> = Api::all(client.clone());
    let nodes_list = nodes_api
        .list(&ListParams::default())
        .await
        .map_err(|e| format!("Failed to list nodes: {}", e))?;

    let total_nodes = nodes_list.items.len() as i32;
    let ready_nodes = nodes_list
        .items
        .iter()
        .filter(|node| {
            node.status
                .as_ref()
                .and_then(|s| s.conditions.as_ref())
                .map(|conditions| {
                    conditions
                        .iter()
                        .any(|c| c.type_ == "Ready" && c.status == "True")
                })
                .unwrap_or(false)
        })
        .count() as i32;

    // Calculate total capacity/allocatable
    let mut total_cpu_capacity: u64 = 0;
    let mut total_cpu_allocatable: u64 = 0;
    let mut total_mem_capacity: u64 = 0;
    let mut total_mem_allocatable: u64 = 0;

    for node in &nodes_list.items {
        if let Some(status) = &node.status {
            if let Some(capacity) = &status.capacity {
                if let Some(cpu) = capacity.get("cpu") {
                    total_cpu_capacity += parse_cpu_to_nanocores(&cpu.0);
                }
                if let Some(mem) = capacity.get("memory") {
                    total_mem_capacity += parse_memory_to_bytes(&mem.0);
                }
            }
            if let Some(allocatable) = &status.allocatable {
                if let Some(cpu) = allocatable.get("cpu") {
                    total_cpu_allocatable += parse_cpu_to_nanocores(&cpu.0);
                }
                if let Some(mem) = allocatable.get("memory") {
                    total_mem_allocatable += parse_memory_to_bytes(&mem.0);
                }
            }
        }
    }

    let mut total_cpu_usage: u64 = 0;
    let mut total_mem_usage: u64 = 0;
    let mut top_cpu_pods: Vec<PodMetrics> = Vec::new();
    let mut top_memory_pods: Vec<PodMetrics> = Vec::new();

    if metrics_available {
        // Get node metrics for usage
        let ar = ApiResource {
            group: "metrics.k8s.io".to_string(),
            version: "v1beta1".to_string(),
            api_version: "metrics.k8s.io/v1beta1".to_string(),
            kind: "NodeMetrics".to_string(),
            plural: "nodes".to_string(),
        };
        let node_metrics_api: Api<DynamicObject> = Api::all_with(client.clone(), &ar);

        if let Ok(node_metrics_list) = node_metrics_api.list(&ListParams::default()).await {
            for metric in node_metrics_list.items {
                if let Some(usage) = metric.data.get("usage") {
                    if let Some(cpu) = usage.get("cpu").and_then(|v| v.as_str()) {
                        total_cpu_usage += parse_cpu_to_nanocores(cpu);
                    }
                    if let Some(mem) = usage.get("memory").and_then(|v| v.as_str()) {
                        total_mem_usage += parse_memory_to_bytes(mem);
                    }
                }
            }
        }

        // Get top pods by CPU and memory
        let pod_ar = ApiResource {
            group: "metrics.k8s.io".to_string(),
            version: "v1beta1".to_string(),
            api_version: "metrics.k8s.io/v1beta1".to_string(),
            kind: "PodMetrics".to_string(),
            plural: "pods".to_string(),
        };
        let pod_metrics_api: Api<DynamicObject> = Api::all_with(client.clone(), &pod_ar);

        if let Ok(pod_metrics_list) = pod_metrics_api.list(&ListParams::default()).await {
            let mut all_pods: Vec<PodMetrics> = pod_metrics_list
                .items
                .into_iter()
                .filter_map(|metric| {
                    let name = metric.metadata.name?;
                    let namespace = metric.metadata.namespace.unwrap_or_default();
                    let data = metric.data;

                    let timestamp = data
                        .get("timestamp")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();

                    let containers_data = data.get("containers").and_then(|v| v.as_array())?;

                    let mut total_cpu_nano: u64 = 0;
                    let mut total_mem_bytes: u64 = 0;

                    let containers: Vec<ContainerMetrics> = containers_data
                        .iter()
                        .filter_map(|c| {
                            let container_name = c.get("name")?.as_str()?.to_string();
                            let usage = c.get("usage")?;

                            let cpu_str = usage.get("cpu").and_then(|v| v.as_str()).unwrap_or("0");
                            let mem_str =
                                usage.get("memory").and_then(|v| v.as_str()).unwrap_or("0");

                            let cpu_nano = parse_cpu_to_nanocores(cpu_str);
                            let mem_bytes = parse_memory_to_bytes(mem_str);

                            total_cpu_nano += cpu_nano;
                            total_mem_bytes += mem_bytes;

                            Some(ContainerMetrics {
                                name: container_name,
                                cpu: ContainerCpuMetrics {
                                    usage: format_cpu(cpu_nano),
                                    usage_nano_cores: cpu_nano,
                                    request: None,
                                    limit: None,
                                },
                                memory: ContainerMemoryMetrics {
                                    usage: format_memory(mem_bytes),
                                    usage_bytes: mem_bytes,
                                    request: None,
                                    limit: None,
                                },
                            })
                        })
                        .collect();

                    Some(PodMetrics {
                        name,
                        namespace,
                        timestamp,
                        containers,
                        total_cpu: format_cpu(total_cpu_nano),
                        total_cpu_nano_cores: total_cpu_nano,
                        total_memory: format_memory(total_mem_bytes),
                        total_memory_bytes: total_mem_bytes,
                    })
                })
                .collect();

            // Sort by CPU and get top 5
            all_pods.sort_by(|a, b| b.total_cpu_nano_cores.cmp(&a.total_cpu_nano_cores));
            top_cpu_pods = all_pods.iter().take(5).cloned().collect();

            // Sort by memory and get top 5
            all_pods.sort_by(|a, b| b.total_memory_bytes.cmp(&a.total_memory_bytes));
            top_memory_pods = all_pods.iter().take(5).cloned().collect();
        }
    }

    let cpu_percentage = if total_cpu_allocatable > 0 {
        (total_cpu_usage as f64 / total_cpu_allocatable as f64) * 100.0
    } else {
        0.0
    };

    let mem_percentage = if total_mem_allocatable > 0 {
        (total_mem_usage as f64 / total_mem_allocatable as f64) * 100.0
    } else {
        0.0
    };

    // Convert nanocores to millicores for summary
    let cpu_capacity_milli = total_cpu_capacity / 1_000_000;
    let cpu_allocatable_milli = total_cpu_allocatable / 1_000_000;
    let cpu_usage_milli = total_cpu_usage / 1_000_000;

    Ok(ClusterMetricsSummary {
        timestamp,
        nodes: NodeSummary {
            total: total_nodes,
            ready: ready_nodes,
        },
        cpu: ClusterCpuSummary {
            capacity: format_cpu(total_cpu_capacity),
            capacity_milli: cpu_capacity_milli,
            allocatable: format_cpu(total_cpu_allocatable),
            allocatable_milli: cpu_allocatable_milli,
            usage: format_cpu(total_cpu_usage),
            usage_milli: cpu_usage_milli,
            percentage: cpu_percentage,
        },
        memory: ClusterMemorySummary {
            capacity: format_memory(total_mem_capacity),
            capacity_bytes: total_mem_capacity,
            allocatable: format_memory(total_mem_allocatable),
            allocatable_bytes: total_mem_allocatable,
            usage: format_memory(total_mem_usage),
            usage_bytes: total_mem_usage,
            percentage: mem_percentage,
        },
        top_cpu_pods,
        top_memory_pods,
        metrics_available,
    })
}

/// Check if metrics-server is installed
#[command]
pub async fn check_metrics_server(state: State<'_, AppState>) -> Result<bool, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    Ok(check_metrics_available(&client).await)
}

// ── Kubelet direct metrics via /stats/summary ───────────────────────

/// Serde types for the kubelet /stats/summary JSON response
mod kubelet_stats {
    use serde::Deserialize;

    #[derive(Deserialize)]
    pub struct Summary {
        pub pods: Vec<PodStats>,
    }

    #[derive(Deserialize)]
    pub struct PodStats {
        #[serde(rename = "podRef")]
        pub pod_ref: PodRef,
        pub cpu: Option<CpuStats>,
        pub memory: Option<MemoryStats>,
        pub containers: Option<Vec<ContainerStats>>,
    }

    #[derive(Deserialize)]
    pub struct PodRef {
        pub name: String,
        pub namespace: String,
    }

    #[derive(Deserialize)]
    pub struct CpuStats {
        #[serde(rename = "usageNanoCores")]
        pub usage_nano_cores: Option<u64>,
        pub time: Option<String>,
    }

    #[derive(Deserialize)]
    pub struct MemoryStats {
        #[serde(rename = "workingSetBytes")]
        pub working_set_bytes: Option<u64>,
        pub time: Option<String>,
    }

    #[derive(Deserialize)]
    pub struct ContainerStats {
        pub name: String,
        pub cpu: Option<CpuStats>,
        pub memory: Option<MemoryStats>,
    }
}

/// Get pod metrics directly from kubelet /stats/summary endpoint.
/// This bypasses metrics-server and gets real-time data (~10s granularity)
/// from cAdvisor embedded in the kubelet on each node.
#[command]
pub async fn get_pod_metrics_direct(
    state: State<'_, AppState>,
    namespace: Option<String>,
) -> Result<Vec<PodMetrics>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    // List all nodes to query each kubelet
    use k8s_openapi::api::core::v1::Node;
    let nodes_api: Api<Node> = Api::all(client.clone());
    let nodes = nodes_api
        .list(&ListParams::default())
        .await
        .map_err(|e| format!("Failed to list nodes: {}", e))?;

    let mut all_pods: Vec<PodMetrics> = Vec::new();

    for node in &nodes.items {
        let node_name = match &node.metadata.name {
            Some(n) => n.clone(),
            None => continue,
        };

        // Query kubelet via API server proxy: /api/v1/nodes/{node}/proxy/stats/summary
        let url = format!("/api/v1/nodes/{}/proxy/stats/summary", node_name);
        let req = hyper::Request::builder()
            .uri(&url)
            .body(Vec::new())
            .map_err(|e| format!("Failed to build request: {}", e))?;

        let resp = client
            .request::<Vec<u8>>(req)
            .await
            .map_err(|e| format!("Failed to query kubelet on node {}: {}", node_name, e))?;

        let summary: kubelet_stats::Summary = serde_json::from_slice(&resp).map_err(|e| {
            format!(
                "Failed to parse kubelet stats from node {}: {}",
                node_name, e
            )
        })?;

        for pod in summary.pods {
            // Filter by namespace if specified
            if let Some(ns) = &namespace {
                if &pod.pod_ref.namespace != ns {
                    continue;
                }
            }

            let pod_cpu_nano = pod
                .cpu
                .as_ref()
                .and_then(|c| c.usage_nano_cores)
                .unwrap_or(0);
            let pod_mem_bytes = pod
                .memory
                .as_ref()
                .and_then(|m| m.working_set_bytes)
                .unwrap_or(0);
            let timestamp = pod
                .cpu
                .as_ref()
                .and_then(|c| c.time.clone())
                .or_else(|| pod.memory.as_ref().and_then(|m| m.time.clone()))
                .unwrap_or_default();

            let containers: Vec<ContainerMetrics> = pod
                .containers
                .unwrap_or_default()
                .into_iter()
                .map(|c| {
                    let cpu_nano = c
                        .cpu
                        .as_ref()
                        .and_then(|cpu| cpu.usage_nano_cores)
                        .unwrap_or(0);
                    let mem_bytes = c
                        .memory
                        .as_ref()
                        .and_then(|mem| mem.working_set_bytes)
                        .unwrap_or(0);
                    ContainerMetrics {
                        name: c.name,
                        cpu: ContainerCpuMetrics {
                            usage: format_cpu(cpu_nano),
                            usage_nano_cores: cpu_nano,
                            request: None,
                            limit: None,
                        },
                        memory: ContainerMemoryMetrics {
                            usage: format_memory(mem_bytes),
                            usage_bytes: mem_bytes,
                            request: None,
                            limit: None,
                        },
                    }
                })
                .collect();

            all_pods.push(PodMetrics {
                name: pod.pod_ref.name,
                namespace: pod.pod_ref.namespace,
                timestamp,
                containers,
                total_cpu: format_cpu(pod_cpu_nano),
                total_cpu_nano_cores: pod_cpu_nano,
                total_memory: format_memory(pod_mem_bytes),
                total_memory_bytes: pod_mem_bytes,
            });
        }
    }

    tracing::info!("Got direct kubelet metrics for {} pods", all_pods.len());
    Ok(all_pods)
}
