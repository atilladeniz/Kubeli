use crate::k8s::AppState;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use flate2::read::GzDecoder;
use k8s_openapi::api::admissionregistration::v1::{
    MutatingWebhookConfiguration, ValidatingWebhookConfiguration,
};
use k8s_openapi::api::apps::v1::{DaemonSet, Deployment, ReplicaSet, StatefulSet};
use k8s_openapi::api::autoscaling::v2::HorizontalPodAutoscaler;
use k8s_openapi::api::batch::v1::{CronJob, Job};
use k8s_openapi::api::coordination::v1::Lease;
use k8s_openapi::api::core::v1::ServiceAccount;
use k8s_openapi::api::core::v1::{ConfigMap, Event, Namespace, Node, Pod, Secret, Service};
use k8s_openapi::api::core::v1::{LimitRange, ResourceQuota};
use k8s_openapi::api::core::v1::{PersistentVolume, PersistentVolumeClaim};
use k8s_openapi::api::discovery::v1::EndpointSlice;
use k8s_openapi::api::networking::v1::{Ingress, IngressClass, NetworkPolicy};
use k8s_openapi::api::node::v1::RuntimeClass;
use k8s_openapi::api::policy::v1::PodDisruptionBudget;
use k8s_openapi::api::rbac::v1::{ClusterRole, ClusterRoleBinding, Role, RoleBinding};
use k8s_openapi::api::scheduling::v1::PriorityClass;
use k8s_openapi::api::storage::v1::{CSIDriver, CSINode, StorageClass, VolumeAttachment};
use k8s_openapi::apiextensions_apiserver::pkg::apis::apiextensions::v1::CustomResourceDefinition;
use kube::api::{Api, DeleteParams, ListParams, Patch, PatchParams};
use kube::core::DynamicObject;
use kube::discovery::ApiResource;
use kube::ResourceExt;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::io::Read;
use tauri::{command, State};

// Helper function to convert BTreeMap to HashMap
fn btree_to_hashmap(
    btree: Option<std::collections::BTreeMap<String, String>>,
) -> HashMap<String, String> {
    btree.map(|b| b.into_iter().collect()).unwrap_or_default()
}

pub fn extract_container_info(
    container: &k8s_openapi::api::core::v1::Container,
    status: Option<&k8s_openapi::api::core::v1::ContainerStatus>,
    include_last_state: bool,
) -> ContainerInfo {
    let (
        ready,
        restart_count,
        state,
        state_reason,
        last_state,
        last_state_reason,
        last_exit_code,
        last_finished_at,
    ) = if let Some(cs) = status {
        let (state_str, reason) = extract_state(&cs.state);

        let (ls, lsr, lec, lfa) = if include_last_state {
            extract_last_state(&cs.last_state)
        } else {
            (None, None, None, None)
        };

        (
            cs.ready,
            cs.restart_count,
            state_str,
            reason,
            ls,
            lsr,
            lec,
            lfa,
        )
    } else {
        (
            false,
            0,
            "Unknown".to_string(),
            None,
            None,
            None,
            None,
            None,
        )
    };

    let env_vars = container
        .env
        .as_ref()
        .map(|envs| {
            envs.iter()
                .map(|env| {
                    let (value_from_kind, value_from) = if let Some(ref vf) = env.value_from {
                        if let Some(ref cm) = vf.config_map_key_ref {
                            (
                                Some("configMap".to_string()),
                                Some(format!("{}:{}", cm.name, cm.key)),
                            )
                        } else if let Some(ref secret) = vf.secret_key_ref {
                            (
                                Some("secret".to_string()),
                                Some(format!("{}:{}", secret.name, secret.key)),
                            )
                        } else if let Some(ref field) = vf.field_ref {
                            (Some("field".to_string()), Some(field.field_path.clone()))
                        } else if let Some(ref resource) = vf.resource_field_ref {
                            (
                                Some("resource".to_string()),
                                Some(resource.resource.clone()),
                            )
                        } else {
                            (Some("unknown".to_string()), None)
                        }
                    } else {
                        (None, None)
                    };
                    ContainerEnvVar {
                        name: env.name.clone(),
                        value: env.value.clone(),
                        value_from_kind,
                        value_from,
                        resolved_value: None,
                    }
                })
                .collect()
        })
        .unwrap_or_default();

    ContainerInfo {
        name: container.name.clone(),
        image: container.image.clone().unwrap_or_default(),
        ready,
        restart_count,
        state,
        state_reason,
        last_state,
        last_state_reason,
        last_exit_code,
        last_finished_at,
        env_vars,
    }
}

fn extract_state(
    state: &Option<k8s_openapi::api::core::v1::ContainerState>,
) -> (String, Option<String>) {
    if let Some(s) = state {
        if s.running.is_some() {
            ("Running".to_string(), None)
        } else if let Some(w) = &s.waiting {
            ("Waiting".to_string(), w.reason.clone())
        } else if let Some(t) = &s.terminated {
            ("Terminated".to_string(), t.reason.clone())
        } else {
            ("Unknown".to_string(), None)
        }
    } else {
        ("Unknown".to_string(), None)
    }
}

fn extract_last_state(
    last_state: &Option<k8s_openapi::api::core::v1::ContainerState>,
) -> (Option<String>, Option<String>, Option<i32>, Option<String>) {
    if let Some(ls) = last_state {
        if ls.running.is_some() {
            (Some("Running".to_string()), None, None, None)
        } else if let Some(w) = &ls.waiting {
            (Some("Waiting".to_string()), w.reason.clone(), None, None)
        } else if let Some(t) = &ls.terminated {
            (
                Some("Terminated".to_string()),
                t.reason.clone(),
                Some(t.exit_code),
                t.finished_at.as_ref().map(|ts| ts.0.to_string()),
            )
        } else {
            (None, None, None, None)
        }
    } else {
        (None, None, None, None)
    }
}

/// Pod-specific information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PodInfo {
    pub name: String,
    pub namespace: String,
    pub uid: String,
    pub phase: String,
    pub node_name: Option<String>,
    pub pod_ip: Option<String>,
    pub host_ip: Option<String>,
    pub init_containers: Vec<ContainerInfo>,
    pub containers: Vec<ContainerInfo>,
    pub created_at: Option<String>,
    pub deletion_timestamp: Option<String>,
    pub labels: HashMap<String, String>,
    pub restart_count: i32,
    pub ready_containers: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerEnvVar {
    pub name: String,
    pub value: Option<String>,
    pub value_from_kind: Option<String>,
    pub value_from: Option<String>,
    pub resolved_value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerInfo {
    pub name: String,
    pub image: String,
    pub ready: bool,
    pub restart_count: i32,
    pub state: String,
    pub state_reason: Option<String>,
    pub last_state: Option<String>,
    pub last_state_reason: Option<String>,
    pub last_exit_code: Option<i32>,
    pub last_finished_at: Option<String>,
    pub env_vars: Vec<ContainerEnvVar>,
}

/// Deployment-specific information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeploymentInfo {
    pub name: String,
    pub namespace: String,
    pub uid: String,
    pub replicas: i32,
    pub ready_replicas: i32,
    pub available_replicas: i32,
    pub updated_replicas: i32,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
    pub selector: HashMap<String, String>,
}

/// Service-specific information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceInfo {
    pub name: String,
    pub namespace: String,
    pub uid: String,
    pub service_type: String,
    pub cluster_ip: Option<String>,
    pub external_ip: Option<String>,
    pub ports: Vec<ServicePortInfo>,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
    pub selector: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServicePortInfo {
    pub name: Option<String>,
    pub port: i32,
    pub target_port: String,
    pub protocol: String,
    pub node_port: Option<i32>,
}

/// ConfigMap information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigMapInfo {
    pub name: String,
    pub namespace: String,
    pub uid: String,
    pub data_keys: Vec<String>,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

/// Secret information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecretInfo {
    pub name: String,
    pub namespace: String,
    pub uid: String,
    pub secret_type: String,
    pub data_keys: Vec<String>,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

/// Node information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeInfo {
    pub name: String,
    pub uid: String,
    pub status: String,
    pub roles: Vec<String>,
    pub version: Option<String>,
    pub os_image: Option<String>,
    pub kernel_version: Option<String>,
    pub container_runtime: Option<String>,
    pub cpu_capacity: Option<String>,
    pub memory_capacity: Option<String>,
    pub pod_capacity: Option<String>,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
    pub internal_ip: Option<String>,
    pub external_ip: Option<String>,
}

/// List parameters for filtering resources
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ListOptions {
    pub namespace: Option<String>,
    pub label_selector: Option<String>,
    pub field_selector: Option<String>,
    pub limit: Option<u32>,
}

/// List all pods in a namespace or all namespaces
#[command]
pub async fn list_pods(
    state: State<'_, AppState>,
    options: ListOptions,
) -> Result<Vec<PodInfo>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let mut list_params = ListParams::default();
    if let Some(label_selector) = &options.label_selector {
        list_params = list_params.labels(label_selector);
    }
    if let Some(field_selector) = &options.field_selector {
        list_params = list_params.fields(field_selector);
    }
    if let Some(limit) = options.limit {
        list_params = list_params.limit(limit);
    }

    let pods: Api<Pod> = if let Some(ns) = &options.namespace {
        Api::namespaced(client, ns)
    } else {
        Api::all(client)
    };

    let pod_list = pods
        .list(&list_params)
        .await
        .map_err(|e| format!("Failed to list pods: {}", e))?;

    let pod_infos: Vec<PodInfo> = pod_list
        .items
        .into_iter()
        .map(|pod| {
            let metadata = pod.metadata;
            let spec = pod.spec.unwrap_or_default();
            let status = pod.status.unwrap_or_default();

            let init_containers: Vec<ContainerInfo> = spec
                .init_containers
                .unwrap_or_default()
                .iter()
                .map(|c| {
                    let cs = status
                        .init_container_statuses
                        .as_ref()
                        .and_then(|statuses| statuses.iter().find(|s| s.name == c.name));
                    extract_container_info(c, cs, false)
                })
                .collect();

            let containers: Vec<ContainerInfo> = spec
                .containers
                .iter()
                .map(|c| {
                    let cs = status
                        .container_statuses
                        .as_ref()
                        .and_then(|statuses| statuses.iter().find(|s| s.name == c.name));
                    extract_container_info(c, cs, false)
                })
                .collect();

            let ready_count = containers.iter().filter(|c| c.ready).count();
            let total_count = containers.len();
            let total_restarts: i32 = containers.iter().map(|c| c.restart_count).sum();

            PodInfo {
                name: metadata.name.unwrap_or_default(),
                namespace: metadata.namespace.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                phase: status.phase.unwrap_or_else(|| "Unknown".to_string()),
                node_name: spec.node_name,
                pod_ip: status.pod_ip,
                host_ip: status.host_ip,
                init_containers,
                containers,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                deletion_timestamp: metadata.deletion_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
                restart_count: total_restarts,
                ready_containers: format!("{}/{}", ready_count, total_count),
            }
        })
        .collect();

    tracing::info!("Listed {} pods", pod_infos.len());
    Ok(pod_infos)
}

/// List all deployments
#[command]
pub async fn list_deployments(
    state: State<'_, AppState>,
    options: ListOptions,
) -> Result<Vec<DeploymentInfo>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let mut list_params = ListParams::default();
    if let Some(label_selector) = &options.label_selector {
        list_params = list_params.labels(label_selector);
    }
    if let Some(limit) = options.limit {
        list_params = list_params.limit(limit);
    }

    let deployments: Api<Deployment> = if let Some(ns) = &options.namespace {
        Api::namespaced(client, ns)
    } else {
        Api::all(client)
    };

    let deployment_list = deployments
        .list(&list_params)
        .await
        .map_err(|e| format!("Failed to list deployments: {}", e))?;

    let deployment_infos: Vec<DeploymentInfo> = deployment_list
        .items
        .into_iter()
        .map(|deployment| {
            let metadata = deployment.metadata;
            let spec = deployment.spec.unwrap_or_default();
            let status = deployment.status.unwrap_or_default();

            DeploymentInfo {
                name: metadata.name.unwrap_or_default(),
                namespace: metadata.namespace.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                replicas: spec.replicas.unwrap_or(0),
                ready_replicas: status.ready_replicas.unwrap_or(0),
                available_replicas: status.available_replicas.unwrap_or(0),
                updated_replicas: status.updated_replicas.unwrap_or(0),
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
                selector: btree_to_hashmap(spec.selector.match_labels),
            }
        })
        .collect();

    tracing::info!("Listed {} deployments", deployment_infos.len());
    Ok(deployment_infos)
}

/// List all services
#[command]
pub async fn list_services(
    state: State<'_, AppState>,
    options: ListOptions,
) -> Result<Vec<ServiceInfo>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let mut list_params = ListParams::default();
    if let Some(label_selector) = &options.label_selector {
        list_params = list_params.labels(label_selector);
    }
    if let Some(limit) = options.limit {
        list_params = list_params.limit(limit);
    }

    let services: Api<Service> = if let Some(ns) = &options.namespace {
        Api::namespaced(client, ns)
    } else {
        Api::all(client)
    };

    let service_list = services
        .list(&list_params)
        .await
        .map_err(|e| format!("Failed to list services: {}", e))?;

    let service_infos: Vec<ServiceInfo> = service_list
        .items
        .into_iter()
        .map(|service| {
            let metadata = service.metadata;
            let spec = service.spec.unwrap_or_default();

            let ports: Vec<ServicePortInfo> = spec
                .ports
                .unwrap_or_default()
                .into_iter()
                .map(|p| ServicePortInfo {
                    name: p.name,
                    port: p.port,
                    target_port: p
                        .target_port
                        .map(|tp| match tp {
                            k8s_openapi::apimachinery::pkg::util::intstr::IntOrString::Int(i) => {
                                i.to_string()
                            }
                            k8s_openapi::apimachinery::pkg::util::intstr::IntOrString::String(
                                s,
                            ) => s,
                        })
                        .unwrap_or_default(),
                    protocol: p.protocol.unwrap_or_else(|| "TCP".to_string()),
                    node_port: p.node_port,
                })
                .collect();

            let external_ip = spec
                .external_ips
                .as_ref()
                .and_then(|ips: &Vec<String>| ips.first().cloned());

            ServiceInfo {
                name: metadata.name.unwrap_or_default(),
                namespace: metadata.namespace.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                service_type: spec.type_.unwrap_or_else(|| "ClusterIP".to_string()),
                cluster_ip: spec.cluster_ip,
                external_ip,
                ports,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
                selector: btree_to_hashmap(spec.selector),
            }
        })
        .collect();

    tracing::info!("Listed {} services", service_infos.len());
    Ok(service_infos)
}

