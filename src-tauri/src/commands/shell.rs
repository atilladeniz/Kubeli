use crate::k8s::AppState;
use futures::SinkExt;
use k8s_openapi::api::core::v1::Pod;
use kube::api::{
    Api, AttachParams, AttachedProcess, DeleteParams, ListParams, PostParams, TerminalSize,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{command, AppHandle, Emitter, State};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::{mpsc, RwLock};

/// Shell session state
struct ShellSession {
    stop_flag: Arc<AtomicBool>,
    input_tx: mpsc::Sender<ShellInput>,
    /// For node shell sessions, track the debug pod name for cleanup
    debug_pod: Option<DebugPodInfo>,
}

/// Info about a debug pod created for node shell access
#[derive(Clone)]
struct DebugPodInfo {
    pod_name: String,
    namespace: String,
}

/// Input types for shell session
#[derive(Debug, Clone)]
enum ShellInput {
    Data(Vec<u8>),
    Resize { cols: u16, rows: u16 },
}

/// Shell event types sent to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum ShellEvent {
    Output(String),
    Error(String),
    Started { session_id: String },
    Closed { session_id: String },
}

/// Options for starting a shell session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellOptions {
    pub namespace: String,
    pub pod_name: String,
    pub container: Option<String>,
    pub command: Option<Vec<String>>,
}

/// Manager for active shell sessions
pub struct ShellSessionManager {
    sessions: RwLock<HashMap<String, ShellSession>>,
}

impl ShellSessionManager {
    pub fn new() -> Self {
        Self {
            sessions: RwLock::new(HashMap::new()),
        }
    }

    async fn add_session(&self, id: String, session: ShellSession) {
        let mut sessions = self.sessions.write().await;
        sessions.insert(id, session);
    }

