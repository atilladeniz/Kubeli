use crate::commands::resources::{extract_container_info, ContainerInfo, NamespaceInfo, PodInfo};
use crate::error::KubeliError;
use crate::k8s::AppState;
use futures::StreamExt;
use k8s_openapi::api::core::v1::{Namespace, Pod};
use kube::api::Api;
use kube::runtime::watcher::{watcher, Config, Event};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{command, AppHandle, Emitter, State};
use tokio::sync::RwLock;
use tokio_util::sync::CancellationToken;

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

/// Active watch session. The token is wrapped in an Arc so a watch task can
/// prove its identity when removing itself (Arc::ptr_eq) - a task must never
/// remove a session that replaced it under the same id.
struct WatchSession {
    token: Arc<CancellationToken>,
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

    /// Register a session. If a session with the same id already exists it
    /// is cancelled first - otherwise the old task would keep running with
    /// no one able to stop it.
    async fn add_session(&self, id: String) -> Arc<CancellationToken> {
        let token = Arc::new(CancellationToken::new());
        let mut sessions = self.sessions.write().await;
        if let Some(old) = sessions.insert(
            id,
            WatchSession {
                token: Arc::clone(&token),
            },
        ) {
            old.token.cancel();
        }
        token
    }

    async fn stop_session(&self, id: &str) -> bool {
        let sessions = self.sessions.read().await;
        if let Some(session) = sessions.get(id) {
            session.token.cancel();
            true
        } else {
            false
        }
    }

    async fn remove_session(&self, id: &str) {
        let mut sessions = self.sessions.write().await;
        sessions.remove(id);
    }

    /// Remove the session only if it still belongs to the calling task
    /// (identity via Arc::ptr_eq). Used by watch tasks on exit.
    async fn remove_session_if_owned(&self, id: &str, token: &Arc<CancellationToken>) {
        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.get(id) {
            if Arc::ptr_eq(&session.token, token) {
                sessions.remove(id);
            }
        }
    }