/// List all configmaps
#[command]
pub async fn list_configmaps(
    state: State<'_, AppState>,
    options: ListOptions,
) -> Result<Vec<ConfigMapInfo>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let mut list_params = ListParams::default();
    if let Some(label_selector) = &options.label_selector {
        list_params = list_params.labels(label_selector);
    }
    if let Some(limit) = options.limit {
        list_params = list_params.limit(limit);
    }

    let configmaps: Api<ConfigMap> = if let Some(ns) = &options.namespace {
        Api::namespaced(client, ns)
    } else {
        Api::all(client)
    };

    let configmap_list = configmaps
        .list(&list_params)
        .await
        .map_err(|e| format!("Failed to list configmaps: {}", e))?;

    let configmap_infos: Vec<ConfigMapInfo> = configmap_list
        .items
        .into_iter()
        .map(|cm| {
            let metadata = cm.metadata;
            let data_keys: Vec<String> = cm
                .data
                .map(|d| d.keys().cloned().collect())
                .unwrap_or_default();

            ConfigMapInfo {
                name: metadata.name.unwrap_or_default(),
                namespace: metadata.namespace.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                data_keys,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} configmaps", configmap_infos.len());
    Ok(configmap_infos)
}

/// List all secrets
#[command]
pub async fn list_secrets(
    state: State<'_, AppState>,
    options: ListOptions,
) -> Result<Vec<SecretInfo>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let mut list_params = ListParams::default();
    if let Some(label_selector) = &options.label_selector {
        list_params = list_params.labels(label_selector);
    }
    if let Some(limit) = options.limit {
        list_params = list_params.limit(limit);
    }

    let secrets: Api<Secret> = if let Some(ns) = &options.namespace {
        Api::namespaced(client, ns)
    } else {
        Api::all(client)
    };

    let secret_list = secrets
        .list(&list_params)
        .await
        .map_err(|e| format!("Failed to list secrets: {}", e))?;

    let secret_infos: Vec<SecretInfo> = secret_list
        .items
        .into_iter()
        .map(|secret| {
            let metadata = secret.metadata;
            let data_keys: Vec<String> = secret
                .data
                .map(|d| d.keys().cloned().collect())
                .unwrap_or_default();

            SecretInfo {
                name: metadata.name.unwrap_or_default(),
                namespace: metadata.namespace.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                secret_type: secret.type_.unwrap_or_else(|| "Opaque".to_string()),
                data_keys,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} secrets", secret_infos.len());
    Ok(secret_infos)
}

/// List all nodes
#[command]
pub async fn list_nodes(state: State<'_, AppState>) -> Result<Vec<NodeInfo>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let nodes: Api<Node> = Api::all(client);
    let list_params = ListParams::default();

    let node_list = nodes
        .list(&list_params)
        .await
        .map_err(|e| format!("Failed to list nodes: {}", e))?;

    let node_infos: Vec<NodeInfo> = node_list
        .items
        .into_iter()
        .map(|node| {
            let metadata = node.metadata;
            let status = node.status.unwrap_or_default();

            // Determine node status from conditions
            let node_status = status
                .conditions
                .as_ref()
                .and_then(|conditions| {
                    conditions.iter().find(|c| c.type_ == "Ready").map(|c| {
                        if c.status == "True" {
                            "Ready"
                        } else {
                            "NotReady"
                        }
                    })
                })
                .unwrap_or("Unknown")
                .to_string();

            // Get node roles from labels
            let labels = btree_to_hashmap(metadata.labels.clone());
            let roles: Vec<String> = labels
                .keys()
                .filter_map(|k| {
                    if k.starts_with("node-role.kubernetes.io/") {
                        Some(k.replace("node-role.kubernetes.io/", ""))
                    } else {
                        None
                    }
                })
                .collect();

            // Get node info
            let node_info = status.node_info;

            // Get addresses
            let addresses = status.addresses.unwrap_or_default();
            let internal_ip = addresses
                .iter()
                .find(|a| a.type_ == "InternalIP")
                .map(|a| a.address.clone());
            let external_ip = addresses
                .iter()
                .find(|a| a.type_ == "ExternalIP")
                .map(|a| a.address.clone());

            // Get capacity
            let capacity = status.capacity.unwrap_or_default();

            NodeInfo {
                name: metadata.name.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                status: node_status,
                roles: if roles.is_empty() {
                    vec!["<none>".to_string()]
                } else {
                    roles
                },
                version: node_info.as_ref().map(|i| i.kubelet_version.clone()),
                os_image: node_info.as_ref().map(|i| i.os_image.clone()),
                kernel_version: node_info.as_ref().map(|i| i.kernel_version.clone()),
                container_runtime: node_info
                    .as_ref()
                    .map(|i| i.container_runtime_version.clone()),
                cpu_capacity: capacity.get("cpu").map(|q| q.0.clone()),
                memory_capacity: capacity.get("memory").map(|q| q.0.clone()),
                pod_capacity: capacity.get("pods").map(|q| q.0.clone()),
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels,
                internal_ip,
                external_ip,
            }
        })
        .collect();

    tracing::info!("Listed {} nodes", node_infos.len());
    Ok(node_infos)
}

/// Resolve env var values from ConfigMaps, Secrets, and field references.
/// Uses a cache to avoid redundant API calls for the same ConfigMap/Secret.
async fn resolve_env_vars(
    client: &kube::Client,
    namespace: &str,
    containers: &mut [ContainerInfo],
    pod_name: &str,
    pod_namespace: &str,
    pod_uid: &str,
    pod_node_name: Option<&str>,
    pod_ip: Option<&str>,
    host_ip: Option<&str>,
    pod_service_account: Option<&str>,
    pod_labels: &HashMap<String, String>,
    pod_annotations: &HashMap<String, String>,
) {
    // Cache for ConfigMap and Secret data to avoid redundant fetches
    let mut configmap_cache: HashMap<String, Option<std::collections::BTreeMap<String, String>>> =
        HashMap::new();
    let mut secret_cache: HashMap<String, Option<std::collections::BTreeMap<String, String>>> =
        HashMap::new();

    for container in containers.iter_mut() {
        for env_var in container.env_vars.iter_mut() {
            if let (Some(kind), Some(ref_value)) = (&env_var.value_from_kind, &env_var.value_from) {
                match kind.as_str() {
                    "configMap" => {
                        if let Some((cm_name, cm_key)) = ref_value.split_once(':') {
                            let cache_key = cm_name.to_string();
                            let data = if let Some(cached) = configmap_cache.get(&cache_key) {
                                cached.clone()
                            } else {
                                let cms: Api<ConfigMap> =
                                    Api::namespaced(client.clone(), namespace);
                                let fetched = cms.get(cm_name).await.ok().and_then(|cm| cm.data);
                                configmap_cache.insert(cache_key, fetched.clone());
                                fetched
                            };
                            if let Some(data) = data {
                                env_var.resolved_value = data.get(cm_key).cloned();
                            }
                        }
                    }
                    "secret" => {
                        if let Some((secret_name, secret_key)) = ref_value.split_once(':') {
                            let cache_key = secret_name.to_string();
                            // Cache decoded string values for secrets
                            let data = if let Some(cached) = secret_cache.get(&cache_key) {
                                cached.clone()
                            } else {
                                let secrets: Api<Secret> =
                                    Api::namespaced(client.clone(), namespace);
                                let fetched = secrets.get(secret_name).await.ok().and_then(|s| {
                                    s.data.map(|d| {
                                        d.into_iter()
                                            .map(|(k, v)| {
                                                let decoded = String::from_utf8(v.0)
                                                    .unwrap_or_else(|_| "<binary>".to_string());
                                                (k, decoded)
                                            })
                                            .collect()
                                    })
                                });
                                secret_cache.insert(cache_key, fetched.clone());
                                fetched
                            };
                            if let Some(data) = data {
                                env_var.resolved_value = data.get(secret_key).cloned();
                            }
                        }
                    }
                    "field" => {
                        env_var.resolved_value = resolve_field_ref(
                            ref_value,
                            pod_name,
                            pod_namespace,
                            pod_uid,
                            pod_node_name,
                            pod_ip,
                            host_ip,
                            pod_service_account,
                            pod_labels,
                            pod_annotations,
                        );
                    }
                    _ => {}
                }
            }
        }
    }
}

/// Resolve a fieldRef path to its value from pod metadata/status.
fn resolve_field_ref(
    field_path: &str,
    pod_name: &str,
    pod_namespace: &str,
    pod_uid: &str,
    pod_node_name: Option<&str>,
    pod_ip: Option<&str>,
    host_ip: Option<&str>,
    service_account: Option<&str>,
    labels: &HashMap<String, String>,
    annotations: &HashMap<String, String>,
) -> Option<String> {
    match field_path {
        "metadata.name" => Some(pod_name.to_string()),
        "metadata.namespace" => Some(pod_namespace.to_string()),
        "metadata.uid" => Some(pod_uid.to_string()),
        "spec.nodeName" => pod_node_name.map(|s| s.to_string()),
        "spec.serviceAccountName" => service_account.map(|s| s.to_string()),
        "status.podIP" | "status.podIPs" => pod_ip.map(|s| s.to_string()),
        "status.hostIP" | "status.hostIPs" => host_ip.map(|s| s.to_string()),
        path if path.starts_with("metadata.labels['") => {
            let key = path
                .strip_prefix("metadata.labels['")
                .and_then(|s| s.strip_suffix("']"));
            key.and_then(|k| labels.get(k).cloned())
        }
        path if path.starts_with("metadata.annotations['") => {
            let key = path
                .strip_prefix("metadata.annotations['")
                .and_then(|s| s.strip_suffix("']"));
            key.and_then(|k| annotations.get(k).cloned())
        }
        _ => None,
    }
}

/// Get a single pod by name
#[command]
pub async fn get_pod(
    state: State<'_, AppState>,
    namespace: String,
    name: String,
) -> Result<PodInfo, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let pods: Api<Pod> = Api::namespaced(client.clone(), &namespace);
    let pod = pods
        .get(&name)
        .await
        .map_err(|e| format!("Failed to get pod {}/{}: {}", namespace, name, e))?;

    let metadata = pod.metadata;
    let spec = pod.spec.unwrap_or_default();
    let status = pod.status.unwrap_or_default();

    let pod_name = metadata.name.clone().unwrap_or_default();
    let pod_namespace = metadata.namespace.clone().unwrap_or_default();
    let pod_uid = metadata.uid.clone().unwrap_or_default();
    let pod_node_name = spec.node_name.clone();
    let pod_ip = status.pod_ip.clone();
    let host_ip = status.host_ip.clone();
    let pod_service_account = spec.service_account_name.clone();
    let pod_labels = btree_to_hashmap(metadata.labels.clone());
    let pod_annotations = btree_to_hashmap(metadata.annotations.clone());

    let mut init_containers: Vec<ContainerInfo> = spec
        .init_containers
        .unwrap_or_default()
        .iter()
        .map(|c| {
            let cs = status
                .init_container_statuses
                .as_ref()
                .and_then(|statuses| statuses.iter().find(|s| s.name == c.name));
            extract_container_info(c, cs, true)
        })
        .collect();

    let mut containers: Vec<ContainerInfo> = spec
        .containers
        .iter()
        .map(|c| {
            let cs = status
                .container_statuses
                .as_ref()
                .and_then(|statuses| statuses.iter().find(|s| s.name == c.name));
            extract_container_info(c, cs, true)
        })
        .collect();

    // Resolve env var values from ConfigMaps, Secrets, and field references
    resolve_env_vars(
        &client,
        &namespace,
        &mut init_containers,
        &pod_name,
        &pod_namespace,
        &pod_uid,
        pod_node_name.as_deref(),
        pod_ip.as_deref(),
        host_ip.as_deref(),
        pod_service_account.as_deref(),
        &pod_labels,
        &pod_annotations,
    )
    .await;
    resolve_env_vars(
        &client,
        &namespace,
        &mut containers,
        &pod_name,
        &pod_namespace,
        &pod_uid,
        pod_node_name.as_deref(),
        pod_ip.as_deref(),
        host_ip.as_deref(),
        pod_service_account.as_deref(),
        &pod_labels,
        &pod_annotations,
    )
    .await;

    let ready_count = containers.iter().filter(|c| c.ready).count();
    let total_count = containers.len();
    let total_restarts: i32 = containers.iter().map(|c| c.restart_count).sum();

    Ok(PodInfo {
        name: pod_name,
        namespace: pod_namespace,
        uid: pod_uid,
        phase: status.phase.unwrap_or_else(|| "Unknown".to_string()),
        node_name: pod_node_name,
        pod_ip,
        host_ip,
        init_containers,
        containers,
        created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
        deletion_timestamp: metadata.deletion_timestamp.map(|t| t.0.to_string()),
        labels: pod_labels,
        restart_count: total_restarts,
        ready_containers: format!("{}/{}", ready_count, total_count),
    })
}

/// Delete a pod
#[command]
pub async fn delete_pod(
    state: State<'_, AppState>,
    namespace: String,
    name: String,
) -> Result<(), String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let pods: Api<Pod> = Api::namespaced(client, &namespace);
    pods.delete(&name, &Default::default())
        .await
        .map_err(|e| format!("Failed to delete pod {}/{}: {}", namespace, name, e))?;

    tracing::info!("Deleted pod {}/{}", namespace, name);
    Ok(())
}

/// Strip metadata.managedFields from a resource JSON value.
/// managedFields is verbose internal bookkeeping that clutters the YAML view.
fn strip_managed_fields(value: &mut Value) {
    if let Some(metadata) = value.get_mut("metadata").and_then(|m| m.as_object_mut()) {
        metadata.remove("managedFields");
    }
}

/// Resource YAML response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceYaml {
    pub yaml: String,
    pub api_version: String,
    pub kind: String,
    pub name: String,
    pub namespace: Option<String>,
    pub uid: String,
    pub labels: HashMap<String, String>,
    pub annotations: HashMap<String, String>,
    pub created_at: Option<String>,
}