    async fn get_input_sender(&self, id: &str) -> Option<mpsc::Sender<ShellInput>> {
        let sessions = self.sessions.read().await;
        sessions.get(id).map(|s| s.input_tx.clone())
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

    async fn get_debug_pod_info(&self, id: &str) -> Option<DebugPodInfo> {
        let sessions = self.sessions.read().await;
        sessions.get(id).and_then(|s| s.debug_pod.clone())
    }

    /// Stop every shell session. Node-shell debug pods are deleted best
    /// effort with the given client (the old cluster's client must still be
    /// available when this is called on disconnect/context switch).
    pub async fn stop_all(&self, client: Option<kube::Client>) {
        let debug_pods: Vec<DebugPodInfo> = {
            let mut sessions = self.sessions.write().await;
            let pods = sessions
                .values()
                .filter_map(|s| {
                    s.stop_flag.store(true, Ordering::SeqCst);
                    s.debug_pod.clone()
                })
                .collect();
            sessions.clear();
            pods
        };

        if let Some(client) = client {
            if !debug_pods.is_empty() {
                tokio::spawn(async move {
                    for info in debug_pods {
                        let pods: Api<Pod> = Api::namespaced(client.clone(), &info.namespace);
                        let _ = pods.delete(&info.pod_name, &DeleteParams::default()).await;
                    }
                });
            }
        }
    }
}

impl Default for ShellSessionManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Start an interactive shell session in a pod container
#[command]
pub async fn shell_start(
    app: AppHandle,
    state: State<'_, AppState>,
    shell_manager: State<'_, Arc<ShellSessionManager>>,
    session_id: String,
    options: ShellOptions,
) -> Result<(), String> {
    // Check if session already exists
    if shell_manager.is_active(&session_id).await {
        return Err(format!("Session {} already exists", session_id));
    }

    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let pods: Api<Pod> = Api::namespaced(client, &options.namespace);

    // Verify pod exists
    let pod = pods
        .get(&options.pod_name)
        .await
        .map_err(|e| format!("Failed to get pod: {}", e))?;

    // Determine container
    let container = options.container.clone().or_else(|| {
        pod.spec
            .as_ref()
            .and_then(|s| s.containers.first())
            .map(|c| c.name.clone())
    });

    // Default to sh if no command specified
    let cmd = options
        .command
        .clone()
        .unwrap_or_else(|| vec!["sh".to_string()]);

    let mut attach_params = AttachParams::interactive_tty();
    if let Some(c) = &container {
        attach_params = attach_params.container(c);
    }

    // Create channels for input
    let (input_tx, mut input_rx) = mpsc::channel::<ShellInput>(256);
    let stop_flag = Arc::new(AtomicBool::new(false));

    // Store session
    let session = ShellSession {
        stop_flag: stop_flag.clone(),
        input_tx,
        debug_pod: None,
    };
    shell_manager.add_session(session_id.clone(), session).await;

    let event_name = format!("shell-{}", session_id);
    let session_id_clone = session_id.clone();
    let shell_manager_clone = Arc::clone(&shell_manager);
    let namespace_for_log = options.namespace.clone();
    let pod_name_for_log = options.pod_name.clone();

    // Emit started event
    let _ = app.emit(
        &event_name,
        ShellEvent::Started {
            session_id: session_id.clone(),
        },
    );

    // Spawn the shell session task
    tokio::spawn(async move {
        match pods.exec(&options.pod_name, cmd, &attach_params).await {
            Ok(attached) => {
                run_shell_session(attached, app.clone(), &event_name, stop_flag, &mut input_rx)
                    .await;
            }
            Err(e) => {
                let _ = app.emit(
                    &event_name,
                    ShellEvent::Error(format!("Failed to start shell: {}", e)),
                );
            }
        }

        // Clean up
        shell_manager_clone.remove_session(&session_id_clone).await;
        let _ = app.emit(
            &event_name,
            ShellEvent::Closed {
                session_id: session_id_clone,
            },
        );
    });

    tracing::info!(
        "Started shell session {} for {}/{}",
        session_id,
        namespace_for_log,
        pod_name_for_log
    );
    Ok(())
}

/// Max bytes accumulated before a shell output batch is flushed regardless
/// of timing.
const MAX_SHELL_BATCH: usize = 64 * 1024;
/// How long to keep draining further reads before flushing a batch.
const SHELL_BATCH_WINDOW: std::time::Duration = std::time::Duration::from_millis(8);

/// Emit the decodable prefix of `pending`; an incomplete trailing UTF-8
/// sequence stays buffered for the next read unless `take_all` is set
/// (EOF - nothing more will arrive to complete it).
fn flush_shell_output(app: &AppHandle, event_name: &str, pending: &mut Vec<u8>, take_all: bool) {
    let output = take_valid_utf8(pending, take_all);
    if !output.is_empty() {
        let _ = app.emit(event_name, ShellEvent::Output(output));
    }
}

/// Split the valid UTF-8 prefix out of `pending`. A truncated multi-byte
/// sequence at the end is kept for the next chunk; genuinely invalid bytes
/// are lossy-decoded so the stream cannot stall on binary output.
fn take_valid_utf8(pending: &mut Vec<u8>, take_all: bool) -> String {
    match std::str::from_utf8(pending) {
        Ok(s) => {
            let out = s.to_string();
            pending.clear();
            out
        }
        Err(e) if e.error_len().is_none() && !take_all => {
            // Incomplete trailing sequence: emit the valid part, keep the tail
            let valid = e.valid_up_to();
            let out = String::from_utf8_lossy(&pending[..valid]).into_owned();
            pending.drain(..valid);
            out
        }
        Err(_) => {
            // Invalid bytes mid-stream (or EOF with a truncated tail)
            let out = String::from_utf8_lossy(pending).into_owned();
            pending.clear();
            out
        }
    }
}

/// Run the shell session handling stdin/stdout
async fn run_shell_session(
    mut attached: AttachedProcess,
    app: AppHandle,
    event_name: &str,
    stop_flag: Arc<AtomicBool>,
    input_rx: &mut mpsc::Receiver<ShellInput>,
) {
    let (Some(mut stdin), Some(mut stdout)) = (attached.stdin(), attached.stdout()) else {
        tracing::error!("Shell attach did not provide stdin/stdout streams");
        let _ = app.emit(
            event_name,
            ShellEvent::Error("Failed to open shell I/O streams".to_string()),
        );
        return;
    };
    // terminal_size() takes the sender out of AttachedProcess (kube 4.0), so it
    // must be called exactly once and reused — calling it per resize returns
    // None after the first call and silently drops every later resize.
    let mut terminal_size_tx = attached.terminal_size();

    let mut stdout_buf = vec![0u8; 4096];
    // Carries bytes across reads: an incomplete trailing UTF-8 sequence from
    // one chunk is completed by the next instead of being lossy-decoded into
    // replacement characters mid-glyph.
    let mut pending: Vec<u8> = Vec::new();

    loop {
        if stop_flag.load(Ordering::SeqCst) {
            tracing::info!("Shell session stopped by user");
            break;
        }

        tokio::select! {
            // Handle input from frontend
            input = input_rx.recv() => {
                match input {
                    Some(ShellInput::Data(data)) => {
                        if let Err(e) = stdin.write_all(&data).await {
                            tracing::error!("Failed to write to stdin: {}", e);
                            break;
                        }
                        if let Err(e) = stdin.flush().await {
                            tracing::error!("Failed to flush stdin: {}", e);
                        }
                    }
                    Some(ShellInput::Resize { cols, rows }) => {
                        if let Some(terminal_size) = terminal_size_tx.as_mut() {
                            let _ = terminal_size.send(TerminalSize { width: cols, height: rows }).await;
                        }
                    }
                    None => {
                        // Channel closed
                        break;
                    }
                }
            }
            // Handle output from container
            result = stdout.read(&mut stdout_buf) => {
                match result {
                    Ok(0) => {
                        // EOF
                        flush_shell_output(&app, event_name, &mut pending, true);
                        break;
                    }
                    Ok(n) => {
                        pending.extend_from_slice(&stdout_buf[..n]);
                        // Batch: keep draining for a few ms so fast producers
                        // (e.g. `cat` of a large file) emit one IPC event per
                        // ~batch instead of one per 4 KB read.
                        let mut eof = false;
                        while pending.len() < MAX_SHELL_BATCH {
                            match tokio::time::timeout(
                                SHELL_BATCH_WINDOW,
                                stdout.read(&mut stdout_buf),
                            )
                            .await
                            {
                                Ok(Ok(0)) => {
                                    eof = true;
                                    break;
                                }
                                Ok(Ok(n)) => pending.extend_from_slice(&stdout_buf[..n]),
                                Ok(Err(_)) | Err(_) => break,
                            }
                        }
                        flush_shell_output(&app, event_name, &mut pending, eof);
                        if eof {
                            break;
                        }
                    }
                    Err(e) => {
                        let _ = app.emit(event_name, ShellEvent::Error(format!("Read error: {}", e)));
                        break;
                    }
                }
            }
        }
    }
}

/// Send input to a shell session
#[command]
pub async fn shell_send_input(
    shell_manager: State<'_, Arc<ShellSessionManager>>,
    session_id: String,
    input: String,
) -> Result<(), String> {
    let sender = shell_manager
        .get_input_sender(&session_id)
        .await
        .ok_or_else(|| format!("Session {} not found", session_id))?;

    sender
        .send(ShellInput::Data(input.into_bytes()))
        .await
        .map_err(|e| format!("Failed to send input: {}", e))?;

    Ok(())
}

/// Resize terminal for a shell session
#[command]
pub async fn shell_resize(
    shell_manager: State<'_, Arc<ShellSessionManager>>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let sender = shell_manager
        .get_input_sender(&session_id)
        .await
        .ok_or_else(|| format!("Session {} not found", session_id))?;

    sender
        .send(ShellInput::Resize { cols, rows })
        .await
        .map_err(|e| format!("Failed to send resize: {}", e))?;

    tracing::debug!("Resized shell {} to {}x{}", session_id, cols, rows);
    Ok(())
}

/// Close a shell session (idempotent - no error if already closed)
#[command]
pub async fn shell_close(
    shell_manager: State<'_, Arc<ShellSessionManager>>,
    session_id: String,
) -> Result<(), String> {
    if shell_manager.stop_session(&session_id).await {
        shell_manager.remove_session(&session_id).await;
        tracing::info!("Closed shell session {}", session_id);
    } else {
        tracing::debug!("Shell session {} already closed", session_id);
    }
    Ok(())
}

/// List active shell sessions
#[command]
pub async fn shell_list_sessions(
    shell_manager: State<'_, Arc<ShellSessionManager>>,
) -> Result<Vec<String>, String> {
    let sessions = shell_manager.sessions.read().await;
    Ok(sessions.keys().cloned().collect())
}

/// Options for starting a node shell session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeShellOptions {
    pub node_name: String,
    pub image: Option<String>,
}

