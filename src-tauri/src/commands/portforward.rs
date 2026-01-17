use crate::k8s::AppState;
use k8s_openapi::api::core::v1::{Pod, Service};
use k8s_openapi::apimachinery::pkg::util::intstr::IntOrString;
use kube::api::Api;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{command, AppHandle, Emitter, State};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::RwLock;

/// Port forward session state
struct PortForwardSession {
    stop_flag: Arc<AtomicBool>,
    local_port: u16,
    target_port: u16,
    target_type: PortForwardTargetType,
    namespace: String,
    name: String,
    status: Arc<RwLock<PortForwardStatus>>,
}

/// Port forward target type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PortForwardTargetType {
    Pod,
    Service,
}

/// Port forward status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PortForwardStatus {
    Connecting,
    Connected,
    Disconnected,
    Error,
}

/// Port forward event types sent to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum PortForwardEvent {
    Started { forward_id: String, local_port: u16 },
    Connected { forward_id: String },
    Disconnected { forward_id: String },
    Error { forward_id: String, message: String },
    Stopped { forward_id: String },
}

/// Options for starting a port forward
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortForwardOptions {
    pub namespace: String,
    pub name: String,
    pub target_type: PortForwardTargetType,
    pub target_port: u16,
    pub local_port: Option<u16>,
}

/// Port forward info returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortForwardInfo {
    pub forward_id: String,
    pub namespace: String,
    pub name: String,
    pub target_type: PortForwardTargetType,
    pub target_port: u16,
    pub local_port: u16,
    pub status: PortForwardStatus,
}

/// Manager for active port forward sessions
pub struct PortForwardManager {
    sessions: RwLock<HashMap<String, PortForwardSession>>,
}

impl PortForwardManager {
    pub fn new() -> Self {
        Self {
            sessions: RwLock::new(HashMap::new()),
        }
    }

    async fn add_session(&self, id: String, session: PortForwardSession) {
        let mut sessions = self.sessions.write().await;
        sessions.insert(id, session);
    }

    async fn get_session_info(&self, id: &str) -> Option<PortForwardInfo> {
        let sessions = self.sessions.read().await;
        if let Some(s) = sessions.get(id) {
            let status = s.status.read().await.clone();
            Some(PortForwardInfo {
                forward_id: id.to_string(),
                namespace: s.namespace.clone(),
                name: s.name.clone(),
                target_type: s.target_type.clone(),
                target_port: s.target_port,
                local_port: s.local_port,
                status,
            })
        } else {
            None
        }
    }

    async fn stop_session(&self, id: &str) -> bool {
        let sessions = self.sessions.read().await;
        if let Some(session) = sessions.get(id) {
            session.stop_flag.store(true, Ordering::SeqCst);
            true
        } else {
            false
        }
    }

    async fn remove_session(&self, id: &str) {
        let mut sessions = self.sessions.write().await;
        sessions.remove(id);
    }

    async fn is_active(&self, id: &str) -> bool {
        let sessions = self.sessions.read().await;
        sessions.contains_key(id)
    }

    async fn list_sessions(&self) -> Vec<PortForwardInfo> {
        let sessions = self.sessions.read().await;
        let mut result = Vec::new();
        for (id, s) in sessions.iter() {
            let status = s.status.read().await.clone();
            result.push(PortForwardInfo {
                forward_id: id.clone(),
                namespace: s.namespace.clone(),
                name: s.name.clone(),
                target_type: s.target_type.clone(),
                target_port: s.target_port,
                local_port: s.local_port,
                status,
            });
        }
        result
    }

    async fn is_port_in_use(&self, port: u16) -> bool {
        let sessions = self.sessions.read().await;
        sessions.values().any(|s| s.local_port == port)
    }
}

