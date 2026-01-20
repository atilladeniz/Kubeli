use crate::k8s::AppState;
use futures::SinkExt;
use k8s_openapi::api::core::v1::Pod;
use kube::api::{Api, AttachParams, AttachedProcess, TerminalSize};
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

/// Run the shell session handling stdin/stdout
async fn run_shell_session(
    mut attached: AttachedProcess,
    app: AppHandle,
    event_name: &str,
    stop_flag: Arc<AtomicBool>,
    input_rx: &mut mpsc::Receiver<ShellInput>,
) {
    let mut stdin = attached.stdin().expect("stdin available after attach");
    let mut stdout = attached.stdout().expect("stdout available after attach");

    let mut stdout_buf = vec![0u8; 4096];

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
                        // Terminal resize is handled separately via AttachedProcess
                        if let Some(mut terminal_size) = attached.terminal_size() {
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
                        break;
                    }
                    Ok(n) => {
                        let output = String::from_utf8_lossy(&stdout_buf[..n]).to_string();
                        let _ = app.emit(event_name, ShellEvent::Output(output));
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

/// Close a shell session
#[command]
pub async fn shell_close(
    shell_manager: State<'_, Arc<ShellSessionManager>>,
    session_id: String,
) -> Result<(), String> {
    if shell_manager.stop_session(&session_id).await {
        shell_manager.remove_session(&session_id).await;
        tracing::info!("Closed shell session {}", session_id);
        Ok(())
    } else {
        Err(format!("Session {} not found", session_id))
    }
}

/// List active shell sessions
#[command]
pub async fn shell_list_sessions(
    shell_manager: State<'_, Arc<ShellSessionManager>>,
) -> Result<Vec<String>, String> {
    let sessions = shell_manager.sessions.read().await;
    Ok(sessions.keys().cloned().collect())
}
