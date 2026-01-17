use crate::k8s::AppState;
use k8s_openapi::api::apps::v1::Deployment;
use k8s_openapi::api::core::v1::{Namespace, Pod};
use kube::api::{Api, ListParams};
use kube::ResourceExt;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use tauri::{command, State};

/// Node types for the resource diagram (simplified: only core workload hierarchy)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum NodeType {
    Namespace,
    Deployment,
    Pod,
}

/// Node status for visual indicators
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum NodeStatus {
    Healthy,
    Warning,
    Error,
    Unknown,
}

/// Edge types for relationship visualization
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum EdgeType {
    Owns,     // OwnerReference / parent-child relationship (solid line)
    Contains, // Namespace contains resources
}

/// A node in the resource graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNode {
    pub id: String,
    pub uid: String,
    pub name: String,
    pub namespace: Option<String>,
    pub node_type: NodeType,
    pub status: NodeStatus,
    pub labels: HashMap<String, String>,
    pub parent_id: Option<String>, // For sub-flow grouping (React Flow parent node)
    // Additional metadata for display
    pub ready_status: Option<String>, // e.g., "2/3" for pods
    pub replicas: Option<String>,     // e.g., "3/3" for deployments
    // Sub-flow properties
    pub is_group: bool, // True for namespace nodes (they contain children)
    pub child_count: Option<usize>, // Number of direct children for group sizing
}

/// An edge connecting two nodes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdge {
    pub id: String,
    pub source: String, // Node ID
    pub target: String, // Node ID
    pub edge_type: EdgeType,
    pub label: Option<String>,
}

/// Complete graph data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

/// Helper function to convert BTreeMap to HashMap
fn btree_to_hashmap(btree: Option<BTreeMap<String, String>>) -> HashMap<String, String> {
    btree.map(|b| b.into_iter().collect()).unwrap_or_default()
}

/// Determine pod status
fn get_pod_status(pod: &Pod) -> NodeStatus {
    let status = pod.status.as_ref();
    let phase = status.and_then(|s| s.phase.as_ref()).map(|s| s.as_str());

    match phase {
        Some("Running") => {
            let container_statuses = status.and_then(|s| s.container_statuses.as_ref());
            if let Some(statuses) = container_statuses {
                if statuses.iter().all(|cs| cs.ready) {
                    NodeStatus::Healthy
                } else {
                    NodeStatus::Warning
                }
            } else {
                NodeStatus::Healthy
            }
        }
        Some("Succeeded") => NodeStatus::Healthy,
        Some("Pending") => NodeStatus::Warning,
        Some("Failed") => NodeStatus::Error,
        _ => NodeStatus::Unknown,
    }
}

/// Determine deployment status
fn get_deployment_status(deployment: &Deployment) -> NodeStatus {
    let status = deployment.status.as_ref();
    let ready = status.and_then(|s| s.ready_replicas).unwrap_or(0);
    let desired = deployment
        .spec
        .as_ref()
        .and_then(|s| s.replicas)
        .unwrap_or(0);

    if ready == desired && desired > 0 {
        NodeStatus::Healthy
    } else if ready > 0 {
        NodeStatus::Warning
    } else if desired > 0 {
        NodeStatus::Error
    } else {
        NodeStatus::Unknown
    }
}

