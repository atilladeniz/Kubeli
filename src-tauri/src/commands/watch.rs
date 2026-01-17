use crate::commands::resources::{ContainerInfo, PodInfo};
use crate::k8s::AppState;
use futures::StreamExt;
use k8s_openapi::api::core::v1::Pod;
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
    Error(String),
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

// Convert Pod to PodInfo
fn pod_to_info(pod: Pod) -> PodInfo {
    let metadata = pod.metadata;
    let spec = pod.spec.unwrap_or_default();
    let status = pod.status.unwrap_or_default();

    let containers: Vec<ContainerInfo> = spec
        .containers
        .iter()
        .map(|c| {
            let container_status = status
                .container_statuses
                .as_ref()
                .and_then(|statuses| statuses.iter().find(|s| s.name == c.name));

            let (ready, restart_count, state, state_reason) = if let Some(cs) = container_status {
                let (state_str, reason) = if let Some(s) = &cs.state {
                    if s.running.is_some() {
                        ("Running".to_string(), None)
                    } else if let Some(w) = &s.waiting {
                        (
                            "Waiting".to_string(),
                            Some(w.reason.clone().unwrap_or_default()),
                        )
                    } else if let Some(t) = &s.terminated {
                        (
                            "Terminated".to_string(),
                            Some(t.reason.clone().unwrap_or_default()),
                        )
                    } else {
                        ("Unknown".to_string(), None)
                    }
                } else {
                    ("Unknown".to_string(), None)
                };
                (cs.ready, cs.restart_count, state_str, reason)
            } else {
                (false, 0, "Unknown".to_string(), None)
            };

            ContainerInfo {
                name: c.name.clone(),
                image: c.image.clone().unwrap_or_default(),
                ready,
                restart_count,
                state,
                state_reason,
            }
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
        containers,
        created_at: metadata.creation_timestamp.map(|t| t.0.to_string()),
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
    watch_manager: State<'_, WatchManager>,
    namespace: Option<String>,
    watch_id: String,
) -> Result<(), String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let stop_flag = Arc::new(AtomicBool::new(false));
    watch_manager
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
                Err(e) => WatchEvent::Error(e.to_string()),
            };

            let event_name = format!("pods-watch-{}", watch_id_clone);
            if let Err(e) = app.emit(&event_name, &watch_event) {
                tracing::error!("Failed to emit watch event: {}", e);
                break;
            }
        }

        tracing::info!("Watch {} ended", watch_id_clone);
    });

    tracing::info!("Started pods watch: {}", watch_id);
    Ok(())
}

/// Stop watching resources
#[command]
pub async fn stop_watch(
    watch_manager: State<'_, WatchManager>,
    watch_id: String,
) -> Result<(), String> {
    if watch_manager.stop_session(&watch_id).await {
        watch_manager.remove_session(&watch_id).await;
        tracing::info!("Stopped watch: {}", watch_id);
        Ok(())
    } else {
        Err(format!("Watch {} not found", watch_id))
    }
}
