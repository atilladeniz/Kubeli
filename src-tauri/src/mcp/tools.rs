//! MCP Tools for Kubernetes Operations
//!
//! Exposes Kubernetes operations as MCP tools that IDEs can invoke.

use k8s_openapi::api::apps::v1::Deployment;
use k8s_openapi::api::core::v1::{Event, Namespace, Pod, Service};
use kube::api::{Api, ListParams, LogParams};
use kube::ResourceExt;
use rmcp::model::{
    CallToolRequestParam, CallToolResult, Content, Implementation, InitializeRequestParam,
    InitializeResult, ListToolsResult, PaginatedRequestParam, ProtocolVersion, ServerCapabilities,
    ServerInfo, Tool, ToolsCapability,
};
use rmcp::service::RequestContext;
use rmcp::{ErrorData as McpError, RoleServer, ServerHandler};
use serde::Serialize;
use serde_json::json;
use std::sync::Arc;

use super::server::McpServerState;

/// Response types
#[derive(Debug, Serialize)]
struct PodSummary {
    name: String,
    namespace: String,
    phase: String,
    node: Option<String>,
    ready: String,
    restarts: i32,
    age: String,
}

#[derive(Debug, Serialize)]
struct DeploymentSummary {
    name: String,
    namespace: String,
    ready: String,
    up_to_date: i32,
    available: i32,
    age: String,
}

#[derive(Debug, Serialize)]
struct ServiceSummary {
    name: String,
    namespace: String,
    service_type: String,
    cluster_ip: Option<String>,
    ports: Vec<String>,
    age: String,
}

#[derive(Debug, Serialize)]
struct EventSummary {
    namespace: String,
    name: String,
    kind: String,
    reason: Option<String>,
    message: Option<String>,
    count: Option<i32>,
    last_seen: Option<String>,
}

/// Kubeli MCP Server with Kubernetes tools
#[derive(Clone)]
pub struct KubeliMcpServer {
    state: Arc<McpServerState>,
}

impl KubeliMcpServer {
    pub fn new(state: Arc<McpServerState>) -> Self {
        Self { state }
    }

    async fn get_client(&self) -> Result<kube::Client, String> {
        let guard = self.state.kube_client.read().await;
        guard
            .as_ref()
            .cloned()
            .ok_or_else(|| "Not connected to a Kubernetes cluster".to_string())
    }

    fn format_age(created: Option<k8s_openapi::jiff::Timestamp>) -> String {
        match created {
            Some(time) => {
                let now = k8s_openapi::jiff::Timestamp::now();
                let duration_secs = now.as_second() - time.as_second();
                let days = duration_secs / 86400;
                let hours = duration_secs / 3600;
                let minutes = duration_secs / 60;
                if days > 0 {
                    format!("{}d", days)
                } else if hours > 0 {
                    format!("{}h", hours)
                } else if minutes > 0 {
                    format!("{}m", minutes)
                } else {
                    format!("{}s", duration_secs)
                }
            }
            None => "Unknown".to_string(),
        }
    }