const DEFAULT_NODE_SHELL_IMAGE: &str = "docker.io/alpine:3.21";
const NODE_SHELL_NAMESPACE: &str = "kube-system";
/// Label selector matching the node-shell debug pods created by Kubeli.
const DEBUG_POD_SELECTOR: &str = "app.kubernetes.io/managed-by=kubeli,kubeli/purpose=node-shell";

/// Delete leftover node-shell debug pods from earlier runs (e.g. after an
/// app crash). Best effort, runs in the background. Called after a successful
/// connect, when no node-shell session can be active yet.
pub fn sweep_orphaned_debug_pods(client: kube::Client) {
    tokio::spawn(async move {
        let pods: Api<Pod> = Api::namespaced(client, NODE_SHELL_NAMESPACE);
        let lp = ListParams::default().labels(DEBUG_POD_SELECTOR);
        let list = match pods.list(&lp).await {
            Ok(list) => list,
            Err(e) => {
                tracing::debug!("Debug pod sweep skipped: {}", e);
                return;
            }
        };
        for pod in list {
            let Some(name) = pod.metadata.name else {
                continue;
            };
            match pods.delete(&name, &DeleteParams::default()).await {
                Ok(_) => tracing::info!("Swept orphaned debug pod {}", name),
                Err(e) => tracing::warn!("Failed to sweep debug pod {}: {}", name, e),
            }
        }
    });
}

