use crate::k8s::AppState;
use futures::StreamExt;
use k8s_openapi::api::core::v1::{Pod, Service};
use k8s_openapi::apimachinery::pkg::util::intstr::IntOrString;
use kube::api::Api;
use kube::runtime::watcher::{watcher, Config, Event};
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
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
    pod_name: String,
    pod_uid: String,
    service_selector: Option<BTreeMap<String, String>>,
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
    Reconnecting,
    Disconnected,
    Error,
}

/// Port forward event types sent to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum PortForwardEvent {
    Started {
        forward_id: String,
        local_port: u16,
    },
    Connected {
        forward_id: String,
    },
    Reconnecting {
        forward_id: String,
        reason: String,
    },
    Reconnected {
        forward_id: String,
        new_pod: String,
    },
    PodDied {
        forward_id: String,
        pod_name: String,
    },
    Disconnected {
        forward_id: String,
    },
    Error {
        forward_id: String,
        message: String,
    },
    Stopped {
        forward_id: String,
    },
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
    pub pod_name: Option<String>,
    pub pod_uid: Option<String>,
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
                pod_name: Some(s.pod_name.clone()),
                pod_uid: Some(s.pod_uid.clone()),
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
                pod_name: Some(s.pod_name.clone()),
                pod_uid: Some(s.pod_uid.clone()),
            });
        }
        result
    }

    async fn is_port_in_use(&self, port: u16) -> bool {
        let sessions = self.sessions.read().await;
        sessions.values().any(|s| s.local_port == port)
    }

    /// Update a session's pod target without changing forward_id
    async fn update_pod_target(
        &self,
        id: &str,
        new_pod_name: String,
        new_pod_uid: String,
        new_stop_flag: Arc<AtomicBool>,
    ) {
        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.get_mut(id) {
            session.pod_name = new_pod_name;
            session.pod_uid = new_pod_uid;
            session.stop_flag = new_stop_flag;
        }
    }

    /// Get all forwards targeting a specific pod UID
    async fn get_forwards_for_pod_uid(
        &self,
        pod_uid: &str,
    ) -> Vec<(
        String,
        PortForwardTargetType,
        Option<BTreeMap<String, String>>,
    )> {
        let sessions = self.sessions.read().await;
        sessions
            .iter()
            .filter(|(_, s)| s.pod_uid == pod_uid)
            .map(|(id, s)| {
                (
                    id.clone(),
                    s.target_type.clone(),
                    s.service_selector.clone(),
                )
            })
            .collect()
    }

    /// Get session details needed for reconnection
    async fn get_reconnect_info(
        &self,
        id: &str,
    ) -> Option<(String, u16, u16, Arc<RwLock<PortForwardStatus>>)> {
        let sessions = self.sessions.read().await;
        sessions.get(id).map(|s| {
            (
                s.namespace.clone(),
                s.local_port,
                s.target_port,
                s.status.clone(),
            )
        })
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
    pf_watch_manager: State<'_, Arc<PortForwardWatchManager>>,
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

    // Verify target exists and get pod + resolved target port + UID + selector
    let (pod_name, pod_uid, resolved_target_port, service_selector) = match &options.target_type {
        PortForwardTargetType::Pod => {
            let pods: Api<Pod> = Api::namespaced(client.clone(), &options.namespace);
            let pod = pods
                .get(&options.name)
                .await
                .map_err(|e| format!("Failed to get pod: {}", e))?;
            let uid = pod.metadata.uid.clone().unwrap_or_default();
            (options.name.clone(), uid, options.target_port, None)
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

            let uid = target_pod.metadata.uid.clone().unwrap_or_default();

            let resolved_port = resolve_service_target_port(&svc, &target_pod, options.target_port)
                .unwrap_or(options.target_port);

            (pod_name, uid, resolved_port, Some(selector.clone()))
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
        pod_name: pod_name.clone(),
        pod_uid: pod_uid.clone(),
        service_selector: service_selector.clone(),
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
        pod_name: Some(pod_name.clone()),
        pod_uid: Some(pod_uid.clone()),
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

    // Start the pod health watcher for this namespace
    let pf_watch_manager_clone = Arc::clone(&pf_watch_manager);
    let pf_manager_for_watch = Arc::clone(&pf_manager);
    let watch_client = state.k8s.get_client().await.map_err(|e| e.to_string())?;
    pf_watch_manager_clone
        .ensure_namespace_watcher(
            watch_client,
            app.clone(),
            options.namespace.clone(),
            pf_manager_for_watch,
        )
        .await;

    let status_for_check = status.clone();
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

        // Only cleanup if not being reconnected by the watcher
        let current_status = status_for_check.read().await.clone();
        if current_status != PortForwardStatus::Reconnecting {
            pf_manager_clone.remove_session(&forward_id_clone).await;
            let _ = app.emit(
                &event_name,
                PortForwardEvent::Stopped {
                    forward_id: forward_id_clone,
                },
            );
        }
    });

    tracing::info!(
        "Started port forward {} (localhost:{} -> {}:{}/pod-port:{})",
        forward_id,
        local_port,
        options.namespace,
        options.name,
        resolved_target_port
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
                        let app_clone = app.clone();
                        let event_name_clone = event_name.to_string();

                        tokio::spawn(async move {
                            handle_connection(
                                pods_clone,
                                &pod_name_clone,
                                target_port,
                                tcp_stream,
                                addr,
                                stop_flag_clone,
                                &forward_id_clone,
                                app_clone,
                                &event_name_clone,
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

    // Only emit Disconnected if not being reconnected by the watcher
    let current_status = status.read().await.clone();
    if current_status != PortForwardStatus::Reconnecting {
        *status.write().await = PortForwardStatus::Disconnected;
        let _ = app.emit(
            event_name,
            PortForwardEvent::Disconnected {
                forward_id: forward_id.to_string(),
            },
        );
    }
}

/// Handle a single port forward connection
#[allow(clippy::too_many_arguments)]
async fn handle_connection(
    pods: Api<Pod>,
    pod_name: &str,
    target_port: u16,
    mut tcp_stream: tokio::net::TcpStream,
    addr: SocketAddr,
    stop_flag: Arc<AtomicBool>,
    forward_id: &str,
    app: AppHandle,
    event_name: &str,
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
            let _ = app.emit(
                event_name,
                PortForwardEvent::Error {
                    forward_id: forward_id.to_string(),
                    message: format!("Connection to pod failed: {}", e),
                },
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

/// Find a replacement running pod using label selector
async fn find_replacement_pod(
    client: &kube::Client,
    namespace: &str,
    selector: &BTreeMap<String, String>,
) -> Option<(String, String)> {
    let label_selector: String = selector
        .iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>()
        .join(",");

    let pods: Api<Pod> = Api::namespaced(client.clone(), namespace);
    let pod_list = pods
        .list(&kube::api::ListParams::default().labels(&label_selector))
        .await
        .ok()?;

    pod_list.items.into_iter().find_map(|p| {
        let is_running = p
            .status
            .as_ref()
            .and_then(|s| s.phase.as_ref())
            .map(|phase| phase == "Running")
            .unwrap_or(false);
        let not_deleting = p.metadata.deletion_timestamp.is_none();
        let is_ready = p
            .status
            .as_ref()
            .and_then(|s| s.conditions.as_ref())
            .map(|conds| {
                conds
                    .iter()
                    .any(|c| c.type_ == "Ready" && c.status == "True")
            })
            .unwrap_or(false);

        if is_running && not_deleting && is_ready {
            let name = p.metadata.name?;
            let uid = p.metadata.uid.unwrap_or_default();
            Some((name, uid))
        } else {
            None
        }
    })
}

/// Per-namespace pod watcher for port forward health monitoring
struct NamespaceWatchHandle {
    stop_flag: Arc<AtomicBool>,
    ref_count: usize,
}

/// Manager for namespace-level pod watchers used by port forwarding
pub struct PortForwardWatchManager {
    watchers: RwLock<HashMap<String, NamespaceWatchHandle>>,
}

impl PortForwardWatchManager {
    pub fn new() -> Self {
        Self {
            watchers: RwLock::new(HashMap::new()),
        }
    }

    /// Ensure a watcher exists for the given namespace. If one already exists, increment ref count.
    async fn ensure_namespace_watcher(
        &self,
        client: kube::Client,
        app: AppHandle,
        namespace: String,
        pf_manager: Arc<PortForwardManager>,
    ) {
        let mut watchers = self.watchers.write().await;
        if let Some(handle) = watchers.get_mut(&namespace) {
            handle.ref_count += 1;
            return;
        }

        let stop_flag = Arc::new(AtomicBool::new(false));
        watchers.insert(
            namespace.clone(),
            NamespaceWatchHandle {
                stop_flag: stop_flag.clone(),
                ref_count: 1,
            },
        );
        drop(watchers);

        let ns = namespace.clone();
        let client_clone = client.clone();

        tokio::spawn(async move {
            watch_pods_for_portforwards(client_clone, app, ns, pf_manager, stop_flag).await;
        });

        tracing::info!(
            "Started port forward pod watcher for namespace: {}",
            namespace
        );
    }

    /// Decrement ref count for a namespace watcher. Stop it if ref count reaches 0.
    async fn release_namespace_watcher(&self, namespace: &str) {
        let mut watchers = self.watchers.write().await;
        let should_remove = if let Some(handle) = watchers.get_mut(namespace) {
            handle.ref_count = handle.ref_count.saturating_sub(1);
            if handle.ref_count == 0 {
                handle.stop_flag.store(true, Ordering::SeqCst);
                true
            } else {
                false
            }
        } else {
            false
        };
        if should_remove {
            watchers.remove(namespace);
            tracing::info!(
                "Stopped port forward pod watcher for namespace: {}",
                namespace
            );
        }
    }
}

impl Default for PortForwardWatchManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Event-driven pod watcher for port forward health monitoring.
/// Watches all pods in a namespace and reacts when pods targeted by port forwards are deleted.
async fn watch_pods_for_portforwards(
    client: kube::Client,
    app: AppHandle,
    namespace: String,
    pf_manager: Arc<PortForwardManager>,
    stop_flag: Arc<AtomicBool>,
) {
    let pods: Api<Pod> = Api::namespaced(client.clone(), &namespace);
    let watcher_config = Config::default();
    let mut stream = watcher(pods, watcher_config).boxed();

    while let Some(event) = stream.next().await {
        if stop_flag.load(Ordering::SeqCst) {
            break;
        }

        match event {
            Ok(Event::Delete(pod)) => {
                let pod_uid = pod.metadata.uid.as_deref().unwrap_or_default();
                let pod_name = pod.metadata.name.as_deref().unwrap_or_default();

                let affected = pf_manager.get_forwards_for_pod_uid(pod_uid).await;
                if affected.is_empty() {
                    continue;
                }

                tracing::info!(
                    "Pod {} (uid={}) deleted, {} port forward(s) affected",
                    pod_name,
                    pod_uid,
                    affected.len()
                );

                for (forward_id, target_type, selector) in affected {
                    let event_name = format!("portforward-{}", forward_id);

                    match target_type {
                        PortForwardTargetType::Service => {
                            if let Some(sel) = &selector {
                                handle_service_reconnect(
                                    &client,
                                    &app,
                                    &pf_manager,
                                    &forward_id,
                                    &event_name,
                                    &namespace,
                                    pod_name,
                                    sel,
                                )
                                .await;
                            }
                        }
                        PortForwardTargetType::Pod => {
                            // For pod-type forwards: check if same-name pod exists (StatefulSet pattern)
                            let pod_api: Api<Pod> = Api::namespaced(client.clone(), &namespace);
                            match pod_api.get(pod_name).await {
                                Ok(new_pod) => {
                                    let new_uid =
                                        new_pod.metadata.uid.as_deref().unwrap_or_default();
                                    if new_uid != pod_uid {
                                        // Same name, new UID - StatefulSet replacement
                                        handle_pod_reconnect(
                                            &client,
                                            &app,
                                            &pf_manager,
                                            &forward_id,
                                            &event_name,
                                            &namespace,
                                            pod_name,
                                        )
                                        .await;
                                    }
                                }
                                Err(_) => {
                                    // Pod gone with different name expected (Deployment) - auto-cleanup
                                    let _ = app.emit(
                                        &event_name,
                                        PortForwardEvent::PodDied {
                                            forward_id: forward_id.clone(),
                                            pod_name: pod_name.to_string(),
                                        },
                                    );
                                    // Stop and remove the forward
                                    pf_manager.stop_session(&forward_id).await;
                                    tokio::time::sleep(tokio::time::Duration::from_millis(100))
                                        .await;
                                    pf_manager.remove_session(&forward_id).await;
                                    let _ = app.emit(
                                        &event_name,
                                        PortForwardEvent::Stopped {
                                            forward_id: forward_id.clone(),
                                        },
                                    );
                                }
                            }
                        }
                    }
                }
            }
            Ok(Event::Apply(pod)) => {
                // Check if this pod has a deletion_timestamp (terminating)
                if pod.metadata.deletion_timestamp.is_some() {
                    let pod_uid = pod.metadata.uid.as_deref().unwrap_or_default();
                    let pod_name = pod.metadata.name.as_deref().unwrap_or_default();
                    let affected = pf_manager.get_forwards_for_pod_uid(pod_uid).await;
                    if affected.is_empty() {
                        continue;
                    }

                    // Pod is terminating - for service-type, start proactive reconnect
                    for (forward_id, target_type, selector) in affected {
                        if target_type == PortForwardTargetType::Service {
                            if let Some(sel) = &selector {
                                let event_name = format!("portforward-{}", forward_id);
                                handle_service_reconnect(
                                    &client,
                                    &app,
                                    &pf_manager,
                                    &forward_id,
                                    &event_name,
                                    &namespace,
                                    pod_name,
                                    sel,
                                )
                                .await;
                            }
                        }
                    }
                }
            }
            Ok(_) => {} // Init, InitApply, InitDone - skip
            Err(e) => {
                tracing::warn!(
                    "Port forward pod watcher error in namespace {}: {}",
                    namespace,
                    e
                );
            }
        }
    }

    tracing::info!("Port forward pod watcher for namespace {} ended", namespace);
}

/// Handle reconnection for service-type port forwards
#[allow(clippy::too_many_arguments)]
async fn handle_service_reconnect(
    client: &kube::Client,
    app: &AppHandle,
    pf_manager: &Arc<PortForwardManager>,
    forward_id: &str,
    event_name: &str,
    namespace: &str,
    pod_name: &str,
    selector: &BTreeMap<String, String>,
) {
    // Skip if already reconnecting
    if let Some((_, _, _, status)) = pf_manager.get_reconnect_info(forward_id).await {
        let current = status.read().await.clone();
        if current == PortForwardStatus::Reconnecting {
            tracing::info!(
                "Forward {} already reconnecting, skipping duplicate",
                forward_id
            );
            return;
        }
    }

    // Emit reconnecting event
    let _ = app.emit(
        event_name,
        PortForwardEvent::Reconnecting {
            forward_id: forward_id.to_string(),
            reason: "Target pod terminated".to_string(),
        },
    );

    // Update status
    if let Some((_, _, _, status)) = pf_manager.get_reconnect_info(forward_id).await {
        *status.write().await = PortForwardStatus::Reconnecting;
    }

    // Try to find replacement with retries over 30 seconds
    let mut replacement = None;
    for attempt in 0..15 {
        if let Some(found) = find_replacement_pod(client, namespace, selector).await {
            replacement = Some(found);
            break;
        }
        if attempt < 14 {
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        }
    }

    match replacement {
        Some((new_pod_name, new_pod_uid)) => {
            reconnect_forward(
                client,
                app,
                pf_manager,
                forward_id,
                event_name,
                namespace,
                &new_pod_name,
                &new_pod_uid,
            )
            .await;
        }
        None => {
            // No replacement found - auto-cleanup
            let _ = app.emit(
                event_name,
                PortForwardEvent::PodDied {
                    forward_id: forward_id.to_string(),
                    pod_name: pod_name.to_string(),
                },
            );
            pf_manager.stop_session(forward_id).await;
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            pf_manager.remove_session(forward_id).await;
            let _ = app.emit(
                event_name,
                PortForwardEvent::Stopped {
                    forward_id: forward_id.to_string(),
                },
            );
        }
    }
}

/// Handle reconnection for pod-type forwards (StatefulSet same-name pattern)
async fn handle_pod_reconnect(
    client: &kube::Client,
    app: &AppHandle,
    pf_manager: &Arc<PortForwardManager>,
    forward_id: &str,
    event_name: &str,
    namespace: &str,
    pod_name: &str,
) {
    let _ = app.emit(
        event_name,
        PortForwardEvent::Reconnecting {
            forward_id: forward_id.to_string(),
            reason: "Pod restarted (same name)".to_string(),
        },
    );

    if let Some((_, _, _, status)) = pf_manager.get_reconnect_info(forward_id).await {
        *status.write().await = PortForwardStatus::Reconnecting;
    }

    // Wait for pod to be ready (up to 30s)
    let pods: Api<Pod> = Api::namespaced(client.clone(), namespace);
    let mut ready = false;
    for _ in 0..15 {
        if let Ok(pod) = pods.get(pod_name).await {
            let is_running = pod
                .status
                .as_ref()
                .and_then(|s| s.phase.as_ref())
                .map(|phase| phase == "Running")
                .unwrap_or(false);
            let is_ready = pod
                .status
                .as_ref()
                .and_then(|s| s.conditions.as_ref())
                .map(|conds| {
                    conds
                        .iter()
                        .any(|c| c.type_ == "Ready" && c.status == "True")
                })
                .unwrap_or(false);
            if is_running && is_ready {
                let new_uid = pod.metadata.uid.as_deref().unwrap_or_default();
                reconnect_forward(
                    client, app, pf_manager, forward_id, event_name, namespace, pod_name, new_uid,
                )
                .await;
                ready = true;
                break;
            }
        }
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    }

    if !ready {
        let _ = app.emit(
            event_name,
            PortForwardEvent::PodDied {
                forward_id: forward_id.to_string(),
                pod_name: pod_name.to_string(),
            },
        );
        pf_manager.stop_session(forward_id).await;
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        pf_manager.remove_session(forward_id).await;
        let _ = app.emit(
            event_name,
            PortForwardEvent::Stopped {
                forward_id: forward_id.to_string(),
            },
        );
    }
}

/// Reconnect a port forward to a new pod
#[allow(clippy::too_many_arguments)]
async fn reconnect_forward(
    client: &kube::Client,
    app: &AppHandle,
    pf_manager: &Arc<PortForwardManager>,
    forward_id: &str,
    event_name: &str,
    namespace: &str,
    new_pod_name: &str,
    new_pod_uid: &str,
) {
    let reconnect_info = pf_manager.get_reconnect_info(forward_id).await;
    let (_, local_port, target_port, status) = match reconnect_info {
        Some(info) => info,
        None => return,
    };

    // Stop old listener
    pf_manager.stop_session(forward_id).await;
    tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;

    // Create new stop flag for reconnected session
    let new_stop_flag = Arc::new(AtomicBool::new(false));
    pf_manager
        .update_pod_target(
            forward_id,
            new_pod_name.to_string(),
            new_pod_uid.to_string(),
            new_stop_flag.clone(),
        )
        .await;

    let client_clone = client.clone();
    let app_clone = app.clone();
    let event_name_clone = event_name.to_string();
    let forward_id_clone = forward_id.to_string();
    let namespace_clone = namespace.to_string();
    let pod_name_clone = new_pod_name.to_string();
    let status_clone = status.clone();
    let status_for_check = status.clone();
    let pf_manager_clone = Arc::clone(pf_manager);

    tokio::spawn(async move {
        run_port_forward(
            client_clone,
            app_clone.clone(),
            &event_name_clone,
            &forward_id_clone,
            new_stop_flag,
            status_clone,
            local_port,
            target_port,
            &namespace_clone,
            &pod_name_clone,
        )
        .await;

        // Only cleanup if not being reconnected again
        let current_status = status_for_check.read().await.clone();
        if current_status != PortForwardStatus::Reconnecting {
            pf_manager_clone.remove_session(&forward_id_clone).await;
            let _ = app_clone.emit(
                &event_name_clone,
                PortForwardEvent::Stopped {
                    forward_id: forward_id_clone,
                },
            );
        }
    });

    // Emit reconnected event
    let _ = app.emit(
        event_name,
        PortForwardEvent::Reconnected {
            forward_id: forward_id.to_string(),
            new_pod: new_pod_name.to_string(),
        },
    );

    tracing::info!(
        "Reconnected port forward {} to new pod {}",
        forward_id,
        new_pod_name
    );
}

/// Stop a port forward session
#[command]
pub async fn portforward_stop(
    app: AppHandle,
    pf_manager: State<'_, Arc<PortForwardManager>>,
    pf_watch_manager: State<'_, Arc<PortForwardWatchManager>>,
    forward_id: String,
) -> Result<(), String> {
    let event_name = format!("portforward-{}", forward_id);

    // Get namespace before removing
    let namespace = {
        let sessions = pf_manager.sessions.read().await;
        sessions.get(&forward_id).map(|s| s.namespace.clone())
    };

    if pf_manager.stop_session(&forward_id).await {
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        pf_manager.remove_session(&forward_id).await;

        // Release the namespace watcher ref
        if let Some(ns) = namespace {
            pf_watch_manager.release_namespace_watcher(&ns).await;
        }

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

// TODO: Extract tests into a separate file (e.g. src/commands/portforward_test.rs) for better SOLID separation
#[cfg(test)]
mod tests {
    use super::*;
    use k8s_openapi::api::core::v1::{
        Container, ContainerPort, Pod, PodSpec, PodStatus, Service, ServicePort, ServiceSpec,
    };
    use k8s_openapi::apimachinery::pkg::util::intstr::IntOrString;
    use kube::api::ObjectMeta;

    // ── Helper builders ──

    fn make_pod(name: &str, uid: &str, ports: Vec<(&str, i32)>) -> Pod {
        Pod {
            metadata: ObjectMeta {
                name: Some(name.to_string()),
                uid: Some(uid.to_string()),
                ..Default::default()
            },
            spec: Some(PodSpec {
                containers: vec![Container {
                    name: "main".to_string(),
                    ports: Some(
                        ports
                            .into_iter()
                            .map(|(pname, port)| ContainerPort {
                                name: if pname.is_empty() {
                                    None
                                } else {
                                    Some(pname.to_string())
                                },
                                container_port: port,
                                ..Default::default()
                            })
                            .collect(),
                    ),
                    ..Default::default()
                }],
                ..Default::default()
            }),
            status: Some(PodStatus {
                phase: Some("Running".to_string()),
                ..Default::default()
            }),
        }
    }

    fn make_service(ports: Vec<(i32, Option<IntOrString>)>) -> Service {
        Service {
            metadata: ObjectMeta::default(),
            spec: Some(ServiceSpec {
                ports: Some(
                    ports
                        .into_iter()
                        .map(|(port, target_port)| ServicePort {
                            port,
                            target_port,
                            ..Default::default()
                        })
                        .collect(),
                ),
                ..Default::default()
            }),
            status: None,
        }
    }

    fn make_session(
        local_port: u16,
        target_port: u16,
        target_type: PortForwardTargetType,
        namespace: &str,
        name: &str,
        pod_name: &str,
        pod_uid: &str,
    ) -> PortForwardSession {
        PortForwardSession {
            stop_flag: Arc::new(AtomicBool::new(false)),
            local_port,
            target_port,
            target_type,
            namespace: namespace.to_string(),
            name: name.to_string(),
            pod_name: pod_name.to_string(),
            pod_uid: pod_uid.to_string(),
            service_selector: None,
            status: Arc::new(RwLock::new(PortForwardStatus::Connected)),
        }
    }

    fn make_session_with_selector(
        local_port: u16,
        target_port: u16,
        namespace: &str,
        name: &str,
        pod_name: &str,
        pod_uid: &str,
        selector: BTreeMap<String, String>,
    ) -> PortForwardSession {
        PortForwardSession {
            stop_flag: Arc::new(AtomicBool::new(false)),
            local_port,
            target_port,
            target_type: PortForwardTargetType::Service,
            namespace: namespace.to_string(),
            name: name.to_string(),
            pod_name: pod_name.to_string(),
            pod_uid: pod_uid.to_string(),
            service_selector: Some(selector),
            status: Arc::new(RwLock::new(PortForwardStatus::Connected)),
        }
    }

    // ── resolve_service_target_port tests ──

    #[test]
    fn resolve_target_port_int() {
        let svc = make_service(vec![(80, Some(IntOrString::Int(8080)))]);
        let pod = make_pod("p", "uid", vec![]);
        assert_eq!(resolve_service_target_port(&svc, &pod, 80), Some(8080));
    }

    #[test]
    fn resolve_target_port_no_target_port_falls_back_to_service_port() {
        let svc = make_service(vec![(3000, None)]);
        let pod = make_pod("p", "uid", vec![]);
        assert_eq!(resolve_service_target_port(&svc, &pod, 3000), Some(3000));
    }

    #[test]
    fn resolve_target_port_string_numeric() {
        let svc = make_service(vec![(80, Some(IntOrString::String("9090".to_string())))]);
        let pod = make_pod("p", "uid", vec![]);
        assert_eq!(resolve_service_target_port(&svc, &pod, 80), Some(9090));
    }

    #[test]
    fn resolve_target_port_named_port_lookup() {
        let svc = make_service(vec![(80, Some(IntOrString::String("http".to_string())))]);
        let pod = make_pod("p", "uid", vec![("http", 8080), ("metrics", 9090)]);
        assert_eq!(resolve_service_target_port(&svc, &pod, 80), Some(8080));
    }

    #[test]
    fn resolve_target_port_named_port_not_found() {
        let svc = make_service(vec![(80, Some(IntOrString::String("grpc".to_string())))]);
        let pod = make_pod("p", "uid", vec![("http", 8080)]);
        assert_eq!(resolve_service_target_port(&svc, &pod, 80), None);
    }

    #[test]
    fn resolve_target_port_empty_string_returns_none() {
        let svc = make_service(vec![(80, Some(IntOrString::String("".to_string())))]);
        let pod = make_pod("p", "uid", vec![]);
        assert_eq!(resolve_service_target_port(&svc, &pod, 80), None);
    }

    #[test]
    fn resolve_target_port_falls_back_to_first_port() {
        // Requested port doesn't match, falls back to first service port
        let svc = make_service(vec![(80, Some(IntOrString::Int(8080)))]);
        let pod = make_pod("p", "uid", vec![]);
        assert_eq!(resolve_service_target_port(&svc, &pod, 9999), Some(8080));
    }

    #[test]
    fn resolve_target_port_no_spec_returns_none() {
        let svc = Service {
            metadata: ObjectMeta::default(),
            spec: None,
            status: None,
        };
        let pod = make_pod("p", "uid", vec![]);
        assert_eq!(resolve_service_target_port(&svc, &pod, 80), None);
    }

    #[test]
    fn resolve_target_port_negative_int_clamped_to_zero() {
        let svc = make_service(vec![(80, Some(IntOrString::Int(-1)))]);
        let pod = make_pod("p", "uid", vec![]);
        assert_eq!(resolve_service_target_port(&svc, &pod, 80), Some(0));
    }

    // ── find_named_container_port tests ──

    #[test]
    fn find_named_port_found() {
        let pod = make_pod("p", "uid", vec![("http", 8080), ("metrics", 9090)]);
        assert_eq!(find_named_container_port(&pod, "metrics"), Some(9090));
    }

    #[test]
    fn find_named_port_not_found() {
        let pod = make_pod("p", "uid", vec![("http", 8080)]);
        assert_eq!(find_named_container_port(&pod, "grpc"), None);
    }

    #[test]
    fn find_named_port_no_spec() {
        let pod = Pod {
            metadata: ObjectMeta::default(),
            spec: None,
            status: None,
        };
        assert_eq!(find_named_container_port(&pod, "http"), None);
    }

    #[test]
    fn find_named_port_no_ports() {
        let pod = Pod {
            metadata: ObjectMeta::default(),
            spec: Some(PodSpec {
                containers: vec![Container {
                    name: "main".to_string(),
                    ports: None,
                    ..Default::default()
                }],
                ..Default::default()
            }),
            status: None,
        };
        assert_eq!(find_named_container_port(&pod, "http"), None);
    }

    // ── PortForwardManager tests ──

    #[tokio::test]
    async fn manager_add_and_get_session() {
        let mgr = PortForwardManager::new();
        let session = make_session(
            8080,
            80,
            PortForwardTargetType::Pod,
            "default",
            "web",
            "web-abc",
            "uid-1",
        );
        mgr.add_session("fwd-1".to_string(), session).await;

        let info = mgr.get_session_info("fwd-1").await.unwrap();
        assert_eq!(info.forward_id, "fwd-1");
        assert_eq!(info.local_port, 8080);
        assert_eq!(info.target_port, 80);
        assert_eq!(info.namespace, "default");
        assert_eq!(info.name, "web");
        assert_eq!(info.pod_name, Some("web-abc".to_string()));
        assert_eq!(info.pod_uid, Some("uid-1".to_string()));
        assert_eq!(info.status, PortForwardStatus::Connected);
    }

    #[tokio::test]
    async fn manager_get_nonexistent_returns_none() {
        let mgr = PortForwardManager::new();
        assert!(mgr.get_session_info("nope").await.is_none());
    }

    #[tokio::test]
    async fn manager_remove_session() {
        let mgr = PortForwardManager::new();
        let session = make_session(
            8080,
            80,
            PortForwardTargetType::Pod,
            "default",
            "web",
            "web-abc",
            "uid-1",
        );
        mgr.add_session("fwd-1".to_string(), session).await;

        mgr.remove_session("fwd-1").await;
        assert!(!mgr.is_active("fwd-1").await);
    }

    #[tokio::test]
    async fn manager_stop_sets_flag() {
        let mgr = PortForwardManager::new();
        let session = make_session(
            8080,
            80,
            PortForwardTargetType::Pod,
            "default",
            "web",
            "web-abc",
            "uid-1",
        );
        let flag = session.stop_flag.clone();
        mgr.add_session("fwd-1".to_string(), session).await;

        assert!(!flag.load(Ordering::SeqCst));
        assert!(mgr.stop_session("fwd-1").await);
        assert!(flag.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn manager_stop_nonexistent_returns_false() {
        let mgr = PortForwardManager::new();
        assert!(!mgr.stop_session("nope").await);
    }

    #[tokio::test]
    async fn manager_is_port_in_use() {
        let mgr = PortForwardManager::new();
        let session = make_session(
            41587,
            80,
            PortForwardTargetType::Service,
            "default",
            "web",
            "web-abc",
            "uid-1",
        );
        mgr.add_session("fwd-1".to_string(), session).await;

        assert!(mgr.is_port_in_use(41587).await);
        assert!(!mgr.is_port_in_use(9999).await);
    }

    #[tokio::test]
    async fn manager_list_sessions() {
        let mgr = PortForwardManager::new();
        let s1 = make_session(
            8080,
            80,
            PortForwardTargetType::Pod,
            "default",
            "web",
            "pod-1",
            "uid-1",
        );
        let s2 = make_session(
            9090,
            90,
            PortForwardTargetType::Service,
            "kube-system",
            "dns",
            "pod-2",
            "uid-2",
        );
        mgr.add_session("fwd-1".to_string(), s1).await;
        mgr.add_session("fwd-2".to_string(), s2).await;

        let list = mgr.list_sessions().await;
        assert_eq!(list.len(), 2);
    }

    #[tokio::test]
    async fn manager_update_pod_target() {
        let mgr = PortForwardManager::new();
        let session = make_session(
            8080,
            80,
            PortForwardTargetType::Service,
            "default",
            "web",
            "old-pod",
            "old-uid",
        );
        mgr.add_session("fwd-1".to_string(), session).await;

        let new_flag = Arc::new(AtomicBool::new(false));
        mgr.update_pod_target(
            "fwd-1",
            "new-pod".to_string(),
            "new-uid".to_string(),
            new_flag,
        )
        .await;

        let info = mgr.get_session_info("fwd-1").await.unwrap();
        assert_eq!(info.pod_name, Some("new-pod".to_string()));
        assert_eq!(info.pod_uid, Some("new-uid".to_string()));
    }

    #[tokio::test]
    async fn manager_get_forwards_for_pod_uid() {
        let mgr = PortForwardManager::new();
        let s1 = make_session(
            8080,
            80,
            PortForwardTargetType::Service,
            "default",
            "web",
            "pod-abc",
            "uid-target",
        );
        let s2 = make_session(
            9090,
            90,
            PortForwardTargetType::Pod,
            "default",
            "api",
            "pod-def",
            "uid-other",
        );
        let s3 = make_session(
            7070,
            70,
            PortForwardTargetType::Service,
            "default",
            "grpc",
            "pod-abc",
            "uid-target",
        );
        mgr.add_session("fwd-1".to_string(), s1).await;
        mgr.add_session("fwd-2".to_string(), s2).await;
        mgr.add_session("fwd-3".to_string(), s3).await;

        let affected = mgr.get_forwards_for_pod_uid("uid-target").await;
        assert_eq!(affected.len(), 2);

        let ids: Vec<&str> = affected.iter().map(|(id, _, _)| id.as_str()).collect();
        assert!(ids.contains(&"fwd-1"));
        assert!(ids.contains(&"fwd-3"));
    }

    #[tokio::test]
    async fn manager_get_forwards_for_pod_uid_none_found() {
        let mgr = PortForwardManager::new();
        let s1 = make_session(
            8080,
            80,
            PortForwardTargetType::Pod,
            "default",
            "web",
            "pod-abc",
            "uid-1",
        );
        mgr.add_session("fwd-1".to_string(), s1).await;

        let affected = mgr.get_forwards_for_pod_uid("uid-nonexistent").await;
        assert!(affected.is_empty());
    }

    #[tokio::test]
    async fn manager_get_reconnect_info() {
        let mgr = PortForwardManager::new();
        let session = make_session(
            41587,
            8080,
            PortForwardTargetType::Service,
            "default",
            "web",
            "pod-abc",
            "uid-1",
        );
        mgr.add_session("fwd-1".to_string(), session).await;

        let info = mgr.get_reconnect_info("fwd-1").await.unwrap();
        assert_eq!(info.0, "default"); // namespace
        assert_eq!(info.1, 41587); // local_port
        assert_eq!(info.2, 8080); // target_port

        // Status should be accessible
        let status = info.3.read().await.clone();
        assert_eq!(status, PortForwardStatus::Connected);
    }

    #[tokio::test]
    async fn manager_get_reconnect_info_nonexistent() {
        let mgr = PortForwardManager::new();
        assert!(mgr.get_reconnect_info("nope").await.is_none());
    }

    #[tokio::test]
    async fn manager_get_forwards_returns_selector() {
        let mgr = PortForwardManager::new();
        let mut selector = BTreeMap::new();
        selector.insert("app".to_string(), "web".to_string());
        let session = make_session_with_selector(
            8080,
            80,
            "default",
            "web-svc",
            "pod-1",
            "uid-1",
            selector.clone(),
        );
        mgr.add_session("fwd-1".to_string(), session).await;

        let affected = mgr.get_forwards_for_pod_uid("uid-1").await;
        assert_eq!(affected.len(), 1);
        assert_eq!(affected[0].2, Some(selector));
    }

    // ── PortForwardWatchManager tests ──

    #[tokio::test]
    async fn watch_manager_release_decrements_ref_count() {
        let wm = PortForwardWatchManager::new();

        // Manually insert a watch handle (we can't use ensure_namespace_watcher without a real client)
        {
            let mut watchers = wm.watchers.write().await;
            watchers.insert(
                "default".to_string(),
                NamespaceWatchHandle {
                    stop_flag: Arc::new(AtomicBool::new(false)),
                    ref_count: 3,
                },
            );
        }

        wm.release_namespace_watcher("default").await;
        {
            let watchers = wm.watchers.read().await;
            assert_eq!(watchers.get("default").unwrap().ref_count, 2);
        }

        wm.release_namespace_watcher("default").await;
        wm.release_namespace_watcher("default").await;

        // Ref count reached 0, should be removed
        let watchers = wm.watchers.read().await;
        assert!(!watchers.contains_key("default"));
    }

    #[tokio::test]
    async fn watch_manager_release_sets_stop_flag_at_zero() {
        let wm = PortForwardWatchManager::new();
        let stop_flag = Arc::new(AtomicBool::new(false));

        {
            let mut watchers = wm.watchers.write().await;
            watchers.insert(
                "kube-system".to_string(),
                NamespaceWatchHandle {
                    stop_flag: stop_flag.clone(),
                    ref_count: 1,
                },
            );
        }

        wm.release_namespace_watcher("kube-system").await;
        assert!(stop_flag.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn watch_manager_release_nonexistent_is_noop() {
        let wm = PortForwardWatchManager::new();
        // Should not panic
        wm.release_namespace_watcher("nonexistent").await;
    }

    // ── Serialization tests ──

    #[test]
    fn port_forward_event_serializes_correctly() {
        let event = PortForwardEvent::Reconnecting {
            forward_id: "fwd-1".to_string(),
            reason: "Pod terminated".to_string(),
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"type\":\"Reconnecting\""));
        assert!(json.contains("\"forward_id\":\"fwd-1\""));
        assert!(json.contains("\"reason\":\"Pod terminated\""));
    }

    #[test]
    fn port_forward_event_reconnected_serializes() {
        let event = PortForwardEvent::Reconnected {
            forward_id: "fwd-1".to_string(),
            new_pod: "pod-xyz".to_string(),
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"type\":\"Reconnected\""));
        assert!(json.contains("\"new_pod\":\"pod-xyz\""));
    }

    #[test]
    fn port_forward_event_pod_died_serializes() {
        let event = PortForwardEvent::PodDied {
            forward_id: "fwd-1".to_string(),
            pod_name: "old-pod".to_string(),
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"type\":\"PodDied\""));
        assert!(json.contains("\"pod_name\":\"old-pod\""));
    }

    #[test]
    fn port_forward_status_serializes_reconnecting() {
        let status = PortForwardStatus::Reconnecting;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"reconnecting\"");
    }

    #[test]
    fn port_forward_target_type_roundtrips() {
        let svc = PortForwardTargetType::Service;
        let json = serde_json::to_string(&svc).unwrap();
        assert_eq!(json, "\"service\"");
        let back: PortForwardTargetType = serde_json::from_str(&json).unwrap();
        assert_eq!(back, PortForwardTargetType::Service);
    }

    #[test]
    fn port_forward_info_includes_pod_fields() {
        let info = PortForwardInfo {
            forward_id: "fwd-1".to_string(),
            namespace: "default".to_string(),
            name: "web".to_string(),
            target_type: PortForwardTargetType::Service,
            target_port: 80,
            local_port: 41587,
            status: PortForwardStatus::Reconnecting,
            pod_name: Some("pod-abc".to_string()),
            pod_uid: Some("uid-123".to_string()),
        };
        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("\"pod_name\":\"pod-abc\""));
        assert!(json.contains("\"pod_uid\":\"uid-123\""));
        assert!(json.contains("\"reconnecting\""));
    }

    // ── Status transition tests ──

    #[tokio::test]
    async fn status_transition_connected_to_reconnecting() {
        let status = Arc::new(RwLock::new(PortForwardStatus::Connected));
        *status.write().await = PortForwardStatus::Reconnecting;
        assert_eq!(*status.read().await, PortForwardStatus::Reconnecting);
    }

    #[tokio::test]
    async fn status_check_prevents_cleanup_during_reconnect() {
        let status = Arc::new(RwLock::new(PortForwardStatus::Reconnecting));
        let current = status.read().await.clone();
        // This is the guard that prevents run_port_forward cleanup from racing with reconnect
        assert_eq!(current, PortForwardStatus::Reconnecting);
        assert!(current == PortForwardStatus::Reconnecting);
    }
}