    fn get_tools() -> Vec<Tool> {
        vec![
            Tool {
                name: "get_pods".into(),
                title: Some("Get Pods".into()),
                description: Some("List Kubernetes pods. Optionally filter by namespace.".into()),
                input_schema: json!({
                    "type": "object",
                    "properties": {
                        "namespace": {
                            "type": "string",
                            "description": "Namespace to filter pods. If not provided, lists from all namespaces."
                        }
                    }
                })
                .as_object()
                .cloned()
                .unwrap()
                .into(),
                output_schema: None,
                annotations: None,
                icons: None,
                meta: None,
            },
            Tool {
                name: "get_deployments".into(),
                title: Some("Get Deployments".into()),
                description: Some(
                    "List Kubernetes deployments. Optionally filter by namespace.".into(),
                ),
                input_schema: json!({
                    "type": "object",
                    "properties": {
                        "namespace": {
                            "type": "string",
                            "description": "Namespace to filter deployments."
                        }
                    }
                })
                .as_object()
                .cloned()
                .unwrap()
                .into(),
                output_schema: None,
                annotations: None,
                icons: None,
                meta: None,
            },
            Tool {
                name: "get_services".into(),
                title: Some("Get Services".into()),
                description: Some(
                    "List Kubernetes services. Optionally filter by namespace.".into(),
                ),
                input_schema: json!({
                    "type": "object",
                    "properties": {
                        "namespace": {
                            "type": "string",
                            "description": "Namespace to filter services."
                        }
                    }
                })
                .as_object()
                .cloned()
                .unwrap()
                .into(),
                output_schema: None,
                annotations: None,
                icons: None,
                meta: None,
            },
            Tool {
                name: "get_logs".into(),
                title: Some("Get Pod Logs".into()),
                description: Some("Get logs from a Kubernetes pod.".into()),
                input_schema: json!({
                    "type": "object",
                    "properties": {
                        "namespace": {
                            "type": "string",
                            "description": "Namespace of the pod."
                        },
                        "pod_name": {
                            "type": "string",
                            "description": "Name of the pod."
                        },
                        "container": {
                            "type": "string",
                            "description": "Container name (optional, for multi-container pods)."
                        },
                        "tail_lines": {
                            "type": "integer",
                            "description": "Number of lines to return from the end of the logs."
                        }
                    },
                    "required": ["namespace", "pod_name"]
                })
                .as_object()
                .cloned()
                .unwrap()
                .into(),
                output_schema: None,
                annotations: None,
                icons: None,
                meta: None,
            },
            Tool {
                name: "get_namespaces".into(),
                title: Some("Get Namespaces".into()),
                description: Some("List all Kubernetes namespaces.".into()),
                input_schema: json!({
                    "type": "object",
                    "properties": {}
                })
                .as_object()
                .cloned()
                .unwrap()
                .into(),
                output_schema: None,
                annotations: None,
                icons: None,
                meta: None,
            },
            Tool {
                name: "get_cluster_info".into(),
                title: Some("Get Cluster Info".into()),
                description: Some(
                    "Get information about the connected Kubernetes cluster.".into(),
                ),
                input_schema: json!({
                    "type": "object",
                    "properties": {}
                })
                .as_object()
                .cloned()
                .unwrap()
                .into(),
                output_schema: None,
                annotations: None,
                icons: None,
                meta: None,
            },
            Tool {
                name: "get_events".into(),
                title: Some("Get Events".into()),
                description: Some("List Kubernetes events. Optionally filter by namespace.".into()),
                input_schema: json!({
                    "type": "object",
                    "properties": {
                        "namespace": {
                            "type": "string",
                            "description": "Namespace to filter events."
                        }
                    }
                })
                .as_object()
                .cloned()
                .unwrap()
                .into(),
                output_schema: None,
                annotations: None,
                icons: None,
                meta: None,
            },
            Tool {
                name: "get_yaml".into(),
                title: Some("Get Resource YAML".into()),
                description: Some(
                    "Get the YAML representation of a Kubernetes resource.".into(),
                ),
                input_schema: json!({
                    "type": "object",
                    "properties": {
                        "kind": {
                            "type": "string",
                            "description": "Resource kind (e.g., pod, deployment, service)."
                        },
                        "name": {
                            "type": "string",
                            "description": "Name of the resource."
                        },
                        "namespace": {
                            "type": "string",
                            "description": "Namespace of the resource (for namespaced resources)."
                        }
                    },
                    "required": ["kind", "name"]
                })
                .as_object()
                .cloned()
                .unwrap()
                .into(),
                output_schema: None,
                annotations: None,
                icons: None,
                meta: None,
            },
        ]
    }

    // Tool implementations
    async fn get_pods(&self, namespace: Option<String>) -> Result<String, String> {
        let client = self.get_client().await?;

        let pods: Vec<Pod> = if let Some(ns) = &namespace {
            let api: Api<Pod> = Api::namespaced(client, ns);
            api.list(&ListParams::default())
                .await
                .map_err(|e| format!("Failed to list pods: {}", e))?
                .items
        } else {
            let api: Api<Pod> = Api::all(client);
            api.list(&ListParams::default())
                .await
                .map_err(|e| format!("Failed to list pods: {}", e))?
                .items
        };

        let summaries: Vec<PodSummary> = pods
            .iter()
            .map(|pod| {
                let status = pod.status.as_ref();
                let phase = status
                    .and_then(|s| s.phase.clone())
                    .unwrap_or_else(|| "Unknown".to_string());

                let container_statuses = status.and_then(|s| s.container_statuses.as_ref());
                let ready_count = container_statuses
                    .map(|cs| cs.iter().filter(|c| c.ready).count())
                    .unwrap_or(0);
                let total_count = container_statuses.map(|cs| cs.len()).unwrap_or(0);
                let restarts: i32 = container_statuses
                    .map(|cs| cs.iter().map(|c| c.restart_count).sum())
                    .unwrap_or(0);

                PodSummary {
                    name: pod.name_any(),
                    namespace: pod.namespace().unwrap_or_default(),
                    phase,
                    node: pod.spec.as_ref().and_then(|s| s.node_name.clone()),
                    ready: format!("{}/{}", ready_count, total_count),
                    restarts,
                    age: Self::format_age(pod.creation_timestamp().map(|t| t.0)),
                }
            })
            .collect();

        serde_json::to_string_pretty(&summaries).map_err(|e| format!("Serialization error: {}", e))
    }