/// Start an interactive shell session on a node via a debug pod
#[command]
pub async fn node_shell_start(
    app: AppHandle,
    state: State<'_, AppState>,
    shell_manager: State<'_, Arc<ShellSessionManager>>,
    session_id: String,
    options: NodeShellOptions,
) -> Result<(), String> {
    if shell_manager.is_active(&session_id).await {
        return Err(format!("Session {} already exists", session_id));
    }

    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;
    let event_name = format!("shell-{}", session_id);

    // Verify the node exists
    let nodes: Api<k8s_openapi::api::core::v1::Node> = Api::all(client.clone());
    nodes
        .get(&options.node_name)
        .await
        .map_err(|e| format!("Failed to get node: {}", e))?;

    let image = options
        .image
        .clone()
        .unwrap_or_else(|| DEFAULT_NODE_SHELL_IMAGE.to_string());

    // Create debug pod name
    let debug_pod_name = format!(
        "kubeli-node-shell-{}",
        session_id
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '-')
            .collect::<String>()
            .chars()
            .rev()
            .take(20)
            .collect::<String>()
            .chars()
            .rev()
            .collect::<String>()
    );

    let pods: Api<Pod> = Api::namespaced(client.clone(), NODE_SHELL_NAMESPACE);

    // Build the debug pod spec
    let debug_pod: Pod = serde_json::from_value(serde_json::json!({
        "apiVersion": "v1",
        "kind": "Pod",
        "metadata": {
            "name": debug_pod_name,
            "namespace": NODE_SHELL_NAMESPACE,
            "labels": {
                "app.kubernetes.io/managed-by": "kubeli",
                "kubeli/purpose": "node-shell",
                "kubeli/node": options.node_name,
                "kubeli/session-id": session_id,
            }
        },
        "spec": {
            "nodeName": options.node_name,
            "hostPID": true,
            "hostIPC": true,
            "hostNetwork": true,
            "restartPolicy": "Never",
            "terminationGracePeriodSeconds": 0,
            // Orphaned debug pods (app crash, lost session) self-terminate
            "activeDeadlineSeconds": 3600,
            "priorityClassName": "system-node-critical",
            "tolerations": [{
                "operator": "Exists"
            }],
            "containers": [{
                "name": "node-shell",
                "image": image,
                "command": ["nsenter"],
                "args": ["-t", "1", "-m", "-u", "-i", "-n", "sleep", "14000"],
                "stdin": true,
                "stdinOnce": false,
                "tty": true,
                "securityContext": {
                    "privileged": true
                },
                "resources": {
                    "requests": {
                        "cpu": "10m",
                        "memory": "16Mi"
                    },
                    "limits": {
                        "cpu": "100m",
                        "memory": "64Mi"
                    }
                }
            }]
        }
    }))
    .map_err(|e| format!("Failed to build debug pod spec: {}", e))?;

    // Emit status
    let _ = app.emit(
        &event_name,
        ShellEvent::Output(format!(
            "Creating debug pod on node {}...\r\n",
            options.node_name
        )),
    );

    // Create the debug pod
    pods.create(&PostParams::default(), &debug_pod)
        .await
        .map_err(|e| format!("Failed to create debug pod: {}", e))?;

    tracing::info!(
        "Created debug pod {} on node {}",
        debug_pod_name,
        options.node_name
    );

    // Wait for the pod to be running (up to 60 seconds)
    let _ = app.emit(
        &event_name,
        ShellEvent::Output("Waiting for debug pod to start...\r\n".to_string()),
    );

    let deadline = tokio::time::Instant::now() + tokio::time::Duration::from_secs(60);
    loop {
        if tokio::time::Instant::now() > deadline {
            // Clean up the pod
            let _ = pods.delete(&debug_pod_name, &DeleteParams::default()).await;
            return Err("Timeout waiting for debug pod to become ready".to_string());
        }

        match pods.get(&debug_pod_name).await {
            Ok(pod) => {
                if let Some(status) = &pod.status {
                    if let Some(phase) = &status.phase {
                        if phase == "Running" {
                            break;
                        }
                        if phase == "Failed" || phase == "Succeeded" {
                            let _ = pods.delete(&debug_pod_name, &DeleteParams::default()).await;
                            return Err(format!("Debug pod entered {} phase", phase));
                        }
                    }
                }
            }
            Err(e) => {
                let _ = pods.delete(&debug_pod_name, &DeleteParams::default()).await;
                return Err(format!("Failed to check debug pod status: {}", e));
            }
        }

        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    }

    // Exec into the debug pod with a proper shell (try bash, ash, sh in order)
    let exec_cmd = vec![
        "sh".to_string(),
        "-c".to_string(),
        "((clear && bash) || (clear && ash) || (clear && sh))".to_string(),
    ];
    let attach_params = AttachParams::interactive_tty().container("node-shell");

    let (input_tx, mut input_rx) = mpsc::channel::<ShellInput>(256);
    let stop_flag = Arc::new(AtomicBool::new(false));

    let session = ShellSession {
        stop_flag: stop_flag.clone(),
        input_tx,
        debug_pod: Some(DebugPodInfo {
            pod_name: debug_pod_name.clone(),
            namespace: NODE_SHELL_NAMESPACE.to_string(),
        }),
    };
    shell_manager.add_session(session_id.clone(), session).await;

    let session_id_clone = session_id.clone();
    let shell_manager_clone = Arc::clone(&shell_manager);
    let debug_pod_name_for_log = debug_pod_name.clone();
    let debug_pod_name_clone = debug_pod_name;
    let event_name_clone = event_name.clone();
    let node_name = options.node_name.clone();
    let cleanup_client = client.clone();

    // Emit started event
    let _ = app.emit(
        &event_name,
        ShellEvent::Started {
            session_id: session_id.clone(),
        },
    );

    // Spawn the shell session task
    tokio::spawn(async move {
        match pods
            .exec(&debug_pod_name_clone, exec_cmd, &attach_params)
            .await
        {
            Ok(attached) => {
                let _ = app.emit(
                    &event_name_clone,
                    ShellEvent::Output(format!(
                        "\x1b[32mConnected to node {}\x1b[0m\r\n",
                        node_name
                    )),
                );
                run_shell_session(
                    attached,
                    app.clone(),
                    &event_name_clone,
                    stop_flag,
                    &mut input_rx,
                )
                .await;
            }
            Err(e) => {
                let _ = app.emit(
                    &event_name_clone,
                    ShellEvent::Error(format!("Failed to attach to debug pod: {}", e)),
                );
            }
        }

        // Clean up: delete the debug pod
        let cleanup_pods: Api<Pod> = Api::namespaced(cleanup_client, NODE_SHELL_NAMESPACE);
        match cleanup_pods
            .delete(&debug_pod_name_clone, &DeleteParams::default())
            .await
        {
            Ok(_) => tracing::info!("Cleaned up debug pod {}", debug_pod_name_clone),
            Err(e) => tracing::warn!(
                "Failed to clean up debug pod {}: {}",
                debug_pod_name_clone,
                e
            ),
        }

        shell_manager_clone.remove_session(&session_id_clone).await;
        let _ = app.emit(
            &event_name_clone,
            ShellEvent::Closed {
                session_id: session_id_clone,
            },
        );
    });

    tracing::info!(
        "Started node shell session {} for node {} via pod {}",
        session_id,
        options.node_name,
        debug_pod_name_for_log
    );
    Ok(())
}