impl Default for PortForwardManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Find an available random port in the high range (30000-60000)
async fn find_available_port() -> Result<u16, String> {
    // Generate random ports upfront to avoid Send issues with rng
    let random_ports: Vec<u16> = {
        let mut rng = rand::rng();
        (0..100).map(|_| rng.random_range(30000..60000)).collect()
    };

    // Try random ports first
    for port in random_ports {
        if let Ok(listener) = TcpListener::bind(format!("127.0.0.1:{}", port)).await {
            drop(listener);
            return Ok(port);
        }
    }

    // Fallback: try sequential from 30000
    for port in 30000..65535 {
        if let Ok(listener) = TcpListener::bind(format!("127.0.0.1:{}", port)).await {
            drop(listener);
            return Ok(port);
        }
    }

    Err("No available ports found".to_string())
}

/// Start a port forward session
#[command]
pub async fn portforward_start(
    app: AppHandle,
    state: State<'_, AppState>,
    pf_manager: State<'_, Arc<PortForwardManager>>,
    forward_id: String,
    options: PortForwardOptions,
) -> Result<PortForwardInfo, String> {
    if pf_manager.is_active(&forward_id).await {
        return Err(format!("Port forward {} already exists", forward_id));
    }

    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    // Determine local port
    let local_port = match options.local_port {
        Some(port) => {
            if pf_manager.is_port_in_use(port).await {
                return Err(format!("Port {} is already in use", port));
            }
            match TcpListener::bind(format!("127.0.0.1:{}", port)).await {
                Ok(listener) => {
                    drop(listener);
                    port
                }
                Err(_) => return Err(format!("Port {} is not available", port)),
            }
        }
        None => find_available_port().await?,
    };

    // Verify target exists and get pod + resolved target port
    let (pod_name, resolved_target_port) = match &options.target_type {
        PortForwardTargetType::Pod => {
            let pods: Api<Pod> = Api::namespaced(client.clone(), &options.namespace);
            pods.get(&options.name)
                .await
                .map_err(|e| format!("Failed to get pod: {}", e))?;
            (options.name.clone(), options.target_port)
        }
        PortForwardTargetType::Service => {
            let services: Api<Service> = Api::namespaced(client.clone(), &options.namespace);
            let svc = services
                .get(&options.name)
                .await
                .map_err(|e| format!("Failed to get service: {}", e))?;

            let selector = svc
                .spec
                .as_ref()
                .and_then(|s| s.selector.as_ref())
                .ok_or_else(|| "Service has no selector".to_string())?;

            let label_selector: String = selector
                .iter()
                .map(|(k, v)| format!("{}={}", k, v))
                .collect::<Vec<_>>()
                .join(",");

            let pods: Api<Pod> = Api::namespaced(client.clone(), &options.namespace);
            let pod_list = pods
                .list(&kube::api::ListParams::default().labels(&label_selector))
                .await
                .map_err(|e| format!("Failed to list pods: {}", e))?;

            let target_pod = pod_list
                .items
                .into_iter()
                .find(|p| {
                    p.status
                        .as_ref()
                        .and_then(|s| s.phase.as_ref())
                        .map(|phase| phase == "Running")
                        .unwrap_or(false)
                })
                .ok_or_else(|| "No running pods found for service".to_string())?;

            let pod_name = target_pod
                .metadata
                .name
                .clone()
                .ok_or_else(|| "Target pod has no name".to_string())?;

            let resolved_port = resolve_service_target_port(&svc, &target_pod, options.target_port)
                .unwrap_or(options.target_port);

            (pod_name, resolved_port)
        }
    };

    let stop_flag = Arc::new(AtomicBool::new(false));
    let status = Arc::new(RwLock::new(PortForwardStatus::Connecting));

    let session = PortForwardSession {
        stop_flag: stop_flag.clone(),
        local_port,
        target_port: resolved_target_port,
        target_type: options.target_type.clone(),
        namespace: options.namespace.clone(),
        name: options.name.clone(),
        status: status.clone(),
    };

    let info = PortForwardInfo {
        forward_id: forward_id.clone(),
        namespace: options.namespace.clone(),
        name: options.name.clone(),
        target_type: options.target_type.clone(),
        target_port: resolved_target_port,
        local_port,
        status: PortForwardStatus::Connecting,
    };

    pf_manager.add_session(forward_id.clone(), session).await;

    let event_name = format!("portforward-{}", forward_id);
    let forward_id_clone = forward_id.clone();
    let pf_manager_clone = Arc::clone(&pf_manager);
    let namespace = options.namespace.clone();
    let target_port = resolved_target_port;

    let _ = app.emit(
        &event_name,
        PortForwardEvent::Started {
            forward_id: forward_id.clone(),
            local_port,
        },
    );

    tokio::spawn(async move {
        run_port_forward(
            client,
            app.clone(),
            &event_name,
            &forward_id_clone,
            stop_flag,
            status,
            local_port,
            target_port,
            &namespace,
            &pod_name,
        )
        .await;

        pf_manager_clone.remove_session(&forward_id_clone).await;
        let _ = app.emit(
            &event_name,
            PortForwardEvent::Stopped {
                forward_id: forward_id_clone,
            },
        );
    });

    tracing::info!(
        "Started port forward {} (localhost:{} -> {}:{}/{})",
        forward_id,
        local_port,
        options.namespace,
        options.name,
        options.target_port
    );

    Ok(info)
}