    async fn get_deployments(&self, namespace: Option<String>) -> Result<String, String> {
        let client = self.get_client().await?;

        let deployments: Vec<Deployment> = if let Some(ns) = &namespace {
            let api: Api<Deployment> = Api::namespaced(client, ns);
            api.list(&ListParams::default())
                .await
                .map_err(|e| format!("Failed to list deployments: {}", e))?
                .items
        } else {
            let api: Api<Deployment> = Api::all(client);
            api.list(&ListParams::default())
                .await
                .map_err(|e| format!("Failed to list deployments: {}", e))?
                .items
        };

        let summaries: Vec<DeploymentSummary> = deployments
            .iter()
            .map(|d| {
                let status = d.status.as_ref();
                let replicas = status.and_then(|s| s.replicas).unwrap_or(0);
                let ready = status.and_then(|s| s.ready_replicas).unwrap_or(0);
                let updated = status.and_then(|s| s.updated_replicas).unwrap_or(0);
                let available = status.and_then(|s| s.available_replicas).unwrap_or(0);

                DeploymentSummary {
                    name: d.name_any(),
                    namespace: d.namespace().unwrap_or_default(),
                    ready: format!("{}/{}", ready, replicas),
                    up_to_date: updated,
                    available,
                    age: Self::format_age(d.creation_timestamp().map(|t| t.0)),
                }
            })
            .collect();

        serde_json::to_string_pretty(&summaries).map_err(|e| format!("Serialization error: {}", e))
    }

    async fn get_services(&self, namespace: Option<String>) -> Result<String, String> {
        let client = self.get_client().await?;

        let services: Vec<Service> = if let Some(ns) = &namespace {
            let api: Api<Service> = Api::namespaced(client, ns);
            api.list(&ListParams::default())
                .await
                .map_err(|e| format!("Failed to list services: {}", e))?
                .items
        } else {
            let api: Api<Service> = Api::all(client);
            api.list(&ListParams::default())
                .await
                .map_err(|e| format!("Failed to list services: {}", e))?
                .items
        };

        let summaries: Vec<ServiceSummary> = services
            .iter()
            .map(|svc| {
                let spec = svc.spec.as_ref();
                let ports: Vec<String> = spec
                    .and_then(|s| s.ports.as_ref())
                    .map(|ports| {
                        ports
                            .iter()
                            .map(|p| {
                                let target_port = p
                                    .target_port
                                    .as_ref()
                                    .map(|tp| match tp {
                                        k8s_openapi::apimachinery::pkg::util::intstr::IntOrString::Int(i) => i.to_string(),
                                        k8s_openapi::apimachinery::pkg::util::intstr::IntOrString::String(s) => s.clone(),
                                    })
                                    .unwrap_or_default();
                                format!(
                                    "{}:{}/{}",
                                    p.port,
                                    target_port,
                                    p.protocol.as_deref().unwrap_or("TCP")
                                )
                            })
                            .collect()
                    })
                    .unwrap_or_default();

                ServiceSummary {
                    name: svc.name_any(),
                    namespace: svc.namespace().unwrap_or_default(),
                    service_type: spec
                        .and_then(|s| s.type_.clone())
                        .unwrap_or_else(|| "ClusterIP".to_string()),
                    cluster_ip: spec.and_then(|s| s.cluster_ip.clone()),
                    ports,
                    age: Self::format_age(svc.creation_timestamp().map(|t| t.0)),
                }
            })
            .collect();

        serde_json::to_string_pretty(&summaries).map_err(|e| format!("Serialization error: {}", e))
    }