/// Get resource as YAML
#[command]
pub async fn get_resource_yaml(
    state: State<'_, AppState>,
    resource_type: String,
    name: String,
    namespace: Option<String>,
) -> Result<ResourceYaml, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    // Only helm-release needs special handling (secret decoding).
    // Everything else goes through the generic dynamic API.
    if resource_type.to_lowercase() == "helm-release" {
        return get_helm_release_yaml(client, &name, namespace).await;
    }

    get_resource_yaml_dynamic(client, &resource_type, &name, namespace.as_deref()).await
}

/// Fetch native Helm release data from secrets (base64 + gzip encoded)
async fn get_helm_release_yaml(
    client: kube::Client,
    name: &str,
    namespace: Option<String>,
) -> Result<ResourceYaml, String> {
    let ns = namespace.ok_or("Namespace required for helm releases")?;
    let api: Api<Secret> = Api::namespaced(client, &ns);
    let lp = ListParams::default().labels("owner=helm");
    let secrets: Vec<Secret> = api
        .list(&lp)
        .await
        .map_err(|e| format!("Failed to list secrets: {}", e))?
        .items;

    let prefix = format!("sh.helm.release.v1.{}.v", name);
    let latest_rev = secrets
        .iter()
        .filter_map(|s| {
            let secret_name = s.metadata.name.as_ref()?;
            if secret_name.starts_with(&prefix) {
                secret_name.strip_prefix(&prefix)?.parse::<i32>().ok()
            } else {
                None
            }
        })
        .max()
        .ok_or_else(|| format!("Helm release '{}' not found", name))?;

    let secret_name = format!("sh.helm.release.v1.{}.v{}", name, latest_rev);
    let secret = api
        .get(&secret_name)
        .await
        .map_err(|e| format!("Failed to get helm secret: {}", e))?;

    let data = secret
        .data
        .as_ref()
        .and_then(|d| d.get("release"))
        .ok_or("Release data not found in secret")?;

    // Decode: base64 -> (maybe base64) -> gzip -> json
    let data_str = String::from_utf8_lossy(&data.0);
    let decoded1 = BASE64
        .decode(data_str.as_ref())
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    let gzip_data = if decoded1.len() >= 2 && decoded1[0] == 0x1f && decoded1[1] == 0x8b {
        decoded1
    } else {
        BASE64
            .decode(&decoded1)
            .map_err(|e| format!("Failed to decode base64 (2nd): {}", e))?
    };

    let mut decoder = GzDecoder::new(&gzip_data[..]);
    let mut decompressed = String::new();
    decoder
        .read_to_string(&mut decompressed)
        .map_err(|e| format!("Failed to decompress: {}", e))?;

    let release_data: Value =
        serde_json::from_str(&decompressed).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    let yaml = serde_yaml::to_string(&release_data)
        .map_err(|e| format!("Failed to serialize to YAML: {}", e))?;

    Ok(ResourceYaml {
        yaml,
        api_version: "helm.sh/v3".to_string(),
        kind: "Release".to_string(),
        name: name.to_string(),
        namespace: Some(ns),
        uid: secret.metadata.uid.unwrap_or_default(),
        labels: btree_to_hashmap(secret.metadata.labels),
        annotations: btree_to_hashmap(secret.metadata.annotations),
        created_at: secret.metadata.creation_timestamp.map(|t| t.0.to_string()),
    })
}

/// Resolve a resource type string to (group, version, kind, plural, namespaced)
fn resolve_resource_type(resource_type: &str) -> Option<(&str, &str, &str, &str, bool)> {
    // (api_group, version, kind, plural, namespaced)
    match resource_type.to_lowercase().as_str() {
        // Core v1
        "pod" | "pods" => Some(("", "v1", "Pod", "pods", true)),
        "service" | "services" => Some(("", "v1", "Service", "services", true)),
        "configmap" | "configmaps" => Some(("", "v1", "ConfigMap", "configmaps", true)),
        "secret" | "secrets" => Some(("", "v1", "Secret", "secrets", true)),
        "node" | "nodes" => Some(("", "v1", "Node", "nodes", false)),
        "namespace" | "namespaces" => Some(("", "v1", "Namespace", "namespaces", false)),
        "event" | "events" => Some(("", "v1", "Event", "events", true)),
        "serviceaccount" | "serviceaccounts" => {
            Some(("", "v1", "ServiceAccount", "serviceaccounts", true))
        }
        "persistentvolume" | "persistentvolumes" | "pv" => {
            Some(("", "v1", "PersistentVolume", "persistentvolumes", false))
        }
        "persistentvolumeclaim" | "persistentvolumeclaims" | "pvc" => Some((
            "",
            "v1",
            "PersistentVolumeClaim",
            "persistentvolumeclaims",
            true,
        )),
        "resourcequota" | "resourcequotas" => {
            Some(("", "v1", "ResourceQuota", "resourcequotas", true))
        }
        "limitrange" | "limitranges" => Some(("", "v1", "LimitRange", "limitranges", true)),
        // Apps v1
        "deployment" | "deployments" => Some(("apps", "v1", "Deployment", "deployments", true)),
        "replicaset" | "replicasets" => Some(("apps", "v1", "ReplicaSet", "replicasets", true)),
        "statefulset" | "statefulsets" => Some(("apps", "v1", "StatefulSet", "statefulsets", true)),
        "daemonset" | "daemonsets" => Some(("apps", "v1", "DaemonSet", "daemonsets", true)),
        "job" | "jobs" => Some(("batch", "v1", "Job", "jobs", true)),
        "cronjob" | "cronjobs" => Some(("batch", "v1", "CronJob", "cronjobs", true)),
        "ingress" | "ingresses" => Some(("networking.k8s.io", "v1", "Ingress", "ingresses", true)),
        "ingressclass" | "ingressclasses" => Some((
            "networking.k8s.io",
            "v1",
            "IngressClass",
            "ingressclasses",
            false,
        )),
        "endpointslice" | "endpointslices" => Some((
            "discovery.k8s.io",
            "v1",
            "EndpointSlice",
            "endpointslices",
            true,
        )),
        "lease" | "leases" => Some(("coordination.k8s.io", "v1", "Lease", "leases", true)),
        "hpa" | "horizontalpodautoscaler" | "horizontalpodautoscalers" => Some((
            "autoscaling",
            "v2",
            "HorizontalPodAutoscaler",
            "horizontalpodautoscalers",
            true,
        )),
        "pdb" | "poddisruptionbudget" | "poddisruptionbudgets" => Some((
            "policy",
            "v1",
            "PodDisruptionBudget",
            "poddisruptionbudgets",
            true,
        )),
        "storageclass" | "storageclasses" => Some((
            "storage.k8s.io",
            "v1",
            "StorageClass",
            "storageclasses",
            false,
        )),
        "csidriver" | "csidrivers" => {
            Some(("storage.k8s.io", "v1", "CSIDriver", "csidrivers", false))
        }
        "csinode" | "csinodes" => Some(("storage.k8s.io", "v1", "CSINode", "csinodes", false)),
        "volumeattachment" | "volumeattachments" => Some((
            "storage.k8s.io",
            "v1",
            "VolumeAttachment",
            "volumeattachments",
            false,
        )),
        "role" | "roles" => Some(("rbac.authorization.k8s.io", "v1", "Role", "roles", true)),
        "rolebinding" | "rolebindings" => Some((
            "rbac.authorization.k8s.io",
            "v1",
            "RoleBinding",
            "rolebindings",
            true,
        )),
        "clusterrole" | "clusterroles" => Some((
            "rbac.authorization.k8s.io",
            "v1",
            "ClusterRole",
            "clusterroles",
            false,
        )),
        "clusterrolebinding" | "clusterrolebindings" => Some((
            "rbac.authorization.k8s.io",
            "v1",
            "ClusterRoleBinding",
            "clusterrolebindings",
            false,
        )),
        "runtimeclass" | "runtimeclasses" => {
            Some(("node.k8s.io", "v1", "RuntimeClass", "runtimeclasses", false))
        }
        "priorityclass" | "priorityclasses" => Some((
            "scheduling.k8s.io",
            "v1",
            "PriorityClass",
            "priorityclasses",
            false,
        )),
        "customresourcedefinition" | "customresourcedefinitions" | "crd" => Some((
            "apiextensions.k8s.io",
            "v1",
            "CustomResourceDefinition",
            "customresourcedefinitions",
            false,
        )),
        "validatingwebhookconfiguration" | "validatingwebhookconfigurations" => Some((
            "admissionregistration.k8s.io",
            "v1",
            "ValidatingWebhookConfiguration",
            "validatingwebhookconfigurations",
            false,
        )),
        "mutatingwebhookconfiguration" | "mutatingwebhookconfigurations" => Some((
            "admissionregistration.k8s.io",
            "v1",
            "MutatingWebhookConfiguration",
            "mutatingwebhookconfigurations",
            false,
        )),
        // Flux CRDs
        "kustomization" | "kustomizations" => Some((
            "kustomize.toolkit.fluxcd.io",
            "v1",
            "Kustomization",
            "kustomizations",
            true,
        )),
        "helmrelease" | "helmreleases" => Some((
            "helm.toolkit.fluxcd.io",
            "v2",
            "HelmRelease",
            "helmreleases",
            true,
        )),
        _ => None,
    }
}

/// Fetch any resource type dynamically using kube discovery
async fn get_resource_yaml_dynamic(
    client: kube::Client,
    resource_type: &str,
    name: &str,
    namespace: Option<&str>,
) -> Result<ResourceYaml, String> {
    let (group, version, kind, plural, namespaced) = resolve_resource_type(resource_type)
        .ok_or_else(|| format!("Unsupported resource type: {}", resource_type))?;

    let api_version = if group.is_empty() {
        version.to_string()
    } else {
        format!("{}/{}", group, version)
    };

    let ar = ApiResource {
        group: group.to_string(),
        version: version.to_string(),
        kind: kind.to_string(),
        plural: plural.to_string(),
        api_version: api_version.clone(),
    };

    let api: Api<DynamicObject> = if namespaced {
        let ns = namespace.ok_or_else(|| format!("Namespace required for {}", resource_type))?;
        Api::namespaced_with(client, ns, &ar)
    } else {
        Api::all_with(client, &ar)
    };

    let resource = api
        .get(name)
        .await
        .map_err(|e| format!("Failed to get {}: {}", resource_type, e))?;

    // Serialize to JSON Value so we can strip managedFields before YAML output
    let mut value = serde_json::to_value(&resource)
        .map_err(|e| format!("Failed to serialize resource: {}", e))?;
    strip_managed_fields(&mut value);

    let yaml =
        serde_yaml::to_string(&value).map_err(|e| format!("Failed to serialize to YAML: {}", e))?;

    Ok(ResourceYaml {
        yaml,
        api_version,
        kind: kind.to_string(),
        name: resource.name_any(),
        namespace: resource.namespace(),
        uid: resource.metadata.uid.unwrap_or_default(),
        labels: btree_to_hashmap(resource.metadata.labels),
        annotations: btree_to_hashmap(resource.metadata.annotations),
        created_at: resource
            .metadata
            .creation_timestamp
            .map(|t| t.0.to_string()),
    })
}

/// Apply/update a resource from YAML
#[command]
pub async fn apply_resource_yaml(
    state: State<'_, AppState>,
    yaml_content: String,
) -> Result<String, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    // Parse YAML to get resource metadata
    let value: Value =
        serde_yaml::from_str(&yaml_content).map_err(|e| format!("Invalid YAML: {}", e))?;

    let api_version = value["apiVersion"].as_str().ok_or("Missing apiVersion")?;
    let kind = value["kind"].as_str().ok_or("Missing kind")?;
    let name = value["metadata"]["name"]
        .as_str()
        .ok_or("Missing metadata.name")?;
    let namespace = value["metadata"]["namespace"].as_str();

    // Determine the API resource
    let (group, version) = if api_version.contains('/') {
        let parts: Vec<&str> = api_version.splitn(2, '/').collect();
        (parts[0], parts[1])
    } else {
        ("", api_version)
    };

    // Create ApiResource for dynamic API
    let ar = ApiResource {
        group: group.to_string(),
        version: version.to_string(),
        kind: kind.to_string(),
        api_version: api_version.to_string(),
        plural: get_plural(kind),
    };

    // Create dynamic API
    let api: Api<DynamicObject> = if let Some(ns) = namespace {
        Api::namespaced_with(client, ns, &ar)
    } else {
        Api::all_with(client, &ar)
    };

    // Apply using server-side apply
    let patch_params = PatchParams::apply("kubeli").force();
    let json_str = serde_json::to_string(&value)
        .map_err(|e| format!("Failed to serialize resource: {}", e))?;
    let patch =
        Patch::Apply(serde_json::from_str::<DynamicObject>(&json_str).map_err(|e| e.to_string())?);

    api.patch(name, &patch_params, &patch)
        .await
        .map_err(|e| format!("Failed to apply resource: {}", e))?;

    tracing::info!("Applied {} {}", kind, name);
    Ok(format!("{} {} applied successfully", kind, name))
}

/// Delete a resource by type, name and namespace
#[command]
pub async fn delete_resource(
    state: State<'_, AppState>,
    resource_type: String,
    name: String,
    namespace: Option<String>,
) -> Result<(), String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let (group, version, kind, plural, namespaced) = resolve_resource_type(&resource_type)
        .ok_or_else(|| format!("Unsupported resource type: {}", resource_type))?;

    let api_version = if group.is_empty() {
        version.to_string()
    } else {
        format!("{}/{}", group, version)
    };

    let ar = ApiResource {
        group: group.to_string(),
        version: version.to_string(),
        kind: kind.to_string(),
        plural: plural.to_string(),
        api_version,
    };

    let api: Api<DynamicObject> = if namespaced {
        let ns = namespace.ok_or_else(|| format!("Namespace required for {}", resource_type))?;
        Api::namespaced_with(client, &ns, &ar)
    } else {
        Api::all_with(client, &ar)
    };

    api.delete(&name, &DeleteParams::default())
        .await
        .map_err(|e| format!("Failed to delete {}: {}", resource_type, e))?;

    tracing::info!("Deleted {} {}", resource_type, name);
    Ok(())
}