/// Run the port forward session
#[allow(clippy::too_many_arguments)]
async fn run_port_forward(
    client: kube::Client,
    app: AppHandle,
    event_name: &str,
    forward_id: &str,
    stop_flag: Arc<AtomicBool>,
    status: Arc<RwLock<PortForwardStatus>>,
    local_port: u16,
    target_port: u16,
    namespace: &str,
    pod_name: &str,
) {
    let listener = match TcpListener::bind(format!("127.0.0.1:{}", local_port)).await {
        Ok(l) => l,
        Err(e) => {
            let _ = app.emit(
                event_name,
                PortForwardEvent::Error {
                    forward_id: forward_id.to_string(),
                    message: format!("Failed to bind to port {}: {}", local_port, e),
                },
            );
            *status.write().await = PortForwardStatus::Error;
            return;
        }
    };

    *status.write().await = PortForwardStatus::Connected;
    let _ = app.emit(
        event_name,
        PortForwardEvent::Connected {
            forward_id: forward_id.to_string(),
        },
    );

    tracing::info!(
        "Port forward {} listening on 127.0.0.1:{}",
        forward_id,
        local_port
    );

    let pods: Api<Pod> = Api::namespaced(client.clone(), namespace);
    let pod_name = pod_name.to_string();
    let forward_id = forward_id.to_string();

    loop {
        if stop_flag.load(Ordering::SeqCst) {
            tracing::info!("Port forward {} stopped by user", forward_id);
            break;
        }

        tokio::select! {
            _ = tokio::time::sleep(tokio::time::Duration::from_millis(100)) => {
                if stop_flag.load(Ordering::SeqCst) {
                    break;
                }
            }
            result = listener.accept() => {
                match result {
                    Ok((tcp_stream, addr)) => {
                        tracing::debug!("New connection from {} for forward {}", addr, forward_id);

                        let pods_clone = pods.clone();
                        let pod_name_clone = pod_name.clone();
                        let forward_id_clone = forward_id.clone();
                        let stop_flag_clone = stop_flag.clone();

                        tokio::spawn(async move {
                            handle_connection(
                                pods_clone,
                                &pod_name_clone,
                                target_port,
                                tcp_stream,
                                addr,
                                stop_flag_clone,
                                &forward_id_clone,
                            )
                            .await;
                        });
                    }
                    Err(e) => {
                        tracing::error!("Failed to accept connection: {}", e);
                    }
                }
            }
        }
    }

    *status.write().await = PortForwardStatus::Disconnected;
    let _ = app.emit(
        event_name,
        PortForwardEvent::Disconnected {
            forward_id: forward_id.to_string(),
        },
    );
}