    async fn get_logs(
        &self,
        namespace: &str,
        pod_name: &str,
        container: Option<String>,
        tail_lines: Option<i64>,
    ) -> Result<String, String> {
        let client = self.get_client().await?;
        let api: Api<Pod> = Api::namespaced(client, namespace);

        let mut log_params = LogParams::default();
        if let Some(c) = container {
            log_params.container = Some(c);
        }
        if let Some(tail) = tail_lines {
            log_params.tail_lines = Some(tail);
        }

        api.logs(pod_name, &log_params)
            .await
            .map_err(|e| format!("Failed to get logs: {}", e))
    }

    async fn get_namespaces(&self) -> Result<String, String> {
        let client = self.get_client().await?;
        let api: Api<Namespace> = Api::all(client);

        let namespaces = api
            .list(&ListParams::default())
            .await
            .map_err(|e| format!("Failed to list namespaces: {}", e))?;

        let names: Vec<String> = namespaces.items.iter().map(|ns| ns.name_any()).collect();

        serde_json::to_string_pretty(&names).map_err(|e| format!("Serialization error: {}", e))
    }

    async fn get_cluster_info(&self) -> Result<String, String> {
        let client = self.get_client().await?;

        let version = client
            .apiserver_version()
            .await
            .map_err(|e| format!("Failed to get cluster version: {}", e))?;

        let nodes: Api<k8s_openapi::api::core::v1::Node> = Api::all(client.clone());
        let node_list = nodes
            .list(&ListParams::default())
            .await
            .map_err(|e| format!("Failed to list nodes: {}", e))?;

        let namespaces: Api<Namespace> = Api::all(client);
        let ns_list = namespaces
            .list(&ListParams::default())
            .await
            .map_err(|e| format!("Failed to list namespaces: {}", e))?;

        let info = json!({
            "version": format!("{}.{}", version.major, version.minor),
            "platform": version.platform,
            "git_version": version.git_version,
            "node_count": node_list.items.len(),
            "namespace_count": ns_list.items.len()
        });

        serde_json::to_string_pretty(&info).map_err(|e| format!("Serialization error: {}", e))
    }

    async fn get_events(&self, namespace: Option<String>) -> Result<String, String> {
        let client = self.get_client().await?;

        let events: Vec<Event> = if let Some(ns) = &namespace {
            let api: Api<Event> = Api::namespaced(client, ns);
            api.list(&ListParams::default())
                .await
                .map_err(|e| format!("Failed to list events: {}", e))?
                .items
        } else {
            let api: Api<Event> = Api::all(client);
            api.list(&ListParams::default())
                .await
                .map_err(|e| format!("Failed to list events: {}", e))?
                .items
        };

        let summaries: Vec<EventSummary> = events
            .iter()
            .map(|e| EventSummary {
                namespace: e.namespace().unwrap_or_default(),
                name: e.name_any(),
                kind: e
                    .involved_object
                    .kind
                    .clone()
                    .unwrap_or_else(|| "Unknown".to_string()),
                reason: e.reason.clone(),
                message: e.message.clone(),
                count: e.count,
                last_seen: e.last_timestamp.as_ref().map(|t| t.0.to_string()),
            })
            .collect();

        serde_json::to_string_pretty(&summaries).map_err(|e| format!("Serialization error: {}", e))
    }

    async fn get_yaml(
        &self,
        kind: &str,
        name: &str,
        namespace: Option<String>,
    ) -> Result<String, String> {
        let client = self.get_client().await?;
        let kind_lower = kind.to_lowercase();

        match kind_lower.as_str() {
            "pod" | "pods" => {
                let ns = namespace.as_deref().unwrap_or("default");
                let api: Api<Pod> = Api::namespaced(client, ns);
                let resource = api
                    .get(name)
                    .await
                    .map_err(|e| format!("Failed to get pod: {}", e))?;
                serde_yaml::to_string(&resource)
                    .map_err(|e| format!("Failed to serialize to YAML: {}", e))
            }
            "deployment" | "deployments" => {
                let ns = namespace.as_deref().unwrap_or("default");
                let api: Api<Deployment> = Api::namespaced(client, ns);
                let resource = api
                    .get(name)
                    .await
                    .map_err(|e| format!("Failed to get deployment: {}", e))?;
                serde_yaml::to_string(&resource)
                    .map_err(|e| format!("Failed to serialize to YAML: {}", e))
            }
            "service" | "services" => {
                let ns = namespace.as_deref().unwrap_or("default");
                let api: Api<Service> = Api::namespaced(client, ns);
                let resource = api
                    .get(name)
                    .await
                    .map_err(|e| format!("Failed to get service: {}", e))?;
                serde_yaml::to_string(&resource)
                    .map_err(|e| format!("Failed to serialize to YAML: {}", e))
            }
            "namespace" | "namespaces" => {
                let api: Api<Namespace> = Api::all(client);
                let resource = api
                    .get(name)
                    .await
                    .map_err(|e| format!("Failed to get namespace: {}", e))?;
                serde_yaml::to_string(&resource)
                    .map_err(|e| format!("Failed to serialize to YAML: {}", e))
            }
            _ => Err(format!(
                "Unsupported resource kind: {}. Supported: pod, deployment, service, namespace",
                kind
            )),
        }
    }
}