/// Clean up a node shell debug pod (called when closing a node shell tab)
#[command]
pub async fn node_shell_cleanup(
    state: State<'_, AppState>,
    shell_manager: State<'_, Arc<ShellSessionManager>>,
    session_id: String,
) -> Result<(), String> {
    // First close the shell session
    if shell_manager.stop_session(&session_id).await {
        // Get debug pod info before removing session
        if let Some(debug_info) = shell_manager.get_debug_pod_info(&session_id).await {
            let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;
            let pods: Api<Pod> = Api::namespaced(client, &debug_info.namespace);
            match pods
                .delete(&debug_info.pod_name, &DeleteParams::default())
                .await
            {
                Ok(_) => tracing::info!("Cleaned up debug pod {}", debug_info.pod_name),
                Err(e) => {
                    tracing::warn!(
                        "Failed to clean up debug pod {}: {}",
                        debug_info.pod_name,
                        e
                    )
                }
            }
        }
        shell_manager.remove_session(&session_id).await;
        tracing::info!("Closed node shell session {}", session_id);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::take_valid_utf8;

    #[test]
    fn keeps_incomplete_utf8_tail_for_next_chunk() {
        // "ä" (0xC3 0xA4) split across two reads
        let mut pending = vec![b'a', 0xC3];
        assert_eq!(take_valid_utf8(&mut pending, false), "a");
        assert_eq!(pending, vec![0xC3]);

        pending.push(0xA4);
        assert_eq!(take_valid_utf8(&mut pending, false), "ä");
        assert!(pending.is_empty());
    }

    #[test]
    fn lossy_decodes_genuinely_invalid_bytes_without_stalling() {
        let mut pending = vec![b'a', 0xFF, b'b'];
        let out = take_valid_utf8(&mut pending, false);
        assert!(out.starts_with('a') && out.ends_with('b'));
        assert!(out.contains('\u{FFFD}'));
        assert!(pending.is_empty());
    }

    #[test]
    fn final_flush_emits_truncated_tail_as_replacement() {
        let mut pending = vec![b'a', 0xC3];
        let out = take_valid_utf8(&mut pending, true);
        assert_eq!(out, "a\u{FFFD}");
        assert!(pending.is_empty());
    }
}