/// Handle a single port forward connection
async fn handle_connection(
    pods: Api<Pod>,
    pod_name: &str,
    target_port: u16,
    mut tcp_stream: tokio::net::TcpStream,
    addr: SocketAddr,
    stop_flag: Arc<AtomicBool>,
    forward_id: &str,
) {
    let mut pf = match pods.portforward(pod_name, &[target_port]).await {
        Ok(pf) => pf,
        Err(e) => {
            tracing::error!(
                "Failed to create port forward to {}:{}: {}",
                pod_name,
                target_port,
                e
            );
            return;
        }
    };

    let upstream = match pf.take_stream(target_port) {
        Some(s) => s,
        None => {
            tracing::error!("Failed to get upstream stream for port {}", target_port);
            return;
        }
    };

    let (mut tcp_read, mut tcp_write) = tcp_stream.split();
    let (mut upstream_read, mut upstream_write) = tokio::io::split(upstream);

    let forward_id_clone = forward_id.to_string();
    let stop_flag_clone = stop_flag.clone();

    let tcp_to_upstream = async {
        let mut buf = vec![0u8; 8192];
        loop {
            if stop_flag_clone.load(Ordering::SeqCst) {
                break;
            }
            match tcp_read.read(&mut buf).await {
                Ok(0) => break,
                Ok(n) => {
                    if upstream_write.write_all(&buf[..n]).await.is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    };

    let upstream_to_tcp = async {
        let mut buf = vec![0u8; 8192];
        loop {
            if stop_flag.load(Ordering::SeqCst) {
                break;
            }
            match upstream_read.read(&mut buf).await {
                Ok(0) => break,
                Ok(n) => {
                    if tcp_write.write_all(&buf[..n]).await.is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    };

    tokio::select! {
        _ = tcp_to_upstream => {}
        _ = upstream_to_tcp => {}
    }

    tracing::debug!(
        "Connection from {} closed for forward {}",
        addr,
        forward_id_clone
    );
}

fn resolve_service_target_port(
    service: &Service,
    pod: &Pod,
    requested_service_port: u16,
) -> Option<u16> {
    let ports = service.spec.as_ref()?.ports.as_ref()?;
    let service_port = ports
        .iter()
        .find(|p| p.port == requested_service_port as i32)
        .or_else(|| ports.first())?;

    match service_port.target_port.as_ref() {
        Some(IntOrString::Int(i)) => Some((*i).max(0) as u16),
        Some(IntOrString::String(name)) => {
            if name.is_empty() {
                None
            } else if let Ok(val) = name.parse::<u16>() {
                Some(val)
            } else {
                find_named_container_port(pod, name)
            }
        }
        None => Some(service_port.port as u16),
    }
}

fn find_named_container_port(pod: &Pod, name: &str) -> Option<u16> {
    pod.spec.as_ref()?.containers.iter().find_map(|container| {
        container.ports.as_ref()?.iter().find_map(|port| {
            if port.name.as_deref() == Some(name) {
                Some(port.container_port as u16)
            } else {
                None
            }
        })
    })
}

/// Stop a port forward session
#[command]
pub async fn portforward_stop(
    app: AppHandle,
    pf_manager: State<'_, Arc<PortForwardManager>>,
    forward_id: String,
) -> Result<(), String> {
    let event_name = format!("portforward-{}", forward_id);

    if pf_manager.stop_session(&forward_id).await {
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        pf_manager.remove_session(&forward_id).await;

        let _ = app.emit(
            &event_name,
            PortForwardEvent::Stopped {
                forward_id: forward_id.clone(),
            },
        );

        tracing::info!("Stopped port forward {}", forward_id);
        Ok(())
    } else {
        Err(format!("Port forward {} not found", forward_id))
    }
}

/// List active port forward sessions
#[command]
pub async fn portforward_list(
    pf_manager: State<'_, Arc<PortForwardManager>>,
) -> Result<Vec<PortForwardInfo>, String> {
    Ok(pf_manager.list_sessions().await)
}

/// Get info about a specific port forward
#[command]
pub async fn portforward_get(
    pf_manager: State<'_, Arc<PortForwardManager>>,
    forward_id: String,
) -> Result<Option<PortForwardInfo>, String> {
    Ok(pf_manager.get_session_info(&forward_id).await)
}

/// Check if a port is available
#[command]
pub async fn portforward_check_port(
    pf_manager: State<'_, Arc<PortForwardManager>>,
    port: u16,
) -> Result<bool, String> {
    if pf_manager.is_port_in_use(port).await {
        return Ok(false);
    }

    match TcpListener::bind(format!("127.0.0.1:{}", port)).await {
        Ok(listener) => {
            drop(listener);
            Ok(true)
        }
        Err(_) => Ok(false),
    }
}