impl ServerHandler for KubeliMcpServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            protocol_version: ProtocolVersion::LATEST,
            capabilities: ServerCapabilities {
                tools: Some(ToolsCapability {
                    list_changed: Some(false),
                }),
                ..Default::default()
            },
            server_info: Implementation {
                name: "kubeli".into(),
                version: env!("CARGO_PKG_VERSION").into(),
                title: Some("Kubeli Kubernetes MCP Server".into()),
                icons: None,
                website_url: None,
            },
            instructions: Some("Kubeli MCP Server for Kubernetes management. Use the available tools to interact with your Kubernetes cluster.".into()),
        }
    }

    async fn initialize(
        &self,
        _request: InitializeRequestParam,
        _context: RequestContext<RoleServer>,
    ) -> Result<InitializeResult, McpError> {
        Ok(self.get_info())
    }

    async fn list_tools(
        &self,
        _request: Option<PaginatedRequestParam>,
        _context: RequestContext<RoleServer>,
    ) -> Result<ListToolsResult, McpError> {
        Ok(ListToolsResult {
            tools: Self::get_tools(),
            next_cursor: None,
            meta: None,
        })
    }

    async fn call_tool(
        &self,
        request: CallToolRequestParam,
        _context: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, McpError> {
        let name: &str = &request.name;
        let args = &request.arguments;

        let result = match name {
            "get_pods" => {
                let namespace = args
                    .as_ref()
                    .and_then(|a| a.get("namespace"))
                    .and_then(|v| v.as_str())
                    .map(String::from);
                self.get_pods(namespace).await
            }
            "get_deployments" => {
                let namespace = args
                    .as_ref()
                    .and_then(|a| a.get("namespace"))
                    .and_then(|v| v.as_str())
                    .map(String::from);
                self.get_deployments(namespace).await
            }
            "get_services" => {
                let namespace = args
                    .as_ref()
                    .and_then(|a| a.get("namespace"))
                    .and_then(|v| v.as_str())
                    .map(String::from);
                self.get_services(namespace).await
            }
            "get_logs" => {
                let namespace = args
                    .as_ref()
                    .and_then(|a| a.get("namespace"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("default");
                let pod_name = args
                    .as_ref()
                    .and_then(|a| a.get("pod_name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let container = args
                    .as_ref()
                    .and_then(|a| a.get("container"))
                    .and_then(|v| v.as_str())
                    .map(String::from);
                let tail_lines = args
                    .as_ref()
                    .and_then(|a| a.get("tail_lines"))
                    .and_then(|v| v.as_i64());
                self.get_logs(namespace, pod_name, container, tail_lines)
                    .await
            }
            "get_namespaces" => self.get_namespaces().await,
            "get_cluster_info" => self.get_cluster_info().await,
            "get_events" => {
                let namespace = args
                    .as_ref()
                    .and_then(|a| a.get("namespace"))
                    .and_then(|v| v.as_str())
                    .map(String::from);
                self.get_events(namespace).await
            }
            "get_yaml" => {
                let kind = args
                    .as_ref()
                    .and_then(|a| a.get("kind"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("pod");
                let resource_name = args
                    .as_ref()
                    .and_then(|a| a.get("name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let namespace = args
                    .as_ref()
                    .and_then(|a| a.get("namespace"))
                    .and_then(|v| v.as_str())
                    .map(String::from);
                self.get_yaml(kind, resource_name, namespace).await
            }
            _ => Err(format!("Unknown tool: {}", name)),
        };

        match result {
            Ok(text) => Ok(CallToolResult {
                content: vec![Content::text(text)],
                is_error: Some(false),
                meta: None,
                structured_content: None,
            }),
            Err(e) => Ok(CallToolResult {
                content: vec![Content::text(format!("Error: {}", e))],
                is_error: Some(true),
                meta: None,
                structured_content: None,
            }),
        }
    }
}