/// Generate nested sub-flow resource graph (Namespaces -> Deployments -> Pods)
/// Structure: Namespace (group) contains Deployment (group) contains Pods
#[command]
pub async fn generate_resource_graph(
    state: State<'_, AppState>,
    namespace: Option<String>,
) -> Result<GraphData, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let mut nodes: Vec<GraphNode> = Vec::new();
    let edges: Vec<GraphEdge> = Vec::new(); // No edges - nested sub-flows provide visual grouping

    // Track child counts for sizing
    let mut ns_child_count: HashMap<String, usize> = HashMap::new();
    let mut deploy_child_count: HashMap<String, usize> = HashMap::new();

    // Track deployment selectors for pod matching
    let mut deployment_selectors: HashMap<String, (String, HashMap<String, String>)> =
        HashMap::new();

    let list_params = ListParams::default();

    // 1. Fetch Namespaces (top-level group nodes)
    if namespace.is_none() {
        let ns_api: Api<Namespace> = Api::all(client.clone());
        if let Ok(ns_list) = ns_api.list(&list_params).await {
            for ns in ns_list.items {
                let name = ns.name_any();
                let uid = ns.metadata.uid.clone().unwrap_or_default();
                let id = format!("ns-{}", name);

                ns_child_count.insert(id.clone(), 0);

                nodes.push(GraphNode {
                    id,
                    uid,
                    name,
                    namespace: None,
                    node_type: NodeType::Namespace,
                    status: NodeStatus::Healthy,
                    labels: btree_to_hashmap(ns.metadata.labels),
                    parent_id: None,
                    ready_status: None,
                    replicas: None,
                    is_group: true,
                    child_count: None,
                });
            }
        }
    }

    // 2. Fetch Deployments (nested group nodes inside namespaces)
    let deployments: Api<Deployment> = if let Some(ref ns) = namespace {
        Api::namespaced(client.clone(), ns)
    } else {
        Api::all(client.clone())
    };

    if let Ok(deployment_list) = deployments.list(&list_params).await {
        for deployment in deployment_list.items {
            let name = deployment.name_any();
            let ns = deployment.namespace().unwrap_or_default();
            let uid = deployment.metadata.uid.clone().unwrap_or_default();
            let id = format!("deploy-{}-{}", ns, name);

            let status = get_deployment_status(&deployment);
            let ready = deployment
                .status
                .as_ref()
                .and_then(|s| s.ready_replicas)
                .unwrap_or(0);
            let desired = deployment
                .spec
                .as_ref()
                .and_then(|s| s.replicas)
                .unwrap_or(0);

            // Store selector for pod matching
            if let Some(selector) = deployment
                .spec
                .as_ref()
                .and_then(|s| s.selector.match_labels.clone())
            {
                deployment_selectors
                    .insert(id.clone(), (ns.clone(), selector.into_iter().collect()));
            }

            // Initialize child count for this deployment
            deploy_child_count.insert(id.clone(), 0);

            // Parent is the namespace (if not filtering by namespace)
            let parent_id = if namespace.is_none() {
                let ns_id = format!("ns-{}", ns);
                *ns_child_count.entry(ns_id.clone()).or_insert(0) += 1;
                Some(ns_id)
            } else {
                None
            };

            // Deployments are ALSO groups (they contain pods)
            nodes.push(GraphNode {
                id,
                uid,
                name,
                namespace: Some(ns),
                node_type: NodeType::Deployment,
                status,
                labels: btree_to_hashmap(deployment.metadata.labels),
                parent_id,
                ready_status: None,
                replicas: Some(format!("{}/{}", ready, desired)),
                is_group: true, // Deployment is a group containing pods
                child_count: None,
            });
        }
    }

    // 3. Fetch Pods (leaf nodes inside deployments)
    let pods: Api<Pod> = if let Some(ref ns) = namespace {
        Api::namespaced(client.clone(), ns)
    } else {
        Api::all(client.clone())
    };

    if let Ok(pod_list) = pods.list(&list_params).await {
        for pod in pod_list.items {
            let name = pod.name_any();
            let ns = pod.namespace().unwrap_or_default();
            let uid = pod.metadata.uid.clone().unwrap_or_default();
            let id = format!("pod-{}-{}", ns, name);

            let status = get_pod_status(&pod);
            let labels = btree_to_hashmap(pod.metadata.labels.clone());

            // Calculate ready status
            let container_statuses = pod
                .status
                .as_ref()
                .and_then(|s| s.container_statuses.as_ref());
            let ready_status = container_statuses.map(|statuses| {
                let ready = statuses.iter().filter(|cs| cs.ready).count();
                format!("{}/{}", ready, statuses.len())
            });

            // Find parent deployment by matching labels
            let mut parent_deployment_id: Option<String> = None;
            for (deploy_id, (deploy_ns, selector)) in &deployment_selectors {
                if *deploy_ns == ns && !selector.is_empty() {
                    let matches = selector.iter().all(|(k, v)| labels.get(k) == Some(v));
                    if matches {
                        parent_deployment_id = Some(deploy_id.clone());
                        *deploy_child_count.entry(deploy_id.clone()).or_insert(0) += 1;
                        break;
                    }
                }
            }

            // Parent is the deployment if found, otherwise the namespace
            let parent_id = if let Some(deploy_id) = parent_deployment_id {
                Some(deploy_id)
            } else if namespace.is_none() {
                // Orphan pod - parent is namespace directly
                let ns_id = format!("ns-{}", ns);
                *ns_child_count.entry(ns_id.clone()).or_insert(0) += 1;
                Some(ns_id)
            } else {
                None
            };

            nodes.push(GraphNode {
                id,
                uid,
                name,
                namespace: Some(ns),
                node_type: NodeType::Pod,
                status,
                labels,
                parent_id,
                ready_status,
                replicas: None,
                is_group: false, // Pods are leaf nodes
                child_count: None,
            });
        }
    }

    // Update child counts for namespaces and deployments
    for node in &mut nodes {
        match node.node_type {
            NodeType::Namespace => {
                let ns_id = format!("ns-{}", node.name);
                node.child_count = ns_child_count.get(&ns_id).copied();
            }
            NodeType::Deployment => {
                node.child_count = deploy_child_count.get(&node.id).copied();
            }
            _ => {}
        }
    }

    tracing::info!(
        "Generated nested sub-flow graph with {} nodes and {} edges",
        nodes.len(),
        edges.len()
    );

    Ok(GraphData { nodes, edges })
}