/// Scale a deployment by changing replica count
#[command]
pub async fn scale_deployment(
    state: State<'_, AppState>,
    name: String,
    namespace: String,
    replicas: i32,
) -> Result<(), String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let api: Api<Deployment> = Api::namespaced(client, &namespace);

    let patch = serde_json::json!({
        "spec": { "replicas": replicas }
    });

    api.patch(&name, &PatchParams::default(), &Patch::Merge(&patch))
        .await
        .map_err(|e| format!("Failed to scale deployment: {}", e))?;

    tracing::info!("Scaled deployment {} to {} replicas", name, replicas);
    Ok(())
}

/// Namespace-specific information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NamespaceInfo {
    pub name: String,
    pub uid: String,
    pub status: String,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
    pub annotations: HashMap<String, String>,
}

/// List all namespaces in the cluster
#[command]
pub async fn list_namespaces(state: State<'_, AppState>) -> Result<Vec<NamespaceInfo>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let namespaces: Api<Namespace> = Api::all(client);
    let list = namespaces
        .list(&ListParams::default())
        .await
        .map_err(|e| format!("Failed to list namespaces: {}", e))?;

    let result: Vec<NamespaceInfo> = list
        .items
        .into_iter()
        .map(|ns| {
            let status = ns
                .status
                .as_ref()
                .and_then(|s| s.phase.as_ref())
                .cloned()
                .unwrap_or_else(|| "Unknown".to_string());

            NamespaceInfo {
                name: ns.name_any(),
                uid: ns.metadata.uid.unwrap_or_default(),
                status,
                created_at: ns.metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(ns.metadata.labels),
                annotations: btree_to_hashmap(ns.metadata.annotations),
            }
        })
        .collect();

    Ok(result)
}

/// Helper to get plural form of resource kind
fn get_plural(kind: &str) -> String {
    match kind.to_lowercase().as_str() {
        "pod" => "pods".to_string(),
        "deployment" => "deployments".to_string(),
        "service" => "services".to_string(),
        "configmap" => "configmaps".to_string(),
        "secret" => "secrets".to_string(),
        "node" => "nodes".to_string(),
        "namespace" => "namespaces".to_string(),
        "persistentvolume" => "persistentvolumes".to_string(),
        "persistentvolumeclaim" => "persistentvolumeclaims".to_string(),
        "serviceaccount" => "serviceaccounts".to_string(),
        "role" => "roles".to_string(),
        "rolebinding" => "rolebindings".to_string(),
        "clusterrole" => "clusterroles".to_string(),
        "clusterrolebinding" => "clusterrolebindings".to_string(),
        "ingress" => "ingresses".to_string(),
        "networkpolicy" => "networkpolicies".to_string(),
        "statefulset" => "statefulsets".to_string(),
        "daemonset" => "daemonsets".to_string(),
        "replicaset" => "replicasets".to_string(),
        "job" => "jobs".to_string(),
        "cronjob" => "cronjobs".to_string(),
        "event" => "events".to_string(),
        "lease" => "leases".to_string(),
        _ => format!("{}s", kind.to_lowercase()),
    }
}

/// Event involved object reference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventInvolvedObject {
    pub kind: String,
    pub name: String,
    pub namespace: Option<String>,
    pub uid: Option<String>,
}

/// Event information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventInfo {
    pub name: String,
    pub namespace: String,
    pub uid: String,
    pub event_type: String,
    pub reason: String,
    pub message: String,
    pub involved_object: EventInvolvedObject,
    pub count: i32,
    pub first_timestamp: Option<String>,
    pub last_timestamp: Option<String>,
    pub source_component: Option<String>,
    pub source_host: Option<String>,
    pub created_at: Option<String>,
}

/// List all events in a namespace or all namespaces
#[command]
pub async fn list_events(
    state: State<'_, AppState>,
    options: ListOptions,
) -> Result<Vec<EventInfo>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let mut list_params = ListParams::default();
    if let Some(label_selector) = &options.label_selector {
        list_params = list_params.labels(label_selector);
    }
    if let Some(field_selector) = &options.field_selector {
        list_params = list_params.fields(field_selector);
    }
    if let Some(limit) = options.limit {
        list_params = list_params.limit(limit);
    }

    let events: Api<Event> = if let Some(ns) = &options.namespace {
        Api::namespaced(client, ns)
    } else {
        Api::all(client)
    };

    let event_list = events
        .list(&list_params)
        .await
        .map_err(|e| format!("Failed to list events: {}", e))?;

    let event_infos: Vec<EventInfo> = event_list
        .items
        .into_iter()
        .map(|event| {
            let metadata = event.metadata;
            let involved = event.involved_object;

            EventInfo {
                name: metadata.name.unwrap_or_default(),
                namespace: metadata.namespace.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                event_type: event.type_.unwrap_or_else(|| "Normal".to_string()),
                reason: event.reason.unwrap_or_default(),
                message: event.message.unwrap_or_default(),
                involved_object: EventInvolvedObject {
                    kind: involved.kind.unwrap_or_default(),
                    name: involved.name.unwrap_or_default(),
                    namespace: involved.namespace,
                    uid: involved.uid,
                },
                count: event.count.unwrap_or(1),
                first_timestamp: event.first_timestamp.map(|t| t.0.to_string()),
                last_timestamp: event.last_timestamp.map(|t| t.0.to_string()),
                source_component: event.source.as_ref().and_then(|s| s.component.clone()),
                source_host: event.source.and_then(|s| s.host),
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
            }
        })
        .collect();

    tracing::info!("Listed {} events", event_infos.len());
    Ok(event_infos)
}

/// Lease information (for leader election)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseInfo {
    pub name: String,
    pub namespace: String,
    pub uid: String,
    pub holder_identity: Option<String>,
    pub lease_duration_seconds: Option<i32>,
    pub acquire_time: Option<String>,
    pub renew_time: Option<String>,
    pub lease_transitions: Option<i32>,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

/// List all leases in a namespace or all namespaces
#[command]
pub async fn list_leases(
    state: State<'_, AppState>,
    options: ListOptions,
) -> Result<Vec<LeaseInfo>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let mut list_params = ListParams::default();
    if let Some(label_selector) = &options.label_selector {
        list_params = list_params.labels(label_selector);
    }
    if let Some(limit) = options.limit {
        list_params = list_params.limit(limit);
    }

    let leases: Api<Lease> = if let Some(ns) = &options.namespace {
        Api::namespaced(client, ns)
    } else {
        Api::all(client)
    };

    let lease_list = leases
        .list(&list_params)
        .await
        .map_err(|e| format!("Failed to list leases: {}", e))?;

    let lease_infos: Vec<LeaseInfo> = lease_list
        .items
        .into_iter()
        .map(|lease| {
            let metadata = lease.metadata;
            let spec = lease.spec.unwrap_or_default();

            LeaseInfo {
                name: metadata.name.unwrap_or_default(),
                namespace: metadata.namespace.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                holder_identity: spec.holder_identity,
                lease_duration_seconds: spec.lease_duration_seconds,
                acquire_time: spec.acquire_time.map(|t| t.0.to_string()),
                renew_time: spec.renew_time.map(|t| t.0.to_string()),
                lease_transitions: spec.lease_transitions,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} leases", lease_infos.len());
    Ok(lease_infos)
}

/// ReplicaSet information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplicaSetInfo {
    pub name: String,
    pub namespace: String,
    pub uid: String,
    pub replicas: i32,
    pub ready_replicas: i32,
    pub available_replicas: i32,
    pub owner_name: Option<String>,
    pub owner_kind: Option<String>,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
    pub selector: HashMap<String, String>,
}

/// List all replica sets
#[command]
pub async fn list_replicasets(
    state: State<'_, AppState>,
    options: ListOptions,
) -> Result<Vec<ReplicaSetInfo>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let mut list_params = ListParams::default();
    if let Some(label_selector) = &options.label_selector {
        list_params = list_params.labels(label_selector);
    }
    if let Some(limit) = options.limit {
        list_params = list_params.limit(limit);
    }

    let api: Api<ReplicaSet> = if let Some(ns) = &options.namespace {
        Api::namespaced(client, ns)
    } else {
        Api::all(client)
    };

    let list = api
        .list(&list_params)
        .await
        .map_err(|e| format!("Failed to list replicasets: {}", e))?;

    let infos: Vec<ReplicaSetInfo> = list
        .items
        .into_iter()
        .map(|rs| {
            let metadata = rs.metadata;
            let spec = rs.spec.unwrap_or_default();
            let status = rs.status.unwrap_or_default();

            let (owner_name, owner_kind) = metadata
                .owner_references
                .as_ref()
                .and_then(|refs| refs.first())
                .map(|r| (Some(r.name.clone()), Some(r.kind.clone())))
                .unwrap_or((None, None));

            ReplicaSetInfo {
                name: metadata.name.unwrap_or_default(),
                namespace: metadata.namespace.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                replicas: status.replicas,
                ready_replicas: status.ready_replicas.unwrap_or(0),
                available_replicas: status.available_replicas.unwrap_or(0),
                owner_name,
                owner_kind,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
                selector: btree_to_hashmap(spec.selector.match_labels),
            }
        })
        .collect();

    tracing::info!("Listed {} replicasets", infos.len());
    Ok(infos)
}

/// DaemonSet information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaemonSetInfo {
    pub name: String,
    pub namespace: String,
    pub uid: String,
    pub desired_number_scheduled: i32,
    pub current_number_scheduled: i32,
    pub number_ready: i32,
    pub number_available: i32,
    pub number_misscheduled: i32,
    pub updated_number_scheduled: i32,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
    pub node_selector: HashMap<String, String>,
}

/// List all daemon sets
#[command]
pub async fn list_daemonsets(
    state: State<'_, AppState>,
    options: ListOptions,
) -> Result<Vec<DaemonSetInfo>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let mut list_params = ListParams::default();
    if let Some(label_selector) = &options.label_selector {
        list_params = list_params.labels(label_selector);
    }
    if let Some(limit) = options.limit {
        list_params = list_params.limit(limit);
    }

    let api: Api<DaemonSet> = if let Some(ns) = &options.namespace {
        Api::namespaced(client, ns)
    } else {
        Api::all(client)
    };

    let list = api
        .list(&list_params)
        .await
        .map_err(|e| format!("Failed to list daemonsets: {}", e))?;

    let infos: Vec<DaemonSetInfo> = list
        .items
        .into_iter()
        .map(|ds| {
            let metadata = ds.metadata;
            let spec = ds.spec.unwrap_or_default();
            let status = ds.status.unwrap_or_default();

            let node_selector = spec
                .template
                .spec
                .and_then(|s| s.node_selector)
                .map(|ns| ns.into_iter().collect())
                .unwrap_or_default();

            DaemonSetInfo {
                name: metadata.name.unwrap_or_default(),
                namespace: metadata.namespace.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                desired_number_scheduled: status.desired_number_scheduled,
                current_number_scheduled: status.current_number_scheduled,
                number_ready: status.number_ready,
                number_available: status.number_available.unwrap_or(0),
                number_misscheduled: status.number_misscheduled,
                updated_number_scheduled: status.updated_number_scheduled.unwrap_or(0),
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
                node_selector,
            }
        })
        .collect();

    tracing::info!("Listed {} daemonsets", infos.len());
    Ok(infos)
}

/// StatefulSet information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatefulSetInfo {
    pub name: String,
    pub namespace: String,
    pub uid: String,
    pub replicas: i32,
    pub ready_replicas: i32,
    pub current_replicas: i32,
    pub updated_replicas: i32,
    pub service_name: Option<String>,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

/// List all stateful sets
#[command]
pub async fn list_statefulsets(
    state: State<'_, AppState>,
    options: ListOptions,
) -> Result<Vec<StatefulSetInfo>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let mut list_params = ListParams::default();
    if let Some(label_selector) = &options.label_selector {
        list_params = list_params.labels(label_selector);
    }
    if let Some(limit) = options.limit {
        list_params = list_params.limit(limit);
    }

    let api: Api<StatefulSet> = if let Some(ns) = &options.namespace {
        Api::namespaced(client, ns)
    } else {
        Api::all(client)
    };

    let list = api
        .list(&list_params)
        .await
        .map_err(|e| format!("Failed to list statefulsets: {}", e))?;

    let infos: Vec<StatefulSetInfo> = list
        .items
        .into_iter()
        .map(|sts| {
            let metadata = sts.metadata;
            let spec = sts.spec.unwrap_or_default();
            let status = sts.status.unwrap_or_default();

            StatefulSetInfo {
                name: metadata.name.unwrap_or_default(),
                namespace: metadata.namespace.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                replicas: status.replicas,
                ready_replicas: status.ready_replicas.unwrap_or(0),
                current_replicas: status.current_replicas.unwrap_or(0),
                updated_replicas: status.updated_replicas.unwrap_or(0),
                service_name: spec.service_name,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} statefulsets", infos.len());
    Ok(infos)
}

/// Job information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobInfo {
    pub name: String,
    pub namespace: String,
    pub uid: String,
    pub completions: Option<i32>,
    pub parallelism: Option<i32>,
    pub succeeded: i32,
    pub failed: i32,
    pub active: i32,
    pub start_time: Option<String>,
    pub completion_time: Option<String>,
    pub duration_seconds: Option<i64>,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
    pub status: String,
}

