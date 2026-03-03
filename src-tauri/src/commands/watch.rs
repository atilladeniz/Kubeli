use crate::commands::resources::{extract_container_info, ContainerInfo, NamespaceInfo, PodInfo};
use crate::error::KubeliError;
use crate::k8s::AppState;
use futures::StreamExt;
use k8s_openapi::api::core::v1::{Namespace, Pod};
use kube::api::Api;
use kube::runtime::watcher::{watcher, Config, Event};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{command, AppHandle, Emitter, State};
use tokio::sync::RwLock;

/// Watch event types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum WatchEvent<T> {
    Added(T),
    Modified(T),
    Deleted(T),
    Restarted(Vec<T>),
    Error(KubeliError),
}

/// Active watch session
struct WatchSession {
    stop_flag: Arc<AtomicBool>,
}

/// Watch manager to track active watches
pub struct WatchManager {
    sessions: RwLock<HashMap<String, WatchSession>>,
}

impl WatchManager {
    pub fn new() -> Self {
        Self {
            sessions: RwLock::new(HashMap::new()),
        }
    }

    async fn add_session(&self, id: String, stop_flag: Arc<AtomicBool>) {
        let mut sessions = self.sessions.write().await;
        sessions.insert(id, WatchSession { stop_flag });
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
}

impl Default for WatchManager {
    fn default() -> Self {
        Self::new()
    }
}

// Helper to convert BTreeMap to HashMap
fn btree_to_hashmap(
    btree: Option<std::collections::BTreeMap<String, String>>,
) -> HashMap<String, String> {
    btree.map(|b| b.into_iter().collect()).unwrap_or_default()
}

fn pod_to_info(pod: Pod) -> PodInfo {
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
}

/// Start watching pods in a namespace
#[command]
pub async fn watch_pods(
    app: AppHandle,
    state: State<'_, AppState>,
    watch_manager: State<'_, Arc<WatchManager>>,
    namespace: Option<String>,
    watch_id: String,
) -> Result<(), KubeliError> {
    let client = state.k8s.get_client().await.map_err(KubeliError::from)?;
    let manager = Arc::clone(watch_manager.inner());

    let stop_flag = Arc::new(AtomicBool::new(false));
    manager
        .add_session(watch_id.clone(), stop_flag.clone())
        .await;

    let pods: Api<Pod> = if let Some(ns) = &namespace {
        Api::namespaced(client, ns)
    } else {
        Api::all(client)
    };

    let watcher_config = Config::default();
    let watch_id_clone = watch_id.clone();

    // Spawn the watch task
    tokio::spawn(async move {
        let mut stream = watcher(pods, watcher_config).boxed();

        while let Some(event) = stream.next().await {
            if stop_flag.load(Ordering::SeqCst) {
                tracing::info!("Watch {} stopped by user", watch_id_clone);
                break;
            }

            let watch_event = match event {
                Ok(Event::Apply(pod)) => {
                    let info = pod_to_info(pod);
                    WatchEvent::Modified(info)
                }
                Ok(Event::Delete(pod)) => {
                    let info = pod_to_info(pod);
                    WatchEvent::Deleted(info)
                }
                Ok(Event::Init) => {
                    // Initial list event - skip
                    continue;
                }
                Ok(Event::InitApply(pod)) => {
                    let info = pod_to_info(pod);
                    WatchEvent::Added(info)
                }
                Ok(Event::InitDone) => {
                    // Initial list done - skip
                    continue;
                }
                Err(e) => WatchEvent::Error(KubeliError::from(e)),
            };

            let event_name = format!("pods-watch-{}", watch_id_clone);
            if let Err(e) = app.emit(&event_name, &watch_event) {
                tracing::error!("Failed to emit watch event: {}", e);
                break;
            }
        }

        manager.remove_session(&watch_id_clone).await;
        tracing::info!("Watch {} ended", watch_id_clone);
    });

    tracing::info!("Started pods watch: {}", watch_id);
    Ok(())
}

fn namespace_to_info(ns: Namespace) -> NamespaceInfo {
    let metadata = ns.metadata;
    let status = ns
        .status
        .as_ref()
        .and_then(|s| s.phase.as_ref())
        .cloned()
        .unwrap_or_else(|| "Unknown".to_string());

    NamespaceInfo {
        name: metadata.name.unwrap_or_default(),
        uid: metadata.uid.unwrap_or_default(),
        status,
        created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
        labels: btree_to_hashmap(metadata.labels),
        annotations: btree_to_hashmap(metadata.annotations),
    }
}

/// Start watching namespaces
#[command]
pub async fn watch_namespaces(
    app: AppHandle,
    state: State<'_, AppState>,
    watch_manager: State<'_, Arc<WatchManager>>,
    watch_id: String,
) -> Result<(), KubeliError> {
    let client = state.k8s.get_client().await.map_err(KubeliError::from)?;
    let manager = Arc::clone(watch_manager.inner());

    let stop_flag = Arc::new(AtomicBool::new(false));
    manager
        .add_session(watch_id.clone(), stop_flag.clone())
        .await;

    let namespaces: Api<Namespace> = Api::all(client);

    let watcher_config = Config::default();
    let watch_id_clone = watch_id.clone();

    tokio::spawn(async move {
        let mut stream = watcher(namespaces, watcher_config).boxed();

        while let Some(event) = stream.next().await {
            if stop_flag.load(Ordering::SeqCst) {
                tracing::info!("Watch {} stopped by user", watch_id_clone);
                break;
            }

            let watch_event = match event {
                Ok(Event::Apply(ns)) => {
                    let info = namespace_to_info(ns);
                    WatchEvent::Modified(info)
                }
                Ok(Event::Delete(ns)) => {
                    let info = namespace_to_info(ns);
                    WatchEvent::Deleted(info)
                }
                Ok(Event::Init) => continue,
                Ok(Event::InitApply(ns)) => {
                    let info = namespace_to_info(ns);
                    WatchEvent::Added(info)
                }
                Ok(Event::InitDone) => continue,
                Err(e) => WatchEvent::Error(KubeliError::from(e)),
            };

            let event_name = format!("namespaces-watch-{}", watch_id_clone);
            if let Err(e) = app.emit(&event_name, &watch_event) {
                tracing::error!("Failed to emit namespace watch event: {}", e);
                break;
            }
        }

        manager.remove_session(&watch_id_clone).await;
        tracing::info!("Namespace watch {} ended", watch_id_clone);
    });

    tracing::info!("Started namespaces watch: {}", watch_id);
    Ok(())
}

/// Stop watching resources (idempotent — returns Ok even if already stopped)
#[command]
pub async fn stop_watch(
    watch_manager: State<'_, Arc<WatchManager>>,
    watch_id: String,
) -> Result<(), KubeliError> {
    if watch_manager.stop_session(&watch_id).await {
        watch_manager.remove_session(&watch_id).await;
        tracing::info!("Stopped watch: {}", watch_id);
    } else {
        tracing::debug!("Watch {} already stopped or not found", watch_id);
    }
    Ok(())
}
