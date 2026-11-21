use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::{mpsc, RwLock};
use uuid::Uuid;

/// Events sent to the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum AIEvent {
    /// Session started
    SessionStarted { session_id: String },
    /// Streaming message chunk from assistant
    MessageChunk { content: String, done: bool },
    /// Thinking indicator
    Thinking { active: bool },
    /// Tool execution
    ToolExecution {
        tool_name: String,
        status: String,
        output: Option<String>,
    },
    /// Error occurred
    Error { message: String },
    /// Session ended
    SessionEnded { session_id: String },
}

/// Claude CLI streaming JSON message types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ClaudeStreamMessage {
    #[serde(rename = "assistant")]
    Assistant {
        message: AssistantMessage,
        #[serde(default)]
        session_id: Option<String>,
    },
    #[serde(rename = "user")]
    User { message: UserMessage },
    #[serde(rename = "result")]
    Result {
        #[serde(default)]
        subtype: Option<String>,
        #[serde(default)]
        result: Option<Value>,
        #[serde(default)]
        session_id: Option<String>,
        #[serde(default)]
        is_error: Option<bool>,
    },
    #[serde(rename = "system")]
    System {
        subtype: String,
        #[serde(default)]
        message: Option<String>,
        #[serde(default)]
        session_id: Option<String>,
    },
    #[serde(rename = "error")]
    Error {
        error: ErrorInfo,
        #[serde(default)]
        session_id: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantMessage {
    #[serde(default)]
    pub content: Vec<ContentBlock>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub stop_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ContentBlock {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "tool_use")]
    ToolUse {
        id: String,
        name: String,
        input: Value,
    },
    #[serde(rename = "tool_result")]
    ToolResult {
        tool_use_id: String,
        content: String,
        #[serde(default)]
        is_error: Option<bool>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserMessage {
    #[serde(default)]
    pub content: Vec<ContentBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorInfo {
    pub message: String,
    #[serde(default)]
    pub code: Option<String>,
}

/// Input to send to the agent
#[derive(Debug, Clone)]
pub enum AgentInput {
    /// User message with the model/effort chosen for it
    Message(String, super::models::ModelOptions),
    /// Interrupt current generation
    Interrupt,
}

/// Maximum wall-clock time a single CLI generation may run before the child
/// process is killed and an error is reported to the frontend.
const MESSAGE_TIMEOUT: Duration = Duration::from_secs(10 * 60);

/// Outcome of racing a running CLI child against interrupt/stop/timeout.
enum ChildOutcome {
    /// Child exited on its own (successfully or not).
    Exited(std::io::Result<std::process::ExitStatus>),
    /// User interrupted the current generation; the session stays alive.
    Interrupted,
    /// Session was stopped (input channel closed); the loop should end.
    Stopped,
    /// Child exceeded MESSAGE_TIMEOUT.
    TimedOut,
}

/// Race child output streaming + exit against a user interrupt, session stop
/// (input channel closed) and the per-message timeout. This is what keeps
/// `ai_interrupt`/`stop_session` responsive while a CLI process is running.
async fn await_child_outcome<F>(
    stream_and_wait: F,
    input_rx: &mut mpsc::Receiver<AgentInput>,
    timeout: Duration,
    session_id: &str,
) -> ChildOutcome
where
    F: std::future::Future<Output = std::io::Result<std::process::ExitStatus>>,
{
    tokio::pin!(stream_and_wait);
    let sleep = tokio::time::sleep(timeout);
    tokio::pin!(sleep);

    loop {
        tokio::select! {
            result = &mut stream_and_wait => break ChildOutcome::Exited(result),
            input = input_rx.recv() => match input {
                Some(AgentInput::Interrupt) => break ChildOutcome::Interrupted,
                // send_message rejects new messages while is_processing is
                // set; a stray one that lost that race is dropped, not queued.
                Some(AgentInput::Message(..)) => {
                    tracing::warn!(
                        "Dropping message received while session {} is processing",
                        session_id
                    );
                }
                None => break ChildOutcome::Stopped,
            },
            () = &mut sleep => break ChildOutcome::TimedOut,
        }
    }
}

/// Kill a CLI child process and reap it so it cannot linger as a zombie.
async fn kill_child(child: &mut tokio::process::Child, provider_name: &str) {
    // tokio's kill() sends SIGKILL and waits for exit; the extra wait() is a
    // no-op safety net for the start_kill-succeeded-but-wait-failed case.
    if let Err(e) = child.kill().await {
        tracing::warn!("Failed to kill {} process: {}", provider_name, e);
    }
    let _ = child.wait().await;
}

/// AI CLI provider type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum AiCliProvider {
    #[default]
    Claude,
    Codex,
    #[serde(rename = "opencode")]
    OpenCode,
    Droid,
}

impl AiCliProvider {
    fn display_name(self) -> &'static str {
        match self {
            Self::Claude => "Claude",
            Self::Codex => "Codex",
            Self::OpenCode => "OpenCode",
            Self::Droid => "Droid",
        }
    }
}

/// Active agent session
struct AgentSession {
    /// Stop flag
    stop_flag: Arc<AtomicBool>,
    /// Input sender
    input_tx: mpsc::Sender<AgentInput>,
    /// Cluster context this session is for
    cluster_context: String,
    /// Whether the session is currently processing a message
    is_processing: Arc<AtomicBool>,
    /// Which AI CLI provider this session uses
    provider: AiCliProvider,
}

/// Manager for AI agent sessions
pub struct AgentManager {
    /// Active sessions by session ID
    sessions: RwLock<HashMap<String, AgentSession>>,
    /// Claude CLI path cache
    claude_cli_path: RwLock<Option<String>>,
    /// Codex CLI path cache
    codex_cli_path: RwLock<Option<String>>,
    /// OpenCode CLI path cache
    opencode_cli_path: RwLock<Option<String>>,
    /// Droid CLI path cache
    droid_cli_path: RwLock<Option<String>>,
}

impl AgentManager {
    pub fn new() -> Self {
        Self {
            sessions: RwLock::new(HashMap::new()),
            claude_cli_path: RwLock::new(None),
            codex_cli_path: RwLock::new(None),
            opencode_cli_path: RwLock::new(None),
            droid_cli_path: RwLock::new(None),
        }
    }

    /// Get or detect CLI path for the specified provider
    async fn get_cli_path(&self, provider: AiCliProvider) -> Result<String, String> {
        match provider {
            AiCliProvider::Claude => self.get_claude_cli_path().await,
            AiCliProvider::Codex => self.get_codex_cli_path().await,
            AiCliProvider::OpenCode => self.get_opencode_cli_path().await,
            AiCliProvider::Droid => self.get_droid_cli_path().await,
        }
    }

    /// Get or detect Claude CLI path
    async fn get_claude_cli_path(&self) -> Result<String, String> {
        // Check cache first
        {
            let cached = self.claude_cli_path.read().await;
            if let Some(path) = cached.as_ref() {
                return Ok(path.clone());
            }
        }

        // Detect CLI path
        let info = super::cli_detector::CliDetector::check_claude_cli_available().await;
        if let Some(path) = info.cli_path {
            let mut cache = self.claude_cli_path.write().await;
            *cache = Some(path.clone());
            Ok(path)
        } else {
            Err(info
                .error_message
                .unwrap_or_else(|| "Claude CLI not found".to_string()))
        }
    }

    /// Get or detect Codex CLI path
    async fn get_codex_cli_path(&self) -> Result<String, String> {
        // Check cache first
        {
            let cached = self.codex_cli_path.read().await;
            if let Some(path) = cached.as_ref() {
                return Ok(path.clone());
            }
        }

        // Detect CLI path
        let info = super::cli_detector::CliDetector::check_codex_cli_available().await;
        if let Some(path) = info.cli_path {
            let mut cache = self.codex_cli_path.write().await;
            *cache = Some(path.clone());
            Ok(path)
        } else {
            Err(info
                .error_message
                .unwrap_or_else(|| "Codex CLI not found".to_string()))
        }
    }

    /// Get or detect OpenCode CLI path
    async fn get_opencode_cli_path(&self) -> Result<String, String> {
        {
            let cached = self.opencode_cli_path.read().await;
            if let Some(path) = cached.as_ref() {
                return Ok(path.clone());
            }
        }

        let info = super::cli_detector::CliDetector::check_opencode_cli_available().await;
        if let Some(path) = info.cli_path {
            let mut cache = self.opencode_cli_path.write().await;
            *cache = Some(path.clone());
            Ok(path)
        } else {
            Err(info
                .error_message
                .unwrap_or_else(|| "OpenCode CLI not found".to_string()))
        }
    }

    /// Get or detect Droid CLI path
    async fn get_droid_cli_path(&self) -> Result<String, String> {
        {
            let cached = self.droid_cli_path.read().await;
            if let Some(path) = cached.as_ref() {
                return Ok(path.clone());
            }
        }

        let info = super::cli_detector::CliDetector::check_droid_cli_available().await;
        if let Some(path) = info.cli_path {
            let mut cache = self.droid_cli_path.write().await;
            *cache = Some(path.clone());
            Ok(path)
        } else {
            Err(info
                .error_message
                .unwrap_or_else(|| "Droid CLI not found".to_string()))
        }
    }

    /// Start a new agent session
    pub async fn start_session(
        &self,
        app: AppHandle,
        cluster_context: String,
        system_prompt: Option<String>,
        provider: AiCliProvider,
    ) -> Result<String, String> {
        // Verify CLI is available
        let cli_path = self.get_cli_path(provider).await?;
        let session_id = Uuid::new_v4().to_string();

        // Create channels for communication
        let (input_tx, input_rx) = mpsc::channel::<AgentInput>(32);
        let stop_flag = Arc::new(AtomicBool::new(false));
        let is_processing = Arc::new(AtomicBool::new(false));

        // Store session
        let session = AgentSession {
            stop_flag: stop_flag.clone(),
            input_tx,
            cluster_context: cluster_context.clone(),
            is_processing: is_processing.clone(),
            provider,
        };

        {
            let mut sessions = self.sessions.write().await;
            sessions.insert(session_id.clone(), session);
        }

        // Emit session started
        let event_name = format!("ai-session-{}", session_id);
        let _ = app.emit(
            &event_name,
            AIEvent::SessionStarted {
                session_id: session_id.clone(),
            },
        );

        // Spawn message handler task
        let session_id_clone = session_id.clone();
        tokio::spawn(async move {
            Self::message_handler_loop(
                app,
                event_name,
                session_id_clone,
                cli_path,
                system_prompt,
                input_rx,
                stop_flag,
                is_processing,
                provider,
            )
            .await;
        });

        tracing::info!(
            "Started AI session {} for cluster {} with provider {:?}",
            session_id,
            cluster_context,
            provider
        );
        Ok(session_id)
    }

    /// Handle messages by spawning CLI processes per message
    #[allow(clippy::too_many_arguments)]
    async fn message_handler_loop(
        app: AppHandle,
        event_name: String,
        session_id: String,
        cli_path: String,
        system_prompt: Option<String>,
        mut input_rx: mpsc::Receiver<AgentInput>,
        stop_flag: Arc<AtomicBool>,
        is_processing: Arc<AtomicBool>,
        provider: AiCliProvider,
    ) {
        // OpenCode enforces read-only permissions via an opencode.json in a
        // Kubeli-managed working directory; without it the user's own config
        // (default: allow everything) would apply. Fail closed below if this
        // could not be created.
        let opencode_workdir = if provider == AiCliProvider::OpenCode {
            match ensure_opencode_workspace(&app) {
                Ok(dir) => Some(dir),
                Err(e) => {
                    tracing::error!("Failed to create OpenCode workspace: {e}");
                    None
                }
            }
        } else {
            None
        };

        // Claude takes the system prompt from a file so it stays out of argv.
        // Removed when this loop (the session) ends.
        let system_prompt_file = match (provider, system_prompt.as_deref()) {
            (AiCliProvider::Claude, Some(prompt)) => {
                match SessionFile::create(&session_id, "system-prompt.md", prompt) {
                    Ok(file) => Some(file),
                    Err(e) => {
                        tracing::warn!("Failed to write system prompt file: {e}");
                        None
                    }
                }
            }
            _ => None,
        };

        while let Some(input) = input_rx.recv().await {
            if stop_flag.load(Ordering::SeqCst) {
                break;
            }

            match input {
                AgentInput::Message(user_message, model_options) => {
                    if provider == AiCliProvider::OpenCode && opencode_workdir.is_none() {
                        let _ = app.emit(
                            &event_name,
                            AIEvent::Error {
                                message: "OpenCode workspace could not be created; refusing to run without permission config".to_string(),
                            },
                        );
                        continue;
                    }
                    is_processing.store(true, Ordering::SeqCst);

                    // Emit thinking indicator
                    let _ = app.emit(&event_name, AIEvent::Thinking { active: true });

                    // Build command arguments based on provider
                    let mut invocation = build_provider_args(
                        provider,
                        system_prompt.as_deref(),
                        system_prompt_file.as_ref().map(|f| f.path()),
                        &user_message,
                        opencode_workdir.as_deref(),
                    );
                    super::models::apply_model_options(
                        provider,
                        &mut invocation.args,
                        &model_options,
                    );

                    let provider_name = provider.display_name();

                    tracing::debug!(
                        "Spawning {} with args: {:?} in {:?}",
                        provider_name,
                        invocation.args,
                        invocation.cwd
                    );

                    // Spawn CLI process with retry for transient errors
                    let max_attempts = 2u32;
                    let mut was_interrupted = false;

                    for attempt in 1..=max_attempts {
                        let stderr_capture = Arc::new(tokio::sync::Mutex::new(String::new()));

                        match invocation
                            .command(&cli_path)
                            .stdin(Stdio::piped())
                            .stdout(Stdio::piped())
                            .stderr(Stdio::piped())
                            .kill_on_drop(true)
                            .spawn()
                        {
                            Ok(mut child) => {
                                let stdout = child.stdout.take();
                                let stderr = child.stderr.take();

                                // Feed the prompt on stdin from its own task so a
                                // large prompt can't deadlock against a full stdout
                                // pipe. Dropping the handle closes stdin; the CLIs
                                // read until EOF.
                                if let Some(mut child_stdin) = child.stdin.take() {
                                    let input = invocation.stdin.clone().into_bytes();
                                    tokio::spawn(async move {
                                        if let Err(e) = child_stdin.write_all(&input).await {
                                            tracing::debug!(
                                                "Failed to write prompt to CLI stdin: {e}"
                                            );
                                        }
                                    });
                                }

                                // Capture stderr into shared buffer for retry detection
                                if let Some(stderr) = stderr {
                                    let stderr_buf = stderr_capture.clone();
                                    tokio::spawn(async move {
                                        let mut stderr_reader = BufReader::new(stderr).lines();
                                        while let Ok(Some(line)) = stderr_reader.next_line().await {
                                            if !line.trim().is_empty() {
                                                tracing::debug!("{} stderr: {}", "CLI", line);
                                                let mut buf = stderr_buf.lock().await;
                                                buf.push_str(&line);
                                                buf.push('\n');
                                            }
                                        }
                                    });
                                }

                                // Stream output and wait for exit while staying
                                // responsive to Interrupt, session stop and the
                                // per-message timeout. The async block borrows
                                // `child`, so the kill paths below run after the
                                // block (and its borrow) is dropped.
                                let outcome = {
                                    let stream_and_wait = async {
                                        if let Some(stdout) = stdout {
                                            match provider {
                                                AiCliProvider::Claude => {
                                                    Self::process_claude_output(
                                                        &app,
                                                        &event_name,
                                                        stdout,
                                                        None, // stderr already captured above
                                                    )
                                                    .await;
                                                }
                                                AiCliProvider::Codex => {
                                                    Self::process_codex_output(
                                                        &app,
                                                        &event_name,
                                                        stdout,
                                                        None,
                                                    )
                                                    .await;
                                                }
                                                AiCliProvider::OpenCode => {
                                                    Self::process_opencode_output(
                                                        &app,
                                                        &event_name,
                                                        stdout,
                                                        None,
                                                    )
                                                    .await;
                                                }
                                                AiCliProvider::Droid => {
                                                    Self::process_droid_output(
                                                        &app,
                                                        &event_name,
                                                        stdout,
                                                        None,
                                                    )
                                                    .await;
                                                }
                                            }
                                        }
                                        child.wait().await
                                    };
                                    await_child_outcome(
                                        stream_and_wait,
                                        &mut input_rx,
                                        MESSAGE_TIMEOUT,
                                        &session_id,
                                    )
                                    .await
                                };

                                match outcome {
                                    ChildOutcome::Exited(Ok(status)) => {
                                        tracing::debug!(
                                            "{} process exited with: {} (attempt {}/{})",
                                            provider_name,
                                            status,
                                            attempt,
                                            max_attempts
                                        );

                                        // Check if we should retry on failure
                                        if !status.success() && attempt < max_attempts {
                                            let captured = stderr_capture.lock().await.clone();
                                            if is_transient_error(&captured) {
                                                tracing::info!(
                                                    "Transient error detected, retrying in 2s (attempt {}/{})",
                                                    attempt,
                                                    max_attempts
                                                );
                                                let _ = app.emit(
                                                    &event_name,
                                                    AIEvent::MessageChunk {
                                                        content:
                                                            "\n*Transient error — retrying...*\n"
                                                                .to_string(),
                                                        done: false,
                                                    },
                                                );
                                                tokio::time::sleep(std::time::Duration::from_secs(
                                                    2,
                                                ))
                                                .await;
                                                continue;
                                            }
                                        }
                                    }
                                    ChildOutcome::Exited(Err(e)) => {
                                        tracing::error!(
                                            "Failed to wait for {} process: {}",
                                            provider_name,
                                            e
                                        );
                                    }
                                    ChildOutcome::Interrupted => {
                                        tracing::info!(
                                            "Interrupt for session {}: killing {} process",
                                            session_id,
                                            provider_name
                                        );
                                        kill_child(&mut child, provider_name).await;
                                        was_interrupted = true;
                                        // No MessageChunk here: the frontend finalizes the
                                        // message locally on interrupt, and any chunk emitted
                                        // after the kill can race into the user's NEXT message
                                        // once the interrupt flag is cleared.
                                        let _ = app
                                            .emit(&event_name, AIEvent::Thinking { active: false });
                                    }
                                    ChildOutcome::Stopped => {
                                        tracing::info!(
                                            "Session {} stopped: killing {} process",
                                            session_id,
                                            provider_name
                                        );
                                        kill_child(&mut child, provider_name).await;
                                        let _ = app
                                            .emit(&event_name, AIEvent::Thinking { active: false });
                                    }
                                    ChildOutcome::TimedOut => {
                                        tracing::warn!(
                                            "{} process for session {} exceeded {}s timeout, killing",
                                            provider_name,
                                            session_id,
                                            MESSAGE_TIMEOUT.as_secs()
                                        );
                                        kill_child(&mut child, provider_name).await;
                                        let _ = app
                                            .emit(&event_name, AIEvent::Thinking { active: false });
                                        let _ = app.emit(
                                            &event_name,
                                            AIEvent::Error {
                                                message: format!(
                                                    "{} did not finish within {} minutes and was terminated",
                                                    provider_name,
                                                    MESSAGE_TIMEOUT.as_secs() / 60
                                                ),
                                            },
                                        );
                                    }
                                }
                            }
                            Err(e) => {
                                let _ = app.emit(
                                    &event_name,
                                    AIEvent::Error {
                                        message: format!(
                                            "Failed to spawn {}: {}",
                                            provider_name, e
                                        ),
                                    },
                                );
                            }
                        }
                        // If we get here without `continue`, we're done (success or non-transient error)
                        break;
                    }

                    // Done processing, emit final message chunk — except after an
                    // interrupt, where the frontend already finalized locally and a
                    // late done chunk could prematurely finalize the next message.
                    if !was_interrupted {
                        let _ = app.emit(
                            &event_name,
                            AIEvent::MessageChunk {
                                content: String::new(),
                                done: true,
                            },
                        );
                    }
                    is_processing.store(false, Ordering::SeqCst);
                }
                AgentInput::Interrupt => {
                    // Interrupt while a generation is running is handled inside
                    // await_child_outcome; reaching here means nothing is running.
                    tracing::info!(
                        "Interrupt requested for session {} with no generation in progress",
                        session_id
                    );
                }
            }
        }

        // Emit session ended
        let _ = app.emit(&event_name, AIEvent::SessionEnded { session_id });
    }

    /// Process stdout from Claude CLI
    async fn process_claude_output(
        app: &AppHandle,
        event_name: &str,
        stdout: tokio::process::ChildStdout,
        stderr: Option<tokio::process::ChildStderr>,
    ) {
        let mut stdout_reader = BufReader::new(stdout).lines();

        // Also read stderr for debugging
        if let Some(stderr) = stderr {
            tokio::spawn(async move {
                let mut stderr_reader = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = stderr_reader.next_line().await {
                    if !line.trim().is_empty() {
                        tracing::debug!("Claude stderr: {}", line);
                    }
                }
            });
        }

        // Turn off thinking once we start getting output
        let mut thinking_cleared = false;

        while let Ok(Some(line)) = stdout_reader.next_line().await {
            if line.trim().is_empty() {
                continue;
            }

            // Clear thinking indicator on first output
            if !thinking_cleared {
                let _ = app.emit(event_name, AIEvent::Thinking { active: false });
                thinking_cleared = true;
            }

            // Try to parse as JSON streaming message
            match serde_json::from_str::<ClaudeStreamMessage>(&line) {
                Ok(msg) => {
                    Self::handle_stream_message(app, event_name, msg).await;
                }
                Err(e) => {
                    // Not valid JSON - might be plain text or error
                    tracing::debug!("Failed to parse JSON: {} - line: {}", e, line);

                    // If it doesn't look like JSON, emit as text
                    if !line.starts_with('{') {
                        let _ = app.emit(
                            event_name,
                            AIEvent::MessageChunk {
                                content: line,
                                done: false,
                            },
                        );
                    }
                }
            }
        }
    }

    /// Process stdout from Codex CLI (JSONL format)
    async fn process_codex_output(
        app: &AppHandle,
        event_name: &str,
        stdout: tokio::process::ChildStdout,
        stderr: Option<tokio::process::ChildStderr>,
    ) {
        let mut stdout_reader = BufReader::new(stdout).lines();

        // Also read stderr for debugging
        if let Some(stderr) = stderr {
            tokio::spawn(async move {
                let mut stderr_reader = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = stderr_reader.next_line().await {
                    if !line.trim().is_empty() {
                        tracing::debug!("Codex stderr: {}", line);
                    }
                }
            });
        }

        // Turn off thinking once we start getting output
        let mut thinking_cleared = false;

        while let Ok(Some(line)) = stdout_reader.next_line().await {
            if line.trim().is_empty() {
                continue;
            }

            tracing::debug!("Codex output: {}", line);

            // Codex JSONL output format
            if line.starts_with('{') {
                if let Ok(json) = serde_json::from_str::<Value>(&line) {
                    let event_type = json.get("type").and_then(|v| v.as_str()).unwrap_or("");

                    match event_type {
                        "thread.started" => {
                            // Thread started - clear thinking
                            if !thinking_cleared {
                                let _ = app.emit(event_name, AIEvent::Thinking { active: false });
                                thinking_cleared = true;
                            }
                        }
                        "item.completed" => {
                            // Check for agent_message with text
                            if let Some(item) = json.get("item") {
                                let item_type =
                                    item.get("type").and_then(|v| v.as_str()).unwrap_or("");
                                if item_type == "agent_message" {
                                    if let Some(text) = item.get("text").and_then(|v| v.as_str()) {
                                        let _ = app.emit(
                                            event_name,
                                            AIEvent::MessageChunk {
                                                content: text.to_string(),
                                                done: false,
                                            },
                                        );
                                    }
                                } else if item_type == "tool_call" {
                                    // Tool execution
                                    let tool_name =
                                        item.get("name").and_then(|v| v.as_str()).unwrap_or("tool");
                                    let _ = app.emit(
                                        event_name,
                                        AIEvent::ToolExecution {
                                            tool_name: tool_name.to_string(),
                                            status: "running".to_string(),
                                            output: None,
                                        },
                                    );
                                } else if item_type == "tool_output" {
                                    // Tool result
                                    let output =
                                        item.get("output").and_then(|v| v.as_str()).unwrap_or("");
                                    let _ = app.emit(
                                        event_name,
                                        AIEvent::ToolExecution {
                                            tool_name: "tool".to_string(),
                                            status: "completed".to_string(),
                                            output: Some(output.to_string()),
                                        },
                                    );
                                }
                            }
                        }
                        "turn.completed" => {
                            // Turn finished
                            tracing::debug!("Codex turn completed");
                        }
                        "error" => {
                            // Error event
                            let message = json
                                .get("message")
                                .and_then(|v| v.as_str())
                                .unwrap_or("Unknown error");
                            let _ = app.emit(
                                event_name,
                                AIEvent::Error {
                                    message: message.to_string(),
                                },
                            );
                        }
                        _ => {
                            tracing::debug!("Codex event type: {}", event_type);
                        }
                    }
                    continue;
                }
            }

            // Plain text output (fallback)
            if !thinking_cleared {
                let _ = app.emit(event_name, AIEvent::Thinking { active: false });
                thinking_cleared = true;
            }
            let _ = app.emit(
                event_name,
                AIEvent::MessageChunk {
                    content: format!("{}\n", line),
                    done: false,
                },
            );
        }
    }

    /// Process stdout from OpenCode CLI (JSONL with `part`-wrapped events)
    async fn process_opencode_output(
        app: &AppHandle,
        event_name: &str,
        stdout: tokio::process::ChildStdout,
        stderr: Option<tokio::process::ChildStderr>,
    ) {
        let mut stdout_reader = BufReader::new(stdout).lines();

        if let Some(stderr) = stderr {
            tokio::spawn(async move {
                let mut stderr_reader = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = stderr_reader.next_line().await {
                    if !line.trim().is_empty() {
                        tracing::debug!("OpenCode stderr: {}", line);
                    }
                }
            });
        }

        let mut thinking_cleared = false;

        while let Ok(Some(line)) = stdout_reader.next_line().await {
            if line.trim().is_empty() {
                continue;
            }

            tracing::debug!("OpenCode output: {}", line);

            if !line.starts_with('{') {
                if !thinking_cleared {
                    let _ = app.emit(event_name, AIEvent::Thinking { active: false });
                    thinking_cleared = true;
                }
                let _ = app.emit(
                    event_name,
                    AIEvent::MessageChunk {
                        content: format!("{}\n", line),
                        done: false,
                    },
                );
                continue;
            }

            let Ok(json) = serde_json::from_str::<Value>(&line) else {
                continue;
            };

            let event_type = json.get("type").and_then(|v| v.as_str()).unwrap_or("");

            // Clear thinking on the first event
            if !thinking_cleared {
                let _ = app.emit(event_name, AIEvent::Thinking { active: false });
                thinking_cleared = true;
            }

            match event_type {
                "step_start" | "step.start" => {
                    // No-op: indicates a new reasoning/tool step
                }
                "text" => {
                    // OpenCode emits the final text inside `part.text`.
                    let text = json
                        .get("part")
                        .and_then(|p| p.get("text"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    if !text.is_empty() {
                        let _ = app.emit(
                            event_name,
                            AIEvent::MessageChunk {
                                content: text.to_string(),
                                done: false,
                            },
                        );
                    }
                }
                "tool_use" | "tool.use" => {
                    let tool_name = json
                        .get("part")
                        .and_then(|p| p.get("tool"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("tool")
                        .to_string();

                    let state = json.get("part").and_then(|p| p.get("state"));
                    let status = state
                        .and_then(|s| s.get("status"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("running");
                    let normalized_status = match status {
                        "completed" => "completed",
                        "error" => "failed",
                        _ => "running",
                    };

                    let output = state
                        .and_then(|s| s.get("output"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());

                    let _ = app.emit(
                        event_name,
                        AIEvent::ToolExecution {
                            tool_name,
                            status: normalized_status.to_string(),
                            output,
                        },
                    );
                }
                "step_finish" | "step.finish" => {
                    // Logged for debugging; UI signals "done" via the final MessageChunk.
                    tracing::debug!("OpenCode step finished");
                }
                "error" | "session.error" => {
                    let message = opencode_error_message(&json);
                    let _ = app.emit(event_name, AIEvent::Error { message });
                }
                _ => {
                    tracing::debug!("OpenCode event type: {}", event_type);
                }
            }
        }
    }

    /// Process stdout from Droid CLI (Claude-Code-shaped JSONL)
    async fn process_droid_output(
        app: &AppHandle,
        event_name: &str,
        stdout: tokio::process::ChildStdout,
        stderr: Option<tokio::process::ChildStderr>,
    ) {
        let mut stdout_reader = BufReader::new(stdout).lines();

        if let Some(stderr) = stderr {
            tokio::spawn(async move {
                let mut stderr_reader = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = stderr_reader.next_line().await {
                    if !line.trim().is_empty() {
                        tracing::debug!("Droid stderr: {}", line);
                    }
                }
            });
        }

        let mut thinking_cleared = false;

        while let Ok(Some(line)) = stdout_reader.next_line().await {
            if line.trim().is_empty() {
                continue;
            }

            tracing::debug!("Droid output: {}", line);

            if !line.starts_with('{') {
                if !thinking_cleared {
                    let _ = app.emit(event_name, AIEvent::Thinking { active: false });
                    thinking_cleared = true;
                }
                let _ = app.emit(
                    event_name,
                    AIEvent::MessageChunk {
                        content: format!("{}\n", line),
                        done: false,
                    },
                );
                continue;
            }

            let Ok(json) = serde_json::from_str::<Value>(&line) else {
                continue;
            };

            let event_type = json.get("type").and_then(|v| v.as_str()).unwrap_or("");

            if !thinking_cleared {
                let _ = app.emit(event_name, AIEvent::Thinking { active: false });
                thinking_cleared = true;
            }

            match event_type {
                "system" => {
                    let subtype = json.get("subtype").and_then(|v| v.as_str()).unwrap_or("");
                    tracing::debug!("Droid system event: {}", subtype);
                }
                "message" => {
                    let role = json.get("role").and_then(|v| v.as_str()).unwrap_or("");
                    if role == "assistant" {
                        let text = json.get("text").and_then(|v| v.as_str()).unwrap_or("");
                        if !text.is_empty() {
                            let _ = app.emit(
                                event_name,
                                AIEvent::MessageChunk {
                                    content: text.to_string(),
                                    done: false,
                                },
                            );
                        }
                    }
                }
                "tool_call" => {
                    let tool_name = json
                        .get("toolName")
                        .and_then(|v| v.as_str())
                        .unwrap_or("tool")
                        .to_string();
                    let _ = app.emit(
                        event_name,
                        AIEvent::ToolExecution {
                            tool_name,
                            status: "running".to_string(),
                            output: None,
                        },
                    );
                }
                "tool_result" => {
                    let is_error = json
                        .get("isError")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                    let value = json
                        .get("value")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    let _ = app.emit(
                        event_name,
                        AIEvent::ToolExecution {
                            tool_name: "tool".to_string(),
                            status: if is_error { "failed" } else { "completed" }.to_string(),
                            output: value,
                        },
                    );
                }
                "completion" => {
                    let final_text = json.get("finalText").and_then(|v| v.as_str()).unwrap_or("");
                    if !final_text.is_empty() {
                        // Emit any trailing text not already covered by `message` events.
                        let _ = app.emit(
                            event_name,
                            AIEvent::MessageChunk {
                                content: final_text.to_string(),
                                done: false,
                            },
                        );
                    }
                }
                "error" => {
                    let message = json
                        .get("message")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Unknown Droid error")
                        .to_string();
                    let _ = app.emit(event_name, AIEvent::Error { message });
                }
                _ => {
                    tracing::debug!("Droid event type: {}", event_type);
                }
            }
        }
    }

    /// Handle a parsed streaming message from Claude
    async fn handle_stream_message(app: &AppHandle, event_name: &str, msg: ClaudeStreamMessage) {
        match msg {
            ClaudeStreamMessage::Assistant { message, .. } => {
                // Process content blocks
                for block in message.content {
                    match block {
                        ContentBlock::Text { text } => {
                            let _ = app.emit(
                                event_name,
                                AIEvent::MessageChunk {
                                    content: text,
                                    done: false,
                                },
                            );
                        }
                        ContentBlock::ToolUse { name, .. } => {
                            let _ = app.emit(
                                event_name,
                                AIEvent::ToolExecution {
                                    tool_name: name,
                                    status: "running".to_string(),
                                    output: None,
                                },
                            );
                        }
                        ContentBlock::ToolResult {
                            tool_use_id,
                            content,
                            is_error,
                        } => {
                            let status = if is_error.unwrap_or(false) {
                                "failed"
                            } else {
                                "completed"
                            };
                            let _ = app.emit(
                                event_name,
                                AIEvent::ToolExecution {
                                    tool_name: tool_use_id,
                                    status: status.to_string(),
                                    output: Some(content),
                                },
                            );
                        }
                    }
                }
            }
            ClaudeStreamMessage::Result { is_error, .. } if is_error.unwrap_or(false) => {
                tracing::warn!("Claude returned error result");
            }
            ClaudeStreamMessage::System { subtype, .. } => {
                tracing::debug!("Claude system message: {}", subtype);
            }
            ClaudeStreamMessage::Error { error, .. } => {
                let _ = app.emit(
                    event_name,
                    AIEvent::Error {
                        message: error.message,
                    },
                );
            }
            _ => {}
        }
    }

    /// Send a message to an active session
    pub async fn send_message(
        &self,
        session_id: &str,
        message: String,
        options: super::models::ModelOptions,
    ) -> Result<(), String> {
        let sessions = self.sessions.read().await;
        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("Session {} not found", session_id))?;

        // Check if already processing
        if session.is_processing.load(Ordering::SeqCst) {
            return Err("Session is currently processing a message".to_string());
        }

        session
            .input_tx
            .send(AgentInput::Message(message, options.sanitized()))
            .await
            .map_err(|e| format!("Failed to send message: {}", e))?;

        Ok(())
    }

    /// Interrupt the current generation
    pub async fn interrupt(&self, session_id: &str) -> Result<(), String> {
        let sessions = self.sessions.read().await;
        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("Session {} not found", session_id))?;

        session
            .input_tx
            .send(AgentInput::Interrupt)
            .await
            .map_err(|e| format!("Failed to send interrupt: {}", e))?;

        Ok(())
    }

    /// Stop a session
    pub async fn stop_session(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.remove(session_id) {
            session.stop_flag.store(true, Ordering::SeqCst);
            tracing::info!("Stopped AI session {}", session_id);
            Ok(())
        } else {
            Err(format!("Session {} not found", session_id))
        }
    }

    /// List active sessions with their cluster context and provider
    pub async fn list_sessions(&self) -> Vec<(String, String, AiCliProvider)> {
        let sessions = self.sessions.read().await;
        sessions
            .iter()
            .map(|(id, s)| (id.clone(), s.cluster_context.clone(), s.provider))
            .collect()
    }

    /// Check if a session is active
    pub async fn is_session_active(&self, session_id: &str) -> bool {
        let sessions = self.sessions.read().await;
        sessions.contains_key(session_id)
    }

    /// Get the provider for a session (for future use)
    #[allow(dead_code)]
    pub async fn get_session_provider(&self, session_id: &str) -> Option<AiCliProvider> {
        let sessions = self.sessions.read().await;
        sessions.get(session_id).map(|s| s.provider)
    }
}

/// Check if an error message indicates a transient API error worth retrying
fn is_transient_error(text: &str) -> bool {
    let lower = text.to_lowercase();
    // Status codes must stand alone ("HTTP 500"), not appear inside another
    // token ("pod-5000", "1500 items") — a false positive here auto-re-runs
    // a possibly mutating command.
    contains_standalone(&lower, "500")
        || contains_standalone(&lower, "529")
        || lower.contains("overloaded")
        || lower.contains("internal server error")
        || lower.contains("rate limit")
}

/// True if `needle` occurs in `text` without alphanumeric neighbors
/// (equivalent to a \b...\b regex match, without the regex dependency).
fn contains_standalone(text: &str, needle: &str) -> bool {
    let bytes = text.as_bytes();
    let mut start = 0;
    while let Some(pos) = text[start..].find(needle) {
        let abs = start + pos;
        let end = abs + needle.len();
        let before_ok = abs == 0 || !bytes[abs - 1].is_ascii_alphanumeric();
        let after_ok = end >= bytes.len() || !bytes[end].is_ascii_alphanumeric();
        if before_ok && after_ok {
            return true;
        }
        start = abs + 1;
    }
    false
}

/// kubectl subcommands the AI may run — read-only inspection only. This backs
/// the read-only promise in the system prompt; everything else is denied at
/// the CLI permission layer, so prompt injection via cluster data cannot
/// execute arbitrary commands.
const READ_ONLY_KUBECTL: &[&str] = &[
    "kubectl get",
    "kubectl describe",
    "kubectl logs",
    "kubectl top",
    "kubectl explain",
    "kubectl api-resources",
    "kubectl api-versions",
    "kubectl version",
    "kubectl cluster-info",
    "kubectl events",
    "kubectl auth can-i",
];

/// How to run one message: CLI arguments, the prompt written to stdin, and
/// the working directory the CLI must start in (if any).
#[derive(Debug)]
struct ProviderInvocation {
    args: Vec<String>,
    stdin: String,
    cwd: Option<std::path::PathBuf>,
}

impl ProviderInvocation {
    /// The command to spawn for this invocation. With `cwd` set, the child
    /// starts there and `PWD` points there too: OpenCode 2 takes its working
    /// directory from `PWD` before `process.cwd()`, so a `PWD` inherited from
    /// Kubeli's own environment would otherwise win.
    fn command(&self, cli_path: &str) -> tokio::process::Command {
        let mut cmd = super::cli_detector::cli_command(cli_path);
        cmd.args(&self.args);
        if let Some(dir) = &self.cwd {
            cmd.current_dir(dir).env("PWD", dir);
        }
        cmd
    }
}

/// Build the CLI invocation for one message. No provider runs with permission
/// checks disabled: Claude and OpenCode get a read-only kubectl whitelist,
/// Codex a read-only sandbox, Droid low autonomy.
///
/// Prompts never go into argv. They are sent on stdin, and Claude reads its
/// system prompt from `system_prompt_file`. On Windows a CLI may be an npm
/// `.cmd` shim, and Rust refuses to pass arguments containing newlines to
/// batch files; command lines are also length-limited (32K chars on Windows).
fn build_provider_args(
    provider: AiCliProvider,
    system_prompt: Option<&str>,
    system_prompt_file: Option<&std::path::Path>,
    user_message: &str,
    opencode_workdir: Option<&std::path::Path>,
) -> ProviderInvocation {
    // Codex/OpenCode/Droid have no dedicated system prompt flag
    let concat_prompt = || match system_prompt {
        Some(prompt) => format!("{}\n\nUser request: {}", prompt, user_message),
        None => user_message.to_string(),
    };

    match provider {
        AiCliProvider::Claude => {
            // --verbose is required when using -p with --output-format stream-json.
            // --allowedTools whitelists read-only kubectl; in -p mode every other
            // tool request is denied without prompting (no bypass flag).
            // Comma-joined single value: the variadic form would swallow any
            // following positional.
            let allowed = READ_ONLY_KUBECTL
                .iter()
                .map(|c| format!("Bash({c}:*)"))
                .collect::<Vec<_>>()
                .join(",");
            let mut args = vec![
                "-p".to_string(),
                "--verbose".to_string(),
                "--output-format".to_string(),
                "stream-json".to_string(),
                "--allowedTools".to_string(),
                allowed,
            ];
            let stdin = match system_prompt_file {
                Some(file) => {
                    args.push("--system-prompt-file".to_string());
                    args.push(file.to_string_lossy().to_string());
                    user_message.to_string()
                }
                // File could not be written: fall back to prepending the prompt
                None => concat_prompt(),
            };
            ProviderInvocation {
                args,
                stdin,
                cwd: None,
            }
        }
        AiCliProvider::Codex => {
            // Read-only sandbox: model-generated commands get no writes and no
            // network. Codex analyzes the injected cluster context only.
            // `-` reads the prompt from stdin.
            let args = vec![
                "exec".to_string(),
                "--json".to_string(),
                "--sandbox".to_string(),
                "read-only".to_string(),
                "--skip-git-repo-check".to_string(),
                "--ephemeral".to_string(),
                "-".to_string(),
            ];
            ProviderInvocation {
                args,
                stdin: concat_prompt(),
                cwd: None,
            }
        }
        AiCliProvider::OpenCode => {
            // Runs inside the Kubeli-managed workspace whose opencode.json
            // denies everything except read-only kubectl (see
            // ensure_opencode_workspace); the caller fails closed when the
            // workspace is missing. The workspace is the process cwd rather
            // than `--dir`: OpenCode 2 removed that flag and rejects unknown
            // flags, and 1.x uses cwd as well when `--dir` is absent.
            // Without a message argument, `run` reads stdin until EOF.
            let args = vec![
                "run".to_string(),
                "--format".to_string(),
                "json".to_string(),
            ];
            ProviderInvocation {
                args,
                stdin: concat_prompt(),
                cwd: opencode_workdir.map(std::path::Path::to_path_buf),
            }
        }
        AiCliProvider::Droid => {
            // --auto low: only low-risk (read-only) commands run automatically;
            // in non-interactive exec mode everything above is denied.
            // `exec` reads the prompt from piped stdin.
            let args = vec![
                "exec".to_string(),
                "--output-format".to_string(),
                "stream-json".to_string(),
                "--auto".to_string(),
                "low".to_string(),
            ];
            ProviderInvocation {
                args,
                stdin: concat_prompt(),
                cwd: None,
            }
        }
    }
}

/// Message of an OpenCode `error` event. 1.x nests it in `error.data.message`,
/// 2.x puts it in `error.message`.
fn opencode_error_message(json: &Value) -> String {
    let error = json.get("error");
    error
        .and_then(|e| e.get("data"))
        .and_then(|d| d.get("message"))
        .or_else(|| error.and_then(|e| e.get("message")))
        .or_else(|| json.get("message"))
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown OpenCode error")
        .to_string()
}

/// A file that lives as long as a session and is deleted on drop.
struct SessionFile(std::path::PathBuf);

impl SessionFile {
    /// Write `contents` to `kubeli-<session_id>-<name>` in the temp dir,
    /// readable only by the current user on Unix.
    fn create(session_id: &str, name: &str, contents: &str) -> std::io::Result<Self> {
        use std::io::Write;
        let path = std::env::temp_dir().join(format!("kubeli-{session_id}-{name}"));
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create(true).truncate(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let file = SessionFile(path);
        options.open(file.path())?.write_all(contents.as_bytes())?;
        Ok(file)
    }

    fn path(&self) -> &std::path::Path {
        &self.0
    }
}

impl Drop for SessionFile {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

/// Permission config for the OpenCode workspace: deny everything except
/// read-only kubectl.
fn opencode_permission_config() -> String {
    let mut bash = serde_json::Map::new();
    for cmd in READ_ONLY_KUBECTL {
        bash.insert(format!("{cmd} *"), serde_json::Value::from("allow"));
    }
    bash.insert("*".to_string(), serde_json::Value::from("deny"));
    serde_json::json!({
        "$schema": "https://opencode.ai/config.json",
        "permission": {
            "edit": "deny",
            "webfetch": "deny",
            "bash": bash,
        }
    })
    .to_string()
}

/// Create (or refresh) the OpenCode working directory with the restrictive
/// permission config. Rewritten every session so a stale or tampered config
/// cannot widen access.
fn ensure_opencode_workspace(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    use tauri::Manager;
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("opencode-workspace");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::fs::write(dir.join("opencode.json"), opencode_permission_config())
        .map_err(|e| e.to_string())?;
    Ok(dir)
}

impl Default for AgentManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_transient_error_500() {
        assert!(is_transient_error("HTTP 500 Internal Server Error"));
        assert!(is_transient_error("Error: 500"));
    }

    #[test]
    fn test_is_transient_error_529() {
        assert!(is_transient_error("Error: 529 overloaded"));
        assert!(is_transient_error("status: 529"));
    }

    #[test]
    fn test_is_transient_error_overloaded() {
        assert!(is_transient_error("API is overloaded, please retry"));
    }

    #[test]
    fn test_is_transient_error_rate_limit() {
        assert!(is_transient_error("Rate limit exceeded"));
    }

    #[test]
    fn test_is_transient_error_false_for_normal_errors() {
        assert!(!is_transient_error("Permission denied"));
        assert!(!is_transient_error("Invalid API key"));
        assert!(!is_transient_error("Not found"));
        assert!(!is_transient_error(""));
    }

    #[test]
    fn test_provider_serialization() {
        // The frontend expects these exact lowercase tags on the wire.
        assert_eq!(
            serde_json::to_string(&AiCliProvider::Claude).unwrap(),
            "\"claude\""
        );
        assert_eq!(
            serde_json::to_string(&AiCliProvider::Codex).unwrap(),
            "\"codex\""
        );
        assert_eq!(
            serde_json::to_string(&AiCliProvider::OpenCode).unwrap(),
            "\"opencode\""
        );
        assert_eq!(
            serde_json::to_string(&AiCliProvider::Droid).unwrap(),
            "\"droid\""
        );
    }

    #[test]
    fn test_provider_deserialization_roundtrip() {
        for variant in [
            AiCliProvider::Claude,
            AiCliProvider::Codex,
            AiCliProvider::OpenCode,
            AiCliProvider::Droid,
        ] {
            let json = serde_json::to_string(&variant).unwrap();
            let parsed: AiCliProvider = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, variant);
        }
    }

    /// Verify the field paths the OpenCode parser reads exist in a representative
    /// JSONL line. Pinning the schema here means the parser will fail loud if
    /// upstream changes the wire format, instead of silently dropping events.
    #[test]
    fn test_opencode_text_event_field_paths() {
        let line = r#"{"type":"text","timestamp":1735000000123,"sessionID":"ses_abc","part":{"id":"prt_1","type":"text","text":"Hello world"}}"#;
        let json: Value = serde_json::from_str(line).unwrap();
        assert_eq!(json.get("type").and_then(|v| v.as_str()), Some("text"));
        assert_eq!(
            json.get("part")
                .and_then(|p| p.get("text"))
                .and_then(|v| v.as_str()),
            Some("Hello world")
        );
    }

    #[test]
    fn test_opencode_tool_use_event_field_paths() {
        let line = r#"{"type":"tool_use","sessionID":"ses_abc","part":{"callID":"call_1","tool":"bash","state":{"status":"completed","input":{"command":"ls"},"output":"file.txt\n"}}}"#;
        let json: Value = serde_json::from_str(line).unwrap();
        assert_eq!(
            json.get("part")
                .and_then(|p| p.get("tool"))
                .and_then(|v| v.as_str()),
            Some("bash")
        );
        let state = json.get("part").and_then(|p| p.get("state")).unwrap();
        assert_eq!(
            state.get("status").and_then(|v| v.as_str()),
            Some("completed")
        );
        assert_eq!(
            state.get("output").and_then(|v| v.as_str()),
            Some("file.txt\n")
        );
    }

    /// Same idea for Droid's Claude-Code-shaped JSONL.
    #[test]
    fn test_droid_message_event_field_paths() {
        let line = r#"{"type":"message","role":"assistant","id":"m1","text":"Hi from Droid","timestamp":1735000001,"session_id":"uuid"}"#;
        let json: Value = serde_json::from_str(line).unwrap();
        assert_eq!(json.get("type").and_then(|v| v.as_str()), Some("message"));
        assert_eq!(json.get("role").and_then(|v| v.as_str()), Some("assistant"));
        assert_eq!(
            json.get("text").and_then(|v| v.as_str()),
            Some("Hi from Droid")
        );
    }

    #[test]
    fn test_droid_tool_call_and_result_field_paths() {
        let call =
            r#"{"type":"tool_call","id":"t1","toolName":"bash","parameters":{"command":"ls"}}"#;
        let json: Value = serde_json::from_str(call).unwrap();
        assert_eq!(json.get("toolName").and_then(|v| v.as_str()), Some("bash"));

        let result = r#"{"type":"tool_result","id":"t1","isError":false,"value":"output"}"#;
        let json: Value = serde_json::from_str(result).unwrap();
        assert_eq!(json.get("isError").and_then(|v| v.as_bool()), Some(false));
        assert_eq!(json.get("value").and_then(|v| v.as_str()), Some("output"));
    }

    // Regression tests for interrupt/stop/timeout while a CLI child is
    // running (previously input_rx was only polled between messages, so
    // ai_interrupt could not stop a running generation and a hung CLI
    // wedged the session forever). Unix-only: they rely on `sleep`.
    #[cfg(unix)]
    mod child_race {
        use super::super::*;

        fn spawn_sleep(secs: u32) -> tokio::process::Child {
            tokio::process::Command::new("sleep")
                .arg(secs.to_string())
                .kill_on_drop(true)
                .spawn()
                .expect("failed to spawn sleep")
        }

        #[tokio::test]
        async fn interrupt_is_received_while_child_is_running() {
            let mut child = spawn_sleep(30);
            let (tx, mut rx) = mpsc::channel::<AgentInput>(4);

            tx.send(AgentInput::Interrupt).await.unwrap();

            let outcome = await_child_outcome(
                child.wait(),
                &mut rx,
                Duration::from_secs(30),
                "test-session",
            )
            .await;
            assert!(matches!(outcome, ChildOutcome::Interrupted));

            // The interrupt path must kill the child so it does not linger.
            let start = std::time::Instant::now();
            kill_child(&mut child, "test").await;
            assert!(start.elapsed() < Duration::from_secs(5));
            // Reaped: try_wait reports an exit status, no zombie left behind.
            let status = child.try_wait().expect("try_wait failed");
            assert!(status.is_some(), "child should have been reaped");
        }

        #[tokio::test]
        async fn closed_input_channel_signals_stop_while_child_is_running() {
            let mut child = spawn_sleep(30);
            let (tx, mut rx) = mpsc::channel::<AgentInput>(4);
            drop(tx); // stop_session drops the session (and its input_tx)

            let outcome = await_child_outcome(
                child.wait(),
                &mut rx,
                Duration::from_secs(30),
                "test-session",
            )
            .await;
            assert!(matches!(outcome, ChildOutcome::Stopped));

            kill_child(&mut child, "test").await;
        }

        #[tokio::test]
        async fn hung_child_times_out() {
            let mut child = spawn_sleep(30);
            let (_tx, mut rx) = mpsc::channel::<AgentInput>(4);

            let outcome = await_child_outcome(
                child.wait(),
                &mut rx,
                Duration::from_millis(100),
                "test-session",
            )
            .await;
            assert!(matches!(outcome, ChildOutcome::TimedOut));

            kill_child(&mut child, "test").await;
        }

        #[tokio::test]
        async fn normal_exit_yields_exited_and_stray_messages_are_dropped() {
            let mut child = spawn_sleep(0);
            let (tx, mut rx) = mpsc::channel::<AgentInput>(4);
            // A stray Message must not abort the child; it is logged and dropped.
            tx.send(AgentInput::Message("stray".into(), Default::default()))
                .await
                .unwrap();

            let outcome = await_child_outcome(
                child.wait(),
                &mut rx,
                Duration::from_secs(30),
                "test-session",
            )
            .await;
            match outcome {
                ChildOutcome::Exited(Ok(status)) => assert!(status.success()),
                _ => panic!("expected ChildOutcome::Exited(Ok(_))"),
            }
        }
    }

    const ALL_PROVIDERS: [AiCliProvider; 4] = [
        AiCliProvider::Claude,
        AiCliProvider::Codex,
        AiCliProvider::OpenCode,
        AiCliProvider::Droid,
    ];

    #[test]
    fn no_provider_runs_with_permission_bypass_flags() {
        let workdir = std::path::Path::new("/data/opencode-workspace");
        let prompt_file = std::path::Path::new("/tmp/kubeli-x-system-prompt.md");
        for provider in ALL_PROVIDERS {
            let inv = build_provider_args(
                provider,
                Some("sys"),
                Some(prompt_file),
                "hello",
                Some(workdir),
            );
            for arg in &inv.args {
                assert!(
                    !arg.contains("--dangerously-skip-permissions")
                        && !arg.contains("--dangerously-bypass-approvals-and-sandbox")
                        && !arg.contains("--skip-permissions-unsafe"),
                    "{:?} must not bypass permissions: {arg}",
                    provider
                );
            }
        }
    }

    // Windows npm `.cmd` shims reject arguments containing newlines, so no
    // prompt text may end up in argv. Prompts travel on stdin instead.
    #[test]
    fn prompts_go_to_stdin_never_into_args() {
        let system = "You are a Kubernetes assistant.\r\nCluster: demo\nBe brief.";
        let user = "Why is my pod crashing?\nIt restarts every minute.";
        let workdir = std::path::Path::new("/data/opencode-workspace");
        let prompt_file = std::path::Path::new("/tmp/kubeli-x-system-prompt.md");
        for provider in ALL_PROVIDERS {
            for file in [Some(prompt_file), None] {
                let inv = build_provider_args(provider, Some(system), file, user, Some(workdir));
                for arg in &inv.args {
                    assert!(
                        !arg.contains('\n') && !arg.contains('\r'),
                        "{provider:?} arg contains a line break: {arg:?}"
                    );
                    assert!(!arg.contains("pod crashing"), "{provider:?}: {arg:?}");
                }
                assert!(inv.stdin.contains(user), "{provider:?}");
            }
        }
    }

    #[test]
    fn claude_reads_system_prompt_from_file() {
        let file = std::path::Path::new("/tmp/kubeli-x-system-prompt.md");
        let inv = build_provider_args(AiCliProvider::Claude, Some("sys"), Some(file), "hi", None);
        let idx = inv
            .args
            .iter()
            .position(|a| a == "--system-prompt-file")
            .unwrap();
        assert_eq!(inv.args[idx + 1], file.to_string_lossy());
        assert!(!inv.args.iter().any(|a| a == "--system-prompt"));
        assert_eq!(inv.stdin, "hi");
    }

    #[test]
    fn claude_without_prompt_file_prepends_system_prompt_to_stdin() {
        let inv = build_provider_args(AiCliProvider::Claude, Some("sys"), None, "hi", None);
        assert!(!inv.args.iter().any(|a| a.starts_with("--system-prompt")));
        assert_eq!(inv.stdin, "sys\n\nUser request: hi");
    }

    #[test]
    fn session_file_is_private_and_removed_on_drop() {
        let file =
            SessionFile::create("test-session", "system-prompt.md", "line 1\nline 2").unwrap();
        let path = file.path().to_path_buf();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "line 1\nline 2");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(&path).unwrap().permissions().mode();
            assert_eq!(
                mode & 0o077,
                0,
                "system prompt file must not be group/world readable"
            );
        }
        drop(file);
        assert!(!path.exists());
    }

    #[test]
    fn claude_args_whitelist_read_only_kubectl_only() {
        let args = build_provider_args(AiCliProvider::Claude, None, None, "hi", None).args;
        let idx = args.iter().position(|a| a == "--allowedTools").unwrap();
        let allowed = &args[idx + 1];
        assert!(allowed.contains("Bash(kubectl get:*)"));
        assert!(allowed.contains("Bash(kubectl logs:*)"));
        assert!(!allowed.contains("delete"));
        assert!(!allowed.contains("apply"));
        assert!(!allowed.contains("edit"));
    }

    #[test]
    fn codex_args_use_read_only_sandbox_and_stdin_prompt() {
        let args = build_provider_args(AiCliProvider::Codex, None, None, "hi", None).args;
        let idx = args.iter().position(|a| a == "--sandbox").unwrap();
        assert_eq!(args[idx + 1], "read-only");
        assert_eq!(args.last().unwrap(), "-");
    }

    #[test]
    fn droid_args_use_low_autonomy() {
        let args = build_provider_args(AiCliProvider::Droid, None, None, "hi", None).args;
        let idx = args.iter().position(|a| a == "--auto").unwrap();
        assert_eq!(args[idx + 1], "low");
    }

    // OpenCode 2 removed `--dir` from `run` and rejects unknown flags (#561).
    // The managed workspace has to be the process cwd instead.
    #[test]
    fn opencode_runs_in_managed_workdir_without_dir_flag() {
        let workdir = std::path::Path::new("/data/oc");
        let inv = build_provider_args(AiCliProvider::OpenCode, None, None, "hi", Some(workdir));
        assert_eq!(inv.args, ["run", "--format", "json"]);
        assert_eq!(inv.cwd.as_deref(), Some(workdir));
    }

    #[test]
    fn only_opencode_sets_a_working_directory() {
        let workdir = std::path::Path::new("/data/oc");
        for provider in ALL_PROVIDERS {
            let inv = build_provider_args(provider, None, None, "hi", Some(workdir));
            assert_eq!(
                inv.cwd.is_some(),
                provider == AiCliProvider::OpenCode,
                "{provider:?}"
            );
        }
    }

    // OpenCode 2 reads its directory from PWD before process.cwd(), so the
    // spawned command must set both, or Kubeli's own PWD would leak through.
    #[test]
    fn command_starts_in_cwd_with_matching_pwd() {
        let workdir = std::path::Path::new("/data/oc");
        let inv = build_provider_args(AiCliProvider::OpenCode, None, None, "hi", Some(workdir));
        let cmd = inv.command("opencode");
        let std_cmd = cmd.as_std();
        assert_eq!(std_cmd.get_current_dir(), Some(workdir));
        let pwd = std_cmd
            .get_envs()
            .find(|(key, _)| *key == "PWD")
            .and_then(|(_, value)| value);
        assert_eq!(pwd, Some(workdir.as_os_str()));
        let args: Vec<_> = std_cmd.get_args().collect();
        assert_eq!(args, ["run", "--format", "json"]);
    }

    #[test]
    fn command_without_cwd_inherits_working_directory() {
        let inv = build_provider_args(AiCliProvider::Codex, None, None, "hi", None);
        let cmd = inv.command("codex");
        let std_cmd = cmd.as_std();
        assert_eq!(std_cmd.get_current_dir(), None);
        assert!(!std_cmd.get_envs().any(|(key, _)| key == "PWD"));
    }

    #[test]
    fn opencode_error_message_reads_v1_and_v2_shapes() {
        let v1 = serde_json::json!({"type":"error","error":{"name":"APIError","data":{"message":"v1 failed"}}});
        let v2 =
            serde_json::json!({"type":"error","error":{"type":"unknown","message":"v2 failed"}});
        let bare = serde_json::json!({"type":"error"});
        assert_eq!(opencode_error_message(&v1), "v1 failed");
        assert_eq!(opencode_error_message(&v2), "v2 failed");
        assert_eq!(opencode_error_message(&bare), "Unknown OpenCode error");
    }

    /// End-to-end check against the CLIs installed on this machine (needs
    /// network and a logged-in CLI, so it is ignored by default). Spawns each
    /// CLI exactly like a session does, with multi-line prompts. The code word
    /// only appears in the system prompt, so the answer proves both the stdin
    /// prompt and the system prompt (file for Claude) reached the model.
    /// Run with: `cargo test smoke_ -- --ignored --nocapture`
    #[tokio::test]
    #[ignore]
    async fn smoke_installed_clis_read_prompt_from_stdin() {
        use super::super::cli_detector::CliDetector;
        let system = "You are a test fixture.\nThe code word is PINEAPPLE.";
        let user = "What is the code word?\nReply with the code word only.";
        let installed = [
            (
                AiCliProvider::Claude,
                CliDetector::check_claude_cli_available().await,
            ),
            (
                AiCliProvider::Codex,
                CliDetector::check_codex_cli_available().await,
            ),
            (
                AiCliProvider::OpenCode,
                CliDetector::check_opencode_cli_available().await,
            ),
            (
                AiCliProvider::Droid,
                CliDetector::check_droid_cli_available().await,
            ),
        ];
        for (provider, info) in installed {
            let Some(path) = info.cli_path else {
                println!("== {provider:?}: not installed, skipped");
                continue;
            };
            let file = SessionFile::create("smoke-test", "system-prompt.md", system).unwrap();
            let inv = build_provider_args(provider, Some(system), Some(file.path()), user, None);
            println!("== {provider:?}: {path} {:?}", inv.args);
            let mut child = inv
                .command(&path)
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .kill_on_drop(true)
                .spawn()
                .unwrap();
            let mut stdin = child.stdin.take().unwrap();
            let input = inv.stdin.into_bytes();
            tokio::spawn(async move {
                stdin.write_all(&input).await.unwrap();
            });
            let out = tokio::time::timeout(Duration::from_secs(120), child.wait_with_output())
                .await
                .expect("CLI did not exit")
                .unwrap();
            let stdout = String::from_utf8_lossy(&out.stdout);
            println!("exit: {:?}\nstdout:\n{stdout}", out.status);
            println!("stderr:\n{}", String::from_utf8_lossy(&out.stderr));
            assert!(out.status.success(), "{provider:?} failed");
            assert!(
                stdout.contains("PINEAPPLE"),
                "{provider:?} missed the code word"
            );
        }
    }

    #[test]
    fn opencode_permission_config_denies_by_default() {
        let cfg: Value = serde_json::from_str(&opencode_permission_config()).unwrap();
        assert_eq!(cfg["permission"]["bash"]["*"], "deny");
        assert_eq!(cfg["permission"]["edit"], "deny");
        assert_eq!(cfg["permission"]["webfetch"], "deny");
        assert_eq!(cfg["permission"]["bash"]["kubectl get *"], "allow");
        let allows = cfg["permission"]["bash"]
            .as_object()
            .unwrap()
            .values()
            .filter(|v| *v == "allow")
            .count();
        assert_eq!(allows, READ_ONLY_KUBECTL.len());
    }

    // OpenCode evaluates permission rules last-match-wins (2.x documents it in
    // packages/core/src/v1/config/permission.ts). The catch-all deny must come
    // before the kubectl allows in the written file, or it would override them.
    #[test]
    fn opencode_permission_config_writes_catch_all_deny_first() {
        let cfg = opencode_permission_config();
        let deny = cfg.find(r#""*":"deny""#).unwrap();
        let first_allow = cfg.find(r#"":"allow""#).unwrap();
        assert!(deny < first_allow, "{cfg}");
    }

    #[test]
    fn transient_error_requires_standalone_status_codes() {
        assert!(is_transient_error("HTTP 500 Internal Server Error"));
        assert!(is_transient_error("error: 529"));
        assert!(is_transient_error("Overloaded, retry later"));
        assert!(!is_transient_error("deleted 1500 items"));
        assert!(!is_transient_error("pod-5290 restarted"));
        assert!(!is_transient_error("error500x"));
    }
}