/// List all jobs
#[command]
pub async fn list_jobs(
    state: State<'_, AppState>,
    options: ListOptions,
) -> Result<Vec<JobInfo>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let mut list_params = ListParams::default();
    if let Some(label_selector) = &options.label_selector {
        list_params = list_params.labels(label_selector);
    }
    if let Some(limit) = options.limit {
        list_params = list_params.limit(limit);
    }

    let api: Api<Job> = if let Some(ns) = &options.namespace {
        Api::namespaced(client, ns)
    } else {
        Api::all(client)
    };

    let list = api
        .list(&list_params)
        .await
        .map_err(|e| format!("Failed to list jobs: {}", e))?;

    let infos: Vec<JobInfo> = list
        .items
        .into_iter()
        .map(|job| {
            let metadata = job.metadata;
            let spec = job.spec.unwrap_or_default();
            let status = job.status.unwrap_or_default();

            let start_time = status.start_time.as_ref().map(|t| t.0.to_string());
            let completion_time = status.completion_time.as_ref().map(|t| t.0.to_string());

            let duration_seconds = match (&status.start_time, &status.completion_time) {
                (Some(start), Some(end)) => Some(end.0.as_second() - start.0.as_second()),
                _ => None,
            };

            let job_status = if status.succeeded.unwrap_or(0) > 0 {
                "Complete"
            } else if status.failed.unwrap_or(0) > 0 {
                "Failed"
            } else if status.active.unwrap_or(0) > 0 {
                "Running"
            } else {
                "Pending"
            };

            JobInfo {
                name: metadata.name.unwrap_or_default(),
                namespace: metadata.namespace.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                completions: spec.completions,
                parallelism: spec.parallelism,
                succeeded: status.succeeded.unwrap_or(0),
                failed: status.failed.unwrap_or(0),
                active: status.active.unwrap_or(0),
                start_time,
                completion_time,
                duration_seconds,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
                status: job_status.to_string(),
            }
        })
        .collect();

    tracing::info!("Listed {} jobs", infos.len());
    Ok(infos)
}

/// CronJob information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CronJobInfo {
    pub name: String,
    pub namespace: String,
    pub uid: String,
    pub schedule: String,
    pub suspend: bool,
    pub active_jobs: i32,
    pub last_schedule_time: Option<String>,
    pub last_successful_time: Option<String>,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

/// List all cron jobs
#[command]
pub async fn list_cronjobs(
    state: State<'_, AppState>,
    options: ListOptions,
) -> Result<Vec<CronJobInfo>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let mut list_params = ListParams::default();
    if let Some(label_selector) = &options.label_selector {
        list_params = list_params.labels(label_selector);
    }
    if let Some(limit) = options.limit {
        list_params = list_params.limit(limit);
    }

    let api: Api<CronJob> = if let Some(ns) = &options.namespace {
        Api::namespaced(client, ns)
    } else {
        Api::all(client)
    };

    let list = api
        .list(&list_params)
        .await
        .map_err(|e| format!("Failed to list cronjobs: {}", e))?;

    let infos: Vec<CronJobInfo> = list
        .items
        .into_iter()
        .map(|cj| {
            let metadata = cj.metadata;
            let spec = cj.spec.unwrap_or_default();
            let status = cj.status.unwrap_or_default();

            CronJobInfo {
                name: metadata.name.unwrap_or_default(),
                namespace: metadata.namespace.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                schedule: spec.schedule,
                suspend: spec.suspend.unwrap_or(false),
                active_jobs: status.active.map(|a| a.len() as i32).unwrap_or(0),
                last_schedule_time: status.last_schedule_time.map(|t| t.0.to_string()),
                last_successful_time: status.last_successful_time.map(|t| t.0.to_string()),
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} cronjobs", infos.len());
    Ok(infos)
}

// ============================================================================
// Networking Resources
// ============================================================================

/// Ingress backend information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngressBackend {
    pub service_name: Option<String>,
    pub service_port: Option<String>,
    pub resource_name: Option<String>,
    pub resource_kind: Option<String>,
}

/// Ingress path information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngressPath {
    pub path: Option<String>,
    pub path_type: String,
    pub backend: IngressBackend,
}

/// Ingress rule information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngressRule {
    pub host: Option<String>,
    pub paths: Vec<IngressPath>,
}

/// Ingress TLS information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngressTLS {
    pub hosts: Vec<String>,
    pub secret_name: Option<String>,
}

/// Ingress information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngressInfo {
    pub name: String,
    pub namespace: String,
    pub uid: String,
    pub ingress_class_name: Option<String>,
    pub rules: Vec<IngressRule>,
    pub tls: Vec<IngressTLS>,
    pub default_backend: Option<IngressBackend>,
    pub load_balancer_ip: Option<String>,
    pub load_balancer_hostname: Option<String>,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
    pub annotations: HashMap<String, String>,
}

/// List all ingresses
#[command]
pub async fn list_ingresses(
    state: State<'_, AppState>,
    options: ListOptions,
) -> Result<Vec<IngressInfo>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let mut list_params = ListParams::default();
    if let Some(label_selector) = &options.label_selector {
        list_params = list_params.labels(label_selector);
    }
    if let Some(limit) = options.limit {
        list_params = list_params.limit(limit);
    }

    let api: Api<Ingress> = if let Some(ns) = &options.namespace {
        Api::namespaced(client, ns)
    } else {
        Api::all(client)
    };

    let list = api
        .list(&list_params)
        .await
        .map_err(|e| format!("Failed to list ingresses: {}", e))?;

    let infos: Vec<IngressInfo> = list
        .items
        .into_iter()
        .map(|ingress| {
            let metadata = ingress.metadata;
            let spec = ingress.spec.unwrap_or_default();
            let status = ingress.status.unwrap_or_default();

            let rules = spec
                .rules
                .unwrap_or_default()
                .into_iter()
                .map(|rule| {
                    let paths = rule
                        .http
                        .map(|http| {
                            http.paths
                                .into_iter()
                                .map(|p| {
                                    let backend = IngressBackend {
                                        service_name: p
                                            .backend
                                            .service
                                            .as_ref()
                                            .map(|s| s.name.clone()),
                                        service_port: p.backend.service.as_ref().and_then(|s| {
                                            s.port.as_ref().map(|port| {
                                                port.name.clone().unwrap_or_else(|| {
                                                    port.number
                                                        .map(|n| n.to_string())
                                                        .unwrap_or_default()
                                                })
                                            })
                                        }),
                                        resource_name: p
                                            .backend
                                            .resource
                                            .as_ref()
                                            .map(|r| r.name.clone()),
                                        resource_kind: p
                                            .backend
                                            .resource
                                            .as_ref()
                                            .map(|r| r.kind.clone()),
                                    };
                                    IngressPath {
                                        path: p.path,
                                        path_type: p.path_type,
                                        backend,
                                    }
                                })
                                .collect()
                        })
                        .unwrap_or_default();
                    IngressRule {
                        host: rule.host,
                        paths,
                    }
                })
                .collect();

            let tls = spec
                .tls
                .unwrap_or_default()
                .into_iter()
                .map(|t| IngressTLS {
                    hosts: t.hosts.unwrap_or_default(),
                    secret_name: t.secret_name,
                })
                .collect();

            let default_backend = spec.default_backend.map(|b| IngressBackend {
                service_name: b.service.as_ref().map(|s| s.name.clone()),
                service_port: b.service.as_ref().and_then(|s| {
                    s.port.as_ref().map(|port| {
                        port.name.clone().unwrap_or_else(|| {
                            port.number.map(|n| n.to_string()).unwrap_or_default()
                        })
                    })
                }),
                resource_name: b.resource.as_ref().map(|r| r.name.clone()),
                resource_kind: b.resource.as_ref().map(|r| r.kind.clone()),
            });

            let lb_status = status.load_balancer.unwrap_or_default();
            let lb_ingress = lb_status.ingress.unwrap_or_default();
            let first_lb = lb_ingress.first();

            IngressInfo {
                name: metadata.name.unwrap_or_default(),
                namespace: metadata.namespace.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                ingress_class_name: spec.ingress_class_name,
                rules,
                tls,
                default_backend,
                load_balancer_ip: first_lb.and_then(|lb| lb.ip.clone()),
                load_balancer_hostname: first_lb.and_then(|lb| lb.hostname.clone()),
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
                annotations: btree_to_hashmap(metadata.annotations),
            }
        })
        .collect();

    tracing::info!("Listed {} ingresses", infos.len());
    Ok(infos)
}

/// EndpointSlice port information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointSlicePort {
    pub name: Option<String>,
    pub port: i32,
    pub protocol: String,
    pub app_protocol: Option<String>,
}

/// Endpoint conditions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointConditions {
    pub ready: Option<bool>,
    pub serving: Option<bool>,
    pub terminating: Option<bool>,
}

/// Endpoint information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointInfo {
    pub addresses: Vec<String>,
    pub conditions: EndpointConditions,
    pub hostname: Option<String>,
    pub node_name: Option<String>,
    pub zone: Option<String>,
    pub target_ref_kind: Option<String>,
    pub target_ref_name: Option<String>,
}

/// EndpointSlice information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointSliceInfo {
    pub name: String,
    pub namespace: String,
    pub uid: String,
    pub address_type: String,
    pub endpoints: Vec<EndpointInfo>,
    pub ports: Vec<EndpointSlicePort>,
    pub service_name: Option<String>,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

/// List all endpoint slices
#[command]
pub async fn list_endpoint_slices(
    state: State<'_, AppState>,
    options: ListOptions,
) -> Result<Vec<EndpointSliceInfo>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let mut list_params = ListParams::default();
    if let Some(label_selector) = &options.label_selector {
        list_params = list_params.labels(label_selector);
    }
    if let Some(limit) = options.limit {
        list_params = list_params.limit(limit);
    }

    let api: Api<EndpointSlice> = if let Some(ns) = &options.namespace {
        Api::namespaced(client, ns)
    } else {
        Api::all(client)
    };

    let list = api
        .list(&list_params)
        .await
        .map_err(|e| format!("Failed to list endpoint slices: {}", e))?;

    let infos: Vec<EndpointSliceInfo> = list
        .items
        .into_iter()
        .map(|es| {
            let metadata = es.metadata;

            let endpoints = es
                .endpoints
                .into_iter()
                .map(|ep| EndpointInfo {
                    addresses: ep.addresses,
                    conditions: EndpointConditions {
                        ready: ep.conditions.as_ref().and_then(|c| c.ready),
                        serving: ep.conditions.as_ref().and_then(|c| c.serving),
                        terminating: ep.conditions.as_ref().and_then(|c| c.terminating),
                    },
                    hostname: ep.hostname,
                    node_name: ep.node_name,
                    zone: ep.zone,
                    target_ref_kind: ep.target_ref.as_ref().and_then(|r| r.kind.clone()),
                    target_ref_name: ep.target_ref.as_ref().and_then(|r| r.name.clone()),
                })
                .collect();

            let ports = es
                .ports
                .unwrap_or_default()
                .into_iter()
                .map(|p| EndpointSlicePort {
                    name: p.name,
                    port: p.port.unwrap_or(0),
                    protocol: p.protocol.unwrap_or_else(|| "TCP".to_string()),
                    app_protocol: p.app_protocol,
                })
                .collect();

            let labels = btree_to_hashmap(metadata.labels.clone());
            let service_name = labels.get("kubernetes.io/service-name").cloned();

            EndpointSliceInfo {
                name: metadata.name.unwrap_or_default(),
                namespace: metadata.namespace.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                address_type: es.address_type,
                endpoints,
                ports,
                service_name,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} endpoint slices", infos.len());
    Ok(infos)
}

/// NetworkPolicy port information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkPolicyPort {
    pub protocol: Option<String>,
    pub port: Option<String>,
    pub end_port: Option<i32>,
}

/// NetworkPolicy peer information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkPolicyPeer {
    pub pod_selector: Option<HashMap<String, String>>,
    pub namespace_selector: Option<HashMap<String, String>>,
    pub ip_block_cidr: Option<String>,
    pub ip_block_except: Option<Vec<String>>,
}

/// NetworkPolicy ingress rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkPolicyIngressRule {
    pub ports: Vec<NetworkPolicyPort>,
    pub from: Vec<NetworkPolicyPeer>,
}

/// NetworkPolicy egress rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkPolicyEgressRule {
    pub ports: Vec<NetworkPolicyPort>,
    pub to: Vec<NetworkPolicyPeer>,
}

/// NetworkPolicy information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkPolicyInfo {
    pub name: String,
    pub namespace: String,
    pub uid: String,
    pub pod_selector: HashMap<String, String>,
    pub policy_types: Vec<String>,
    pub ingress_rules: Vec<NetworkPolicyIngressRule>,
    pub egress_rules: Vec<NetworkPolicyEgressRule>,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

fn convert_network_policy_port(
    port: &k8s_openapi::api::networking::v1::NetworkPolicyPort,
) -> NetworkPolicyPort {
    NetworkPolicyPort {
        protocol: port.protocol.clone(),
        port: port.port.as_ref().map(|p| match p {
            k8s_openapi::apimachinery::pkg::util::intstr::IntOrString::Int(i) => i.to_string(),
            k8s_openapi::apimachinery::pkg::util::intstr::IntOrString::String(s) => s.clone(),
        }),
        end_port: port.end_port,
    }
}