    /// Stop every active watch. Called on disconnect/context switch so no
    /// watch keeps streaming from the previous cluster.
    pub async fn stop_all(&self) {
        let mut sessions = self.sessions.write().await;
        for session in sessions.values() {
            session.token.cancel();
        }
        sessions.clear();
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

/// Map a raw watcher event to the frontend event, buffering the initial
/// listing: Init/InitApply/InitDone become ONE Restarted(Vec) instead of a
/// flood of Added events (which duplicated existing rows on every watch
/// resync). Returns None when nothing should be emitted yet.
fn map_watch_event<K, T>(
    event: Result<Event<K>, kube::runtime::watcher::Error>,
    init_buffer: &mut Option<Vec<T>>,
    to_info: impl Fn(K) -> T,
) -> Option<WatchEvent<T>> {
    match event {
        Ok(Event::Init) => {
            *init_buffer = Some(Vec::new());
            None
        }
        Ok(Event::InitApply(obj)) => {
            let info = to_info(obj);
            match init_buffer {
                Some(buf) => {
                    buf.push(info);
                    None
                }
                // Defensive: InitApply without Init
                None => Some(WatchEvent::Added(info)),
            }
        }
        Ok(Event::InitDone) => init_buffer.take().map(WatchEvent::Restarted),
        Ok(Event::Apply(obj)) => Some(WatchEvent::Modified(to_info(obj))),
        Ok(Event::Delete(obj)) => Some(WatchEvent::Deleted(to_info(obj))),
        Err(e) => Some(WatchEvent::Error(KubeliError::from(e))),
    }
}

/// Drive a watch stream until it ends or the session is cancelled. Uses
/// select! so cancellation takes effect immediately - the old stop-flag was
/// only polled after the next event, so quiet watches lingered forever.
async fn run_watch_loop<K, T>(
    app: AppHandle,
    manager: Arc<WatchManager>,
    watch_id: String,
    event_prefix: &str,
    stream: impl futures::Stream<Item = Result<Event<K>, kube::runtime::watcher::Error>>,
    to_info: impl Fn(K) -> T,
    token: Arc<CancellationToken>,
) where
    T: Serialize + Clone,
{
    tokio::pin!(stream);
    let mut init_buffer: Option<Vec<T>> = None;
    let event_name = format!("{event_prefix}-{watch_id}");

    loop {
        tokio::select! {
            _ = token.cancelled() => {
                tracing::info!("Watch {} cancelled", watch_id);
                break;
            }
            event = stream.next() => {
                let Some(event) = event else { break };
                if let Some(watch_event) = map_watch_event(event, &mut init_buffer, &to_info) {
                    if let Err(e) = app.emit(&event_name, &watch_event) {
                        tracing::error!("Failed to emit watch event: {}", e);
                        break;
                    }
                }
            }
        }
    }

    manager.remove_session_if_owned(&watch_id, &token).await;
    tracing::info!("Watch {} ended", watch_id);
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
    let token = manager.add_session(watch_id.clone()).await;

    let pods: Api<Pod> = if let Some(ns) = &namespace {
        Api::namespaced(client, ns)
    } else {
        Api::all(client)
    };

    let watch_id_clone = watch_id.clone();
    tokio::spawn(async move {
        let stream = watcher(pods, Config::default()).boxed();
        run_watch_loop(
            app,
            manager,
            watch_id_clone,
            "pods-watch",
            stream,
            pod_to_info,
            token,
        )
        .await;
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
    let token = manager.add_session(watch_id.clone()).await;

    let namespaces: Api<Namespace> = Api::all(client);

    let watch_id_clone = watch_id.clone();
    tokio::spawn(async move {
        let stream = watcher(namespaces, Config::default()).boxed();
        run_watch_loop(
            app,
            manager,
            watch_id_clone,
            "namespaces-watch",
            stream,
            namespace_to_info,
            token,
        )
        .await;
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

#[cfg(test)]
mod tests {
    use super::*;

    fn apply(n: u32) -> Result<Event<u32>, kube::runtime::watcher::Error> {
        Ok(Event::Apply(n))
    }

    #[test]
    fn init_listing_becomes_one_restarted_event() {
        let mut buf: Option<Vec<u32>> = None;
        let id = |v: u32| v;

        assert!(map_watch_event(Ok(Event::Init), &mut buf, id).is_none());
        assert!(map_watch_event(Ok(Event::InitApply(1)), &mut buf, id).is_none());
        assert!(map_watch_event(Ok(Event::InitApply(2)), &mut buf, id).is_none());

        match map_watch_event(Ok(Event::InitDone), &mut buf, id) {
            Some(WatchEvent::Restarted(items)) => assert_eq!(items, vec![1, 2]),
            other => panic!("expected Restarted, got {:?}", other.map(|_| ())),
        }
        // Buffer is consumed - a second InitDone emits nothing
        assert!(map_watch_event(Ok(Event::InitDone), &mut buf, id).is_none());
    }

    #[test]
    fn init_apply_without_init_falls_back_to_added() {
        let mut buf: Option<Vec<u32>> = None;
        match map_watch_event(Ok(Event::InitApply(7)), &mut buf, |v| v) {
            Some(WatchEvent::Added(7)) => {}
            other => panic!("expected Added(7), got {:?}", other.map(|_| ())),
        }
    }

    #[test]
    fn live_events_map_directly() {
        let mut buf: Option<Vec<u32>> = None;
        assert!(matches!(
            map_watch_event(apply(5), &mut buf, |v| v),
            Some(WatchEvent::Modified(5))
        ));
        assert!(matches!(
            map_watch_event(Ok(Event::Delete(5)), &mut buf, |v| v),
            Some(WatchEvent::Deleted(5))
        ));
    }

    #[tokio::test]
    async fn add_session_cancels_a_session_it_replaces() {
        let manager = WatchManager::new();
        let old_token = manager.add_session("w1".into()).await;
        assert!(!old_token.is_cancelled());

        let new_token = manager.add_session("w1".into()).await;
        assert!(
            old_token.is_cancelled(),
            "replaced session must be cancelled"
        );
        assert!(!new_token.is_cancelled());
    }

    #[tokio::test]
    async fn task_cannot_remove_a_session_that_replaced_it() {
        let manager = WatchManager::new();
        let old_token = manager.add_session("w1".into()).await;
        let new_token = manager.add_session("w1".into()).await;

        // Old task exits and tries to clean up - must NOT remove the new session
        manager.remove_session_if_owned("w1", &old_token).await;
        assert!(manager.stop_session("w1").await, "new session must survive");
        assert!(new_token.is_cancelled());
    }

    #[tokio::test]
    async fn stop_all_cancels_every_session() {
        let manager = WatchManager::new();
        let t1 = manager.add_session("a".into()).await;
        let t2 = manager.add_session("b".into()).await;
        manager.stop_all().await;
        assert!(t1.is_cancelled() && t2.is_cancelled());
        assert!(!manager.stop_session("a").await);
    }
}