fn convert_network_policy_peer(
    peer: &k8s_openapi::api::networking::v1::NetworkPolicyPeer,
) -> NetworkPolicyPeer {
    NetworkPolicyPeer {
        pod_selector: peer.pod_selector.as_ref().and_then(|s| {
            s.match_labels
                .as_ref()
                .map(|m| m.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
        }),
        namespace_selector: peer.namespace_selector.as_ref().and_then(|s| {
            s.match_labels
                .as_ref()
                .map(|m| m.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
        }),
        ip_block_cidr: peer.ip_block.as_ref().map(|b| b.cidr.clone()),
        ip_block_except: peer.ip_block.as_ref().and_then(|b| b.except.clone()),
    }
}

/// List all network policies
#[command]
pub async fn list_network_policies(
    state: State<'_, AppState>,
    options: ListOptions,
) -> Result<Vec<NetworkPolicyInfo>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let mut list_params = ListParams::default();
    if let Some(label_selector) = &options.label_selector {
        list_params = list_params.labels(label_selector);
    }
    if let Some(limit) = options.limit {
        list_params = list_params.limit(limit);
    }

    let api: Api<NetworkPolicy> = if let Some(ns) = &options.namespace {
        Api::namespaced(client, ns)
    } else {
        Api::all(client)
    };

    let list = api
        .list(&list_params)
        .await
        .map_err(|e| format!("Failed to list network policies: {}", e))?;

    let infos: Vec<NetworkPolicyInfo> = list
        .items
        .into_iter()
        .map(|np| {
            let metadata = np.metadata;
            let spec = np.spec.unwrap_or_default();

            let pod_selector: HashMap<String, String> = spec
                .pod_selector
                .and_then(|s| s.match_labels)
                .unwrap_or_default()
                .into_iter()
                .collect();

            let ingress_rules = spec
                .ingress
                .unwrap_or_default()
                .into_iter()
                .map(|rule| NetworkPolicyIngressRule {
                    ports: rule
                        .ports
                        .unwrap_or_default()
                        .iter()
                        .map(convert_network_policy_port)
                        .collect(),
                    from: rule
                        .from
                        .unwrap_or_default()
                        .iter()
                        .map(convert_network_policy_peer)
                        .collect(),
                })
                .collect();

            let egress_rules = spec
                .egress
                .unwrap_or_default()
                .into_iter()
                .map(|rule| NetworkPolicyEgressRule {
                    ports: rule
                        .ports
                        .unwrap_or_default()
                        .iter()
                        .map(convert_network_policy_port)
                        .collect(),
                    to: rule
                        .to
                        .unwrap_or_default()
                        .iter()
                        .map(convert_network_policy_peer)
                        .collect(),
                })
                .collect();

            NetworkPolicyInfo {
                name: metadata.name.unwrap_or_default(),
                namespace: metadata.namespace.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                pod_selector,
                policy_types: spec.policy_types.unwrap_or_default(),
                ingress_rules,
                egress_rules,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} network policies", infos.len());
    Ok(infos)
}

/// IngressClass information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngressClassInfo {
    pub name: String,
    pub uid: String,
    pub controller: Option<String>,
    pub is_default: bool,
    pub parameters_kind: Option<String>,
    pub parameters_name: Option<String>,
    pub parameters_namespace: Option<String>,
    pub parameters_scope: Option<String>,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
    pub annotations: HashMap<String, String>,
}

/// List all ingress classes
#[command]
pub async fn list_ingress_classes(
    state: State<'_, AppState>,
    options: ListOptions,
) -> Result<Vec<IngressClassInfo>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let mut list_params = ListParams::default();
    if let Some(label_selector) = &options.label_selector {
        list_params = list_params.labels(label_selector);
    }
    if let Some(limit) = options.limit {
        list_params = list_params.limit(limit);
    }

    let api: Api<IngressClass> = Api::all(client);

    let list = api
        .list(&list_params)
        .await
        .map_err(|e| format!("Failed to list ingress classes: {}", e))?;

    let infos: Vec<IngressClassInfo> = list
        .items
        .into_iter()
        .map(|ic| {
            let metadata = ic.metadata;
            let spec = ic.spec.unwrap_or_default();
            let annotations = btree_to_hashmap(metadata.annotations.clone());

            let is_default = annotations
                .get("ingressclass.kubernetes.io/is-default-class")
                .map(|v| v == "true")
                .unwrap_or(false);

            IngressClassInfo {
                name: metadata.name.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                controller: spec.controller,
                is_default,
                parameters_kind: spec.parameters.as_ref().map(|p| p.kind.clone()),
                parameters_name: spec.parameters.as_ref().map(|p| p.name.clone()),
                parameters_namespace: spec.parameters.as_ref().and_then(|p| p.namespace.clone()),
                parameters_scope: spec.parameters.as_ref().and_then(|p| p.scope.clone()),
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
                annotations,
            }
        })
        .collect();

    tracing::info!("Listed {} ingress classes", infos.len());
    Ok(infos)
}

// ============================================================================
// Configuration Resources
// ============================================================================

/// HPA metric target information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HPAMetricTarget {
    pub metric_type: String,
    pub average_utilization: Option<i32>,
    pub average_value: Option<String>,
    pub value: Option<String>,
}

/// HPA metric status information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HPAMetricStatus {
    pub metric_type: String,
    pub current_average_utilization: Option<i32>,
    pub current_average_value: Option<String>,
    pub current_value: Option<String>,
}

/// HPA (Horizontal Pod Autoscaler) v2 information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HPAInfo {
    pub name: String,
    pub namespace: String,
    pub uid: String,
    pub scale_target_ref_kind: String,
    pub scale_target_ref_name: String,
    pub min_replicas: Option<i32>,
    pub max_replicas: i32,
    pub current_replicas: i32,
    pub desired_replicas: i32,
    pub metrics: Vec<HPAMetricTarget>,
    pub current_metrics: Vec<HPAMetricStatus>,
    pub conditions: Vec<String>,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

/// List all HPAs
#[command]
pub async fn list_hpas(
    state: State<'_, AppState>,
    options: ListOptions,
) -> Result<Vec<HPAInfo>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let mut list_params = ListParams::default();
    if let Some(label_selector) = &options.label_selector {
        list_params = list_params.labels(label_selector);
    }
    if let Some(limit) = options.limit {
        list_params = list_params.limit(limit);
    }

    let api: Api<HorizontalPodAutoscaler> = if let Some(ns) = &options.namespace {
        Api::namespaced(client, ns)
    } else {
        Api::all(client)
    };

    let list = api
        .list(&list_params)
        .await
        .map_err(|e| format!("Failed to list HPAs: {}", e))?;

    let infos: Vec<HPAInfo> = list
        .items
        .into_iter()
        .map(|hpa| {
            let metadata = hpa.metadata;
            let spec = hpa.spec.unwrap_or_default();
            let status = hpa.status.unwrap_or_default();
            let scale_target = spec.scale_target_ref;

            let metrics: Vec<HPAMetricTarget> = spec
                .metrics
                .unwrap_or_default()
                .into_iter()
                .map(|m| {
                    let metric_type = m.type_.clone();
                    match metric_type.as_str() {
                        "Resource" => {
                            let resource = m.resource.unwrap_or_default();
                            HPAMetricTarget {
                                metric_type,
                                average_utilization: resource.target.average_utilization,
                                average_value: resource.target.average_value.map(|q| q.0),
                                value: resource.target.value.map(|q| q.0),
                            }
                        }
                        _ => HPAMetricTarget {
                            metric_type,
                            average_utilization: None,
                            average_value: None,
                            value: None,
                        },
                    }
                })
                .collect();

            let current_metrics: Vec<HPAMetricStatus> = status
                .current_metrics
                .unwrap_or_default()
                .into_iter()
                .map(|m| {
                    let metric_type = m.type_.clone();
                    match metric_type.as_str() {
                        "Resource" => {
                            let resource = m.resource.unwrap_or_default();
                            HPAMetricStatus {
                                metric_type,
                                current_average_utilization: resource.current.average_utilization,
                                current_average_value: resource.current.average_value.map(|q| q.0),
                                current_value: resource.current.value.map(|q| q.0),
                            }
                        }
                        _ => HPAMetricStatus {
                            metric_type,
                            current_average_utilization: None,
                            current_average_value: None,
                            current_value: None,
                        },
                    }
                })
                .collect();

            let conditions: Vec<String> = status
                .conditions
                .unwrap_or_default()
                .into_iter()
                .filter(|c| c.status == "True")
                .map(|c| c.type_)
                .collect();

            HPAInfo {
                name: metadata.name.unwrap_or_default(),
                namespace: metadata.namespace.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                scale_target_ref_kind: scale_target.kind,
                scale_target_ref_name: scale_target.name,
                min_replicas: spec.min_replicas,
                max_replicas: spec.max_replicas,
                current_replicas: status.current_replicas.unwrap_or(0),
                desired_replicas: status.desired_replicas,
                metrics,
                current_metrics,
                conditions,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} HPAs", infos.len());
    Ok(infos)
}

/// LimitRange item information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LimitRangeItem {
    pub limit_type: String,
    pub default_limits: HashMap<String, String>,
    pub default_requests: HashMap<String, String>,
    pub max: HashMap<String, String>,
    pub min: HashMap<String, String>,
    pub max_limit_request_ratio: HashMap<String, String>,
}

/// LimitRange information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LimitRangeInfo {
    pub name: String,
    pub namespace: String,
    pub uid: String,
    pub limits: Vec<LimitRangeItem>,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

fn quantity_map_to_string_map(
    map: Option<
        std::collections::BTreeMap<String, k8s_openapi::apimachinery::pkg::api::resource::Quantity>,
    >,
) -> HashMap<String, String> {
    map.map(|m| m.into_iter().map(|(k, v)| (k, v.0)).collect())
        .unwrap_or_default()
}

/// List all LimitRanges
#[command]
pub async fn list_limit_ranges(
    state: State<'_, AppState>,
    options: ListOptions,
) -> Result<Vec<LimitRangeInfo>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let mut list_params = ListParams::default();
    if let Some(label_selector) = &options.label_selector {
        list_params = list_params.labels(label_selector);
    }
    if let Some(limit) = options.limit {
        list_params = list_params.limit(limit);
    }

    let api: Api<LimitRange> = if let Some(ns) = &options.namespace {
        Api::namespaced(client, ns)
    } else {
        Api::all(client)
    };

    let list = api
        .list(&list_params)
        .await
        .map_err(|e| format!("Failed to list LimitRanges: {}", e))?;

    let infos: Vec<LimitRangeInfo> = list
        .items
        .into_iter()
        .map(|lr| {
            let metadata = lr.metadata;
            let spec = lr.spec.unwrap_or_default();

            let limits: Vec<LimitRangeItem> = spec
                .limits
                .into_iter()
                .map(|item| LimitRangeItem {
                    limit_type: item.type_,
                    default_limits: quantity_map_to_string_map(item.default),
                    default_requests: quantity_map_to_string_map(item.default_request),
                    max: quantity_map_to_string_map(item.max),
                    min: quantity_map_to_string_map(item.min),
                    max_limit_request_ratio: quantity_map_to_string_map(
                        item.max_limit_request_ratio,
                    ),
                })
                .collect();

            LimitRangeInfo {
                name: metadata.name.unwrap_or_default(),
                namespace: metadata.namespace.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                limits,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} LimitRanges", infos.len());
    Ok(infos)
}

/// ResourceQuota information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceQuotaInfo {
    pub name: String,
    pub namespace: String,
    pub uid: String,
    pub hard: HashMap<String, String>,
    pub used: HashMap<String, String>,
    pub scopes: Vec<String>,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

/// List all ResourceQuotas
#[command]
pub async fn list_resource_quotas(
    state: State<'_, AppState>,
    options: ListOptions,
) -> Result<Vec<ResourceQuotaInfo>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let mut list_params = ListParams::default();
    if let Some(label_selector) = &options.label_selector {
        list_params = list_params.labels(label_selector);
    }
    if let Some(limit) = options.limit {
        list_params = list_params.limit(limit);
    }

    let api: Api<ResourceQuota> = if let Some(ns) = &options.namespace {
        Api::namespaced(client, ns)
    } else {
        Api::all(client)
    };

    let list = api
        .list(&list_params)
        .await
        .map_err(|e| format!("Failed to list ResourceQuotas: {}", e))?;

    let infos: Vec<ResourceQuotaInfo> = list
        .items
        .into_iter()
        .map(|rq| {
            let metadata = rq.metadata;
            let spec = rq.spec.unwrap_or_default();
            let status = rq.status.unwrap_or_default();

            ResourceQuotaInfo {
                name: metadata.name.unwrap_or_default(),
                namespace: metadata.namespace.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                hard: quantity_map_to_string_map(spec.hard),
                used: quantity_map_to_string_map(status.used),
                scopes: spec.scopes.unwrap_or_default(),
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} ResourceQuotas", infos.len());
    Ok(infos)
}

/// PodDisruptionBudget information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PDBInfo {
    pub name: String,
    pub namespace: String,
    pub uid: String,
    pub min_available: Option<String>,
    pub max_unavailable: Option<String>,
    pub current_healthy: i32,
    pub desired_healthy: i32,
    pub disruptions_allowed: i32,
    pub expected_pods: i32,
    pub selector: HashMap<String, String>,
    pub conditions: Vec<String>,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

/// List all PodDisruptionBudgets
#[command]
pub async fn list_pdbs(
    state: State<'_, AppState>,
    options: ListOptions,
) -> Result<Vec<PDBInfo>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let mut list_params = ListParams::default();
    if let Some(label_selector) = &options.label_selector {
        list_params = list_params.labels(label_selector);
    }
    if let Some(limit) = options.limit {
        list_params = list_params.limit(limit);
    }

    let api: Api<PodDisruptionBudget> = if let Some(ns) = &options.namespace {
        Api::namespaced(client, ns)
    } else {
        Api::all(client)
    };

    let list = api
        .list(&list_params)
        .await
        .map_err(|e| format!("Failed to list PDBs: {}", e))?;

    let infos: Vec<PDBInfo> = list
        .items
        .into_iter()
        .map(|pdb| {
            let metadata = pdb.metadata;
            let spec = pdb.spec.unwrap_or_default();
            let status = pdb.status.unwrap_or_default();

            let min_available = spec.min_available.map(|v| match v {
                k8s_openapi::apimachinery::pkg::util::intstr::IntOrString::Int(i) => i.to_string(),
                k8s_openapi::apimachinery::pkg::util::intstr::IntOrString::String(s) => s,
            });

            let max_unavailable = spec.max_unavailable.map(|v| match v {
                k8s_openapi::apimachinery::pkg::util::intstr::IntOrString::Int(i) => i.to_string(),
                k8s_openapi::apimachinery::pkg::util::intstr::IntOrString::String(s) => s,
            });

            let selector = spec
                .selector
                .and_then(|s| s.match_labels)
                .map(|m| m.into_iter().collect())
                .unwrap_or_default();

            let conditions: Vec<String> = status
                .conditions
                .unwrap_or_default()
                .into_iter()
                .filter(|c| c.status == "True")
                .map(|c| c.type_)
                .collect();

            PDBInfo {
                name: metadata.name.unwrap_or_default(),
                namespace: metadata.namespace.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                min_available,
                max_unavailable,
                current_healthy: status.current_healthy,
                desired_healthy: status.desired_healthy,
                disruptions_allowed: status.disruptions_allowed,
                expected_pods: status.expected_pods,
                selector,
                conditions,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} PDBs", infos.len());
    Ok(infos)
}

// =============================================================================
// Storage Resources
// =============================================================================

/// Persistent Volume information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PVInfo {
    pub name: String,
    pub uid: String,
    pub capacity: Option<String>,
    pub access_modes: Vec<String>,
    pub reclaim_policy: Option<String>,
    pub status: String,
    pub claim_name: Option<String>,
    pub claim_namespace: Option<String>,
    pub storage_class_name: Option<String>,
    pub volume_mode: Option<String>,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

/// List Persistent Volumes
#[command]
pub async fn list_persistent_volumes(state: State<'_, AppState>) -> Result<Vec<PVInfo>, String> {
    tracing::info!("Listing persistent volumes");
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let api: Api<PersistentVolume> = Api::all(client.clone());
    let list = api
        .list(&ListParams::default())
        .await
        .map_err(|e| format!("Failed to list PVs: {}", e))?;

    let infos: Vec<PVInfo> = list
        .items
        .into_iter()
        .map(|pv| {
            let metadata = pv.metadata;
            let spec = pv.spec.unwrap_or_default();
            let status = pv.status.unwrap_or_default();

            let capacity = spec
                .capacity
                .as_ref()
                .and_then(|c| c.get("storage"))
                .map(|q| q.0.clone());

            let claim_ref = spec.claim_ref;
            let claim_name = claim_ref.as_ref().and_then(|r| r.name.clone());
            let claim_namespace = claim_ref.as_ref().and_then(|r| r.namespace.clone());

            PVInfo {
                name: metadata.name.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                capacity,
                access_modes: spec.access_modes.unwrap_or_default(),
                reclaim_policy: spec.persistent_volume_reclaim_policy,
                status: status.phase.unwrap_or_else(|| "Unknown".to_string()),
                claim_name,
                claim_namespace,
                storage_class_name: spec.storage_class_name,
                volume_mode: spec.volume_mode,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} persistent volumes", infos.len());
    Ok(infos)
}

/// Persistent Volume Claim information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PVCInfo {
    pub name: String,
    pub namespace: String,
    pub uid: String,
    pub status: String,
    pub volume_name: Option<String>,
    pub storage_class_name: Option<String>,
    pub access_modes: Vec<String>,
    pub capacity: Option<String>,
    pub requested_storage: Option<String>,
    pub volume_mode: Option<String>,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

/// List Persistent Volume Claims
#[command]
pub async fn list_persistent_volume_claims(
    state: State<'_, AppState>,
    namespace: Option<String>,
) -> Result<Vec<PVCInfo>, String> {
    tracing::info!(
        "Listing persistent volume claims in namespace: {:?}",
        namespace
    );
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let api: Api<PersistentVolumeClaim> = match &namespace {
        Some(ns) if !ns.is_empty() => Api::namespaced(client.clone(), ns),
        _ => Api::all(client.clone()),
    };

    let list = api
        .list(&ListParams::default())
        .await
        .map_err(|e| format!("Failed to list PVCs: {}", e))?;

    let infos: Vec<PVCInfo> = list
        .items
        .into_iter()
        .map(|pvc| {
            let metadata = pvc.metadata;
            let spec = pvc.spec.unwrap_or_default();
            let status = pvc.status.unwrap_or_default();

            let capacity = status
                .capacity
                .as_ref()
                .and_then(|c| c.get("storage"))
                .map(|q| q.0.clone());

            let requested_storage = spec
                .resources
                .as_ref()
                .and_then(|r| r.requests.as_ref())
                .and_then(|req| req.get("storage"))
                .map(|q| q.0.clone());

            PVCInfo {
                name: metadata.name.unwrap_or_default(),
                namespace: metadata.namespace.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                status: status.phase.unwrap_or_else(|| "Unknown".to_string()),
                volume_name: spec.volume_name,
                storage_class_name: spec.storage_class_name,
                access_modes: spec.access_modes.unwrap_or_default(),
                capacity,
                requested_storage,
                volume_mode: spec.volume_mode,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} persistent volume claims", infos.len());
    Ok(infos)
}

/// Storage Class information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageClassInfo {
    pub name: String,
    pub uid: String,
    pub provisioner: String,
    pub reclaim_policy: Option<String>,
    pub volume_binding_mode: Option<String>,
    pub allow_volume_expansion: bool,
    pub parameters: HashMap<String, String>,
    pub is_default: bool,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

/// List Storage Classes
#[command]
pub async fn list_storage_classes(
    state: State<'_, AppState>,
) -> Result<Vec<StorageClassInfo>, String> {
    tracing::info!("Listing storage classes");
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let api: Api<StorageClass> = Api::all(client.clone());
    let list = api
        .list(&ListParams::default())
        .await
        .map_err(|e| format!("Failed to list StorageClasses: {}", e))?;

    let infos: Vec<StorageClassInfo> = list
        .items
        .into_iter()
        .map(|sc| {
            let metadata = sc.metadata;

            let is_default = metadata
                .annotations
                .as_ref()
                .map(|a| {
                    a.get("storageclass.kubernetes.io/is-default-class")
                        .or_else(|| a.get("storageclass.beta.kubernetes.io/is-default-class"))
                        .map(|v| v == "true")
                        .unwrap_or(false)
                })
                .unwrap_or(false);

            StorageClassInfo {
                name: metadata.name.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                provisioner: sc.provisioner,
                reclaim_policy: sc.reclaim_policy,
                volume_binding_mode: sc.volume_binding_mode,
                allow_volume_expansion: sc.allow_volume_expansion.unwrap_or(false),
                parameters: sc
                    .parameters
                    .map(|p| p.into_iter().collect())
                    .unwrap_or_default(),
                is_default,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} storage classes", infos.len());
    Ok(infos)
}

/// CSI Driver information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CSIDriverInfo {
    pub name: String,
    pub uid: String,
    pub attach_required: bool,
    pub pod_info_on_mount: bool,
    pub storage_capacity: bool,
    pub volume_lifecycle_modes: Vec<String>,
    pub fs_group_policy: Option<String>,
    pub token_requests: Vec<String>,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

/// List CSI Drivers
#[command]
pub async fn list_csi_drivers(state: State<'_, AppState>) -> Result<Vec<CSIDriverInfo>, String> {
    tracing::info!("Listing CSI drivers");
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let api: Api<CSIDriver> = Api::all(client.clone());
    let list = api
        .list(&ListParams::default())
        .await
        .map_err(|e| format!("Failed to list CSIDrivers: {}", e))?;

    let infos: Vec<CSIDriverInfo> = list
        .items
        .into_iter()
        .map(|driver| {
            let metadata = driver.metadata;
            let spec = driver.spec;

            let token_requests: Vec<String> = spec
                .token_requests
                .unwrap_or_default()
                .into_iter()
                .map(|tr| tr.audience)
                .collect();

            CSIDriverInfo {
                name: metadata.name.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                attach_required: spec.attach_required.unwrap_or(true),
                pod_info_on_mount: spec.pod_info_on_mount.unwrap_or(false),
                storage_capacity: spec.storage_capacity.unwrap_or(false),
                volume_lifecycle_modes: spec.volume_lifecycle_modes.unwrap_or_default(),
                fs_group_policy: spec.fs_group_policy,
                token_requests,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} CSI drivers", infos.len());
    Ok(infos)
}

/// CSI Node Driver information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CSINodeDriver {
    pub name: String,
    pub node_id: String,
    pub allocatable_count: Option<i32>,
    pub topology_keys: Vec<String>,
}

/// CSI Node information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CSINodeInfo {
    pub name: String,
    pub uid: String,
    pub drivers: Vec<CSINodeDriver>,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

/// List CSI Nodes
#[command]
pub async fn list_csi_nodes(state: State<'_, AppState>) -> Result<Vec<CSINodeInfo>, String> {
    tracing::info!("Listing CSI nodes");
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let api: Api<CSINode> = Api::all(client.clone());
    let list = api
        .list(&ListParams::default())
        .await
        .map_err(|e| format!("Failed to list CSINodes: {}", e))?;

    let infos: Vec<CSINodeInfo> = list
        .items
        .into_iter()
        .map(|node| {
            let metadata = node.metadata;
            let spec = node.spec;

            let drivers: Vec<CSINodeDriver> = spec
                .drivers
                .into_iter()
                .map(|d| CSINodeDriver {
                    name: d.name,
                    node_id: d.node_id,
                    allocatable_count: d.allocatable.and_then(|a| a.count),
                    topology_keys: d.topology_keys.unwrap_or_default(),
                })
                .collect();

            CSINodeInfo {
                name: metadata.name.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                drivers,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} CSI nodes", infos.len());
    Ok(infos)
}

/// Volume Attachment information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VolumeAttachmentInfo {
    pub name: String,
    pub uid: String,
    pub attacher: String,
    pub pv_name: Option<String>,
    pub node_name: String,
    pub attached: bool,
    pub attachment_metadata: HashMap<String, String>,
    pub detach_error: Option<String>,
    pub attach_error: Option<String>,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

/// List Volume Attachments
#[command]
pub async fn list_volume_attachments(
    state: State<'_, AppState>,
) -> Result<Vec<VolumeAttachmentInfo>, String> {
    tracing::info!("Listing volume attachments");
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let api: Api<VolumeAttachment> = Api::all(client.clone());
    let list = api
        .list(&ListParams::default())
        .await
        .map_err(|e| format!("Failed to list VolumeAttachments: {}", e))?;

    let infos: Vec<VolumeAttachmentInfo> = list
        .items
        .into_iter()
        .map(|va| {
            let metadata = va.metadata;
            let spec = va.spec;
            let status = va.status;

            let pv_name = spec.source.persistent_volume_name;

            let (attached, attachment_metadata, detach_error, attach_error) = match status {
                Some(s) => {
                    let detach_err = s.detach_error.map(|e| e.message.unwrap_or_default());
                    let attach_err = s.attach_error.map(|e| e.message.unwrap_or_default());
                    (
                        s.attached,
                        s.attachment_metadata
                            .map(|m| m.into_iter().collect())
                            .unwrap_or_default(),
                        detach_err,
                        attach_err,
                    )
                }
                None => (false, HashMap::new(), None, None),
            };

            VolumeAttachmentInfo {
                name: metadata.name.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                attacher: spec.attacher,
                pv_name,
                node_name: spec.node_name,
                attached,
                attachment_metadata,
                detach_error,
                attach_error,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} volume attachments", infos.len());
    Ok(infos)
}

// =============================================================================
// Access Control Resources
// =============================================================================

/// Service Account information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceAccountInfo {
    pub name: String,
    pub namespace: String,
    pub uid: String,
    pub secrets: Vec<String>,
    pub image_pull_secrets: Vec<String>,
    pub automount_service_account_token: Option<bool>,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

/// List Service Accounts
#[command]
pub async fn list_service_accounts(
    state: State<'_, AppState>,
    namespace: Option<String>,
) -> Result<Vec<ServiceAccountInfo>, String> {
    tracing::info!("Listing service accounts in namespace: {:?}", namespace);
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let api: Api<ServiceAccount> = match &namespace {
        Some(ns) if !ns.is_empty() => Api::namespaced(client.clone(), ns),
        _ => Api::all(client.clone()),
    };

    let list = api
        .list(&ListParams::default())
        .await
        .map_err(|e| format!("Failed to list ServiceAccounts: {}", e))?;

    let infos: Vec<ServiceAccountInfo> = list
        .items
        .into_iter()
        .map(|sa| {
            let metadata = sa.metadata;

            let secrets: Vec<String> = sa
                .secrets
                .unwrap_or_default()
                .into_iter()
                .filter_map(|s| s.name)
                .collect();

            let image_pull_secrets: Vec<String> = sa
                .image_pull_secrets
                .unwrap_or_default()
                .into_iter()
                .map(|s| s.name)
                .collect();

            ServiceAccountInfo {
                name: metadata.name.unwrap_or_default(),
                namespace: metadata.namespace.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                secrets,
                image_pull_secrets,
                automount_service_account_token: sa.automount_service_account_token,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} service accounts", infos.len());
    Ok(infos)
}

/// Policy Rule for Roles/ClusterRoles
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyRule {
    pub verbs: Vec<String>,
    pub api_groups: Vec<String>,
    pub resources: Vec<String>,
    pub resource_names: Vec<String>,
    pub non_resource_urls: Vec<String>,
}

/// Role information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleInfo {
    pub name: String,
    pub namespace: String,
    pub uid: String,
    pub rules: Vec<PolicyRule>,
    pub rules_count: usize,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

/// List Roles
#[command]
pub async fn list_roles(
    state: State<'_, AppState>,
    namespace: Option<String>,
) -> Result<Vec<RoleInfo>, String> {
    tracing::info!("Listing roles in namespace: {:?}", namespace);
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let api: Api<Role> = match &namespace {
        Some(ns) if !ns.is_empty() => Api::namespaced(client.clone(), ns),
        _ => Api::all(client.clone()),
    };

    let list = api
        .list(&ListParams::default())
        .await
        .map_err(|e| format!("Failed to list Roles: {}", e))?;

    let infos: Vec<RoleInfo> = list
        .items
        .into_iter()
        .map(|role| {
            let metadata = role.metadata;

            let rules: Vec<PolicyRule> = role
                .rules
                .unwrap_or_default()
                .into_iter()
                .map(|r| PolicyRule {
                    verbs: r.verbs,
                    api_groups: r.api_groups.unwrap_or_default(),
                    resources: r.resources.unwrap_or_default(),
                    resource_names: r.resource_names.unwrap_or_default(),
                    non_resource_urls: r.non_resource_urls.unwrap_or_default(),
                })
                .collect();

            let rules_count = rules.len();

            RoleInfo {
                name: metadata.name.unwrap_or_default(),
                namespace: metadata.namespace.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                rules,
                rules_count,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} roles", infos.len());
    Ok(infos)
}

/// RoleBinding Subject
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleBindingSubject {
    pub kind: String,
    pub name: String,
    pub namespace: Option<String>,
    pub api_group: Option<String>,
}

/// Role Binding information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleBindingInfo {
    pub name: String,
    pub namespace: String,
    pub uid: String,
    pub role_kind: String,
    pub role_name: String,
    pub subjects: Vec<RoleBindingSubject>,
    pub subjects_count: usize,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

/// List Role Bindings
#[command]
pub async fn list_role_bindings(
    state: State<'_, AppState>,
    namespace: Option<String>,
) -> Result<Vec<RoleBindingInfo>, String> {
    tracing::info!("Listing role bindings in namespace: {:?}", namespace);
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let api: Api<RoleBinding> = match &namespace {
        Some(ns) if !ns.is_empty() => Api::namespaced(client.clone(), ns),
        _ => Api::all(client.clone()),
    };

    let list = api
        .list(&ListParams::default())
        .await
        .map_err(|e| format!("Failed to list RoleBindings: {}", e))?;

    let infos: Vec<RoleBindingInfo> = list
        .items
        .into_iter()
        .map(|rb| {
            let metadata = rb.metadata;
            let role_ref = rb.role_ref;

            let subjects: Vec<RoleBindingSubject> = rb
                .subjects
                .unwrap_or_default()
                .into_iter()
                .map(|s| RoleBindingSubject {
                    kind: s.kind,
                    name: s.name,
                    namespace: s.namespace,
                    api_group: s.api_group,
                })
                .collect();

            let subjects_count = subjects.len();

            RoleBindingInfo {
                name: metadata.name.unwrap_or_default(),
                namespace: metadata.namespace.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                role_kind: role_ref.kind,
                role_name: role_ref.name,
                subjects,
                subjects_count,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} role bindings", infos.len());
    Ok(infos)
}

/// Cluster Role information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterRoleInfo {
    pub name: String,
    pub uid: String,
    pub rules: Vec<PolicyRule>,
    pub rules_count: usize,
    pub aggregation_rule: Option<Vec<String>>,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

/// List Cluster Roles
#[command]
pub async fn list_cluster_roles(
    state: State<'_, AppState>,
) -> Result<Vec<ClusterRoleInfo>, String> {
    tracing::info!("Listing cluster roles");
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let api: Api<ClusterRole> = Api::all(client.clone());
    let list = api
        .list(&ListParams::default())
        .await
        .map_err(|e| format!("Failed to list ClusterRoles: {}", e))?;

    let infos: Vec<ClusterRoleInfo> = list
        .items
        .into_iter()
        .map(|cr| {
            let metadata = cr.metadata;

            let rules: Vec<PolicyRule> = cr
                .rules
                .unwrap_or_default()
                .into_iter()
                .map(|r| PolicyRule {
                    verbs: r.verbs,
                    api_groups: r.api_groups.unwrap_or_default(),
                    resources: r.resources.unwrap_or_default(),
                    resource_names: r.resource_names.unwrap_or_default(),
                    non_resource_urls: r.non_resource_urls.unwrap_or_default(),
                })
                .collect();

            let rules_count = rules.len();

            let aggregation_rule = cr.aggregation_rule.and_then(|ar| {
                ar.cluster_role_selectors.map(|selectors| {
                    selectors
                        .into_iter()
                        .filter_map(|s| {
                            s.match_labels.map(|ml| {
                                ml.into_iter()
                                    .map(|(k, v)| format!("{}={}", k, v))
                                    .collect::<Vec<_>>()
                                    .join(",")
                            })
                        })
                        .collect()
                })
            });

            ClusterRoleInfo {
                name: metadata.name.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                rules,
                rules_count,
                aggregation_rule,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} cluster roles", infos.len());
    Ok(infos)
}

/// Cluster Role Binding information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterRoleBindingInfo {
    pub name: String,
    pub uid: String,
    pub role_name: String,
    pub subjects: Vec<RoleBindingSubject>,
    pub subjects_count: usize,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

/// List Cluster Role Bindings
#[command]
pub async fn list_cluster_role_bindings(
    state: State<'_, AppState>,
) -> Result<Vec<ClusterRoleBindingInfo>, String> {
    tracing::info!("Listing cluster role bindings");
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let api: Api<ClusterRoleBinding> = Api::all(client.clone());
    let list = api
        .list(&ListParams::default())
        .await
        .map_err(|e| format!("Failed to list ClusterRoleBindings: {}", e))?;

    let infos: Vec<ClusterRoleBindingInfo> = list
        .items
        .into_iter()
        .map(|crb| {
            let metadata = crb.metadata;
            let role_ref = crb.role_ref;

            let subjects: Vec<RoleBindingSubject> = crb
                .subjects
                .unwrap_or_default()
                .into_iter()
                .map(|s| RoleBindingSubject {
                    kind: s.kind,
                    name: s.name,
                    namespace: s.namespace,
                    api_group: s.api_group,
                })
                .collect();

            let subjects_count = subjects.len();

            ClusterRoleBindingInfo {
                name: metadata.name.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                role_name: role_ref.name,
                subjects,
                subjects_count,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} cluster role bindings", infos.len());
    Ok(infos)
}

// =============================================================================
// Administration Resources
// =============================================================================

// CRD structs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CRDVersionInfo {
    pub name: String,
    pub served: bool,
    pub storage: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CRDInfo {
    pub name: String,
    pub uid: String,
    pub group: String,
    pub scope: String,
    pub kind: String,
    pub singular: String,
    pub plural: String,
    pub short_names: Vec<String>,
    pub versions: Vec<CRDVersionInfo>,
    pub stored_versions: Vec<String>,
    pub conditions_ready: bool,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

#[command]
pub async fn list_crds(state: State<'_, AppState>) -> Result<Vec<CRDInfo>, String> {
    tracing::info!("Listing CRDs");
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let api: Api<CustomResourceDefinition> = Api::all(client.clone());
    let list = api
        .list(&ListParams::default())
        .await
        .map_err(|e| format!("Failed to list CRDs: {}", e))?;

    let infos: Vec<CRDInfo> = list
        .items
        .into_iter()
        .map(|crd| {
            let metadata = crd.metadata;
            let spec = crd.spec;
            let status = crd.status;
            let names = spec.names;

            let versions: Vec<CRDVersionInfo> = spec
                .versions
                .into_iter()
                .map(|v| CRDVersionInfo {
                    name: v.name,
                    served: v.served,
                    storage: v.storage,
                })
                .collect();

            let stored_versions = status
                .as_ref()
                .and_then(|s| s.stored_versions.clone())
                .unwrap_or_default();

            let conditions_ready = status
                .and_then(|s| s.conditions)
                .map(|conds| {
                    conds
                        .iter()
                        .any(|c| c.type_ == "Established" && c.status == "True")
                })
                .unwrap_or(false);

            CRDInfo {
                name: metadata.name.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                group: spec.group,
                scope: spec.scope,
                kind: names.kind,
                singular: names.singular.unwrap_or_default(),
                plural: names.plural,
                short_names: names.short_names.unwrap_or_default(),
                versions,
                stored_versions,
                conditions_ready,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} CRDs", infos.len());
    Ok(infos)
}

// Priority Class structs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriorityClassInfo {
    pub name: String,
    pub uid: String,
    pub value: i32,
    pub global_default: bool,
    pub preemption_policy: String,
    pub description: Option<String>,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

#[command]
pub async fn list_priority_classes(
    state: State<'_, AppState>,
) -> Result<Vec<PriorityClassInfo>, String> {
    tracing::info!("Listing priority classes");
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let api: Api<PriorityClass> = Api::all(client.clone());
    let list = api
        .list(&ListParams::default())
        .await
        .map_err(|e| format!("Failed to list PriorityClasses: {}", e))?;

    let infos: Vec<PriorityClassInfo> = list
        .items
        .into_iter()
        .map(|pc| {
            let metadata = pc.metadata;

            PriorityClassInfo {
                name: metadata.name.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                value: pc.value,
                global_default: pc.global_default.unwrap_or(false),
                preemption_policy: pc
                    .preemption_policy
                    .unwrap_or_else(|| "PreemptLowerPriority".to_string()),
                description: pc.description,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} priority classes", infos.len());
    Ok(infos)
}

// Runtime Class structs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeClassInfo {
    pub name: String,
    pub uid: String,
    pub handler: String,
    pub scheduling_node_selector: Option<HashMap<String, String>>,
    pub scheduling_tolerations_count: usize,
    pub overhead_pod_fixed: Option<HashMap<String, String>>,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

#[command]
pub async fn list_runtime_classes(
    state: State<'_, AppState>,
) -> Result<Vec<RuntimeClassInfo>, String> {
    tracing::info!("Listing runtime classes");
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let api: Api<RuntimeClass> = Api::all(client.clone());
    let list = api
        .list(&ListParams::default())
        .await
        .map_err(|e| format!("Failed to list RuntimeClasses: {}", e))?;

    let infos: Vec<RuntimeClassInfo> = list
        .items
        .into_iter()
        .map(|rc| {
            let metadata = rc.metadata;

            let scheduling_node_selector = rc
                .scheduling
                .as_ref()
                .and_then(|s| s.node_selector.clone())
                .map(|ns| ns.into_iter().collect());

            let scheduling_tolerations_count = rc
                .scheduling
                .as_ref()
                .and_then(|s| s.tolerations.as_ref())
                .map(|t| t.len())
                .unwrap_or(0);

            let overhead_pod_fixed = rc
                .overhead
                .and_then(|o| o.pod_fixed)
                .map(|pf| pf.into_iter().map(|(k, v)| (k, v.0)).collect());

            RuntimeClassInfo {
                name: metadata.name.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                handler: rc.handler,
                scheduling_node_selector,
                scheduling_tolerations_count,
                overhead_pod_fixed,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} runtime classes", infos.len());
    Ok(infos)
}

// Webhook structs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookRuleInfo {
    pub api_groups: Vec<String>,
    pub api_versions: Vec<String>,
    pub operations: Vec<String>,
    pub resources: Vec<String>,
    pub scope: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MutatingWebhookDetail {
    pub name: String,
    pub client_config_service: Option<String>,
    pub client_config_url: Option<String>,
    pub failure_policy: String,
    pub match_policy: Option<String>,
    pub side_effects: String,
    pub timeout_seconds: Option<i32>,
    pub rules: Vec<WebhookRuleInfo>,
    pub admission_review_versions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MutatingWebhookInfo {
    pub name: String,
    pub uid: String,
    pub webhooks: Vec<MutatingWebhookDetail>,
    pub webhooks_count: usize,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

#[command]
pub async fn list_mutating_webhooks(
    state: State<'_, AppState>,
) -> Result<Vec<MutatingWebhookInfo>, String> {
    tracing::info!("Listing mutating webhook configurations");
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let api: Api<MutatingWebhookConfiguration> = Api::all(client.clone());
    let list = api
        .list(&ListParams::default())
        .await
        .map_err(|e| format!("Failed to list MutatingWebhookConfigurations: {}", e))?;

    let infos: Vec<MutatingWebhookInfo> = list
        .items
        .into_iter()
        .map(|mwc| {
            let metadata = mwc.metadata;

            let webhooks: Vec<MutatingWebhookDetail> = mwc
                .webhooks
                .unwrap_or_default()
                .into_iter()
                .map(|w| {
                    let client_config_service = w
                        .client_config
                        .service
                        .map(|s| format!("{}/{}", s.namespace, s.name));

                    let rules: Vec<WebhookRuleInfo> = w
                        .rules
                        .unwrap_or_default()
                        .into_iter()
                        .map(|r| WebhookRuleInfo {
                            api_groups: r.api_groups.unwrap_or_default(),
                            api_versions: r.api_versions.unwrap_or_default(),
                            operations: r.operations.unwrap_or_default(),
                            resources: r.resources.unwrap_or_default(),
                            scope: r.scope,
                        })
                        .collect();

                    MutatingWebhookDetail {
                        name: w.name,
                        client_config_service,
                        client_config_url: w.client_config.url,
                        failure_policy: w.failure_policy.unwrap_or_else(|| "Fail".to_string()),
                        match_policy: w.match_policy,
                        side_effects: w.side_effects,
                        timeout_seconds: w.timeout_seconds,
                        rules,
                        admission_review_versions: w.admission_review_versions,
                    }
                })
                .collect();

            let webhooks_count = webhooks.len();

            MutatingWebhookInfo {
                name: metadata.name.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                webhooks,
                webhooks_count,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} mutating webhook configurations", infos.len());
    Ok(infos)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidatingWebhookDetail {
    pub name: String,
    pub client_config_service: Option<String>,
    pub client_config_url: Option<String>,
    pub failure_policy: String,
    pub match_policy: Option<String>,
    pub side_effects: String,
    pub timeout_seconds: Option<i32>,
    pub rules: Vec<WebhookRuleInfo>,
    pub admission_review_versions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidatingWebhookInfo {
    pub name: String,
    pub uid: String,
    pub webhooks: Vec<ValidatingWebhookDetail>,
    pub webhooks_count: usize,
    pub created_at: Option<String>,
    pub labels: HashMap<String, String>,
}

#[command]
pub async fn list_validating_webhooks(
    state: State<'_, AppState>,
) -> Result<Vec<ValidatingWebhookInfo>, String> {
    tracing::info!("Listing validating webhook configurations");
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let api: Api<ValidatingWebhookConfiguration> = Api::all(client.clone());
    let list = api
        .list(&ListParams::default())
        .await
        .map_err(|e| format!("Failed to list ValidatingWebhookConfigurations: {}", e))?;

    let infos: Vec<ValidatingWebhookInfo> = list
        .items
        .into_iter()
        .map(|vwc| {
            let metadata = vwc.metadata;

            let webhooks: Vec<ValidatingWebhookDetail> = vwc
                .webhooks
                .unwrap_or_default()
                .into_iter()
                .map(|w| {
                    let client_config_service = w
                        .client_config
                        .service
                        .map(|s| format!("{}/{}", s.namespace, s.name));

                    let rules: Vec<WebhookRuleInfo> = w
                        .rules
                        .unwrap_or_default()
                        .into_iter()
                        .map(|r| WebhookRuleInfo {
                            api_groups: r.api_groups.unwrap_or_default(),
                            api_versions: r.api_versions.unwrap_or_default(),
                            operations: r.operations.unwrap_or_default(),
                            resources: r.resources.unwrap_or_default(),
                            scope: r.scope,
                        })
                        .collect();

                    ValidatingWebhookDetail {
                        name: w.name,
                        client_config_service,
                        client_config_url: w.client_config.url,
                        failure_policy: w.failure_policy.unwrap_or_else(|| "Fail".to_string()),
                        match_policy: w.match_policy,
                        side_effects: w.side_effects,
                        timeout_seconds: w.timeout_seconds,
                        rules,
                        admission_review_versions: w.admission_review_versions,
                    }
                })
                .collect();

            let webhooks_count = webhooks.len();

            ValidatingWebhookInfo {
                name: metadata.name.unwrap_or_default(),
                uid: metadata.uid.unwrap_or_default(),
                webhooks,
                webhooks_count,
                created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
                labels: btree_to_hashmap(metadata.labels),
            }
        })
        .collect();

    tracing::info!("Listed {} validating webhook configurations", infos.len());
    Ok(infos)
}
