use crate::ai::permissions::{ApprovalRequest, PermissionMode, SharedPermissionChecker};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
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
    /// Tool execution requires approval
    ApprovalRequired {
        request_id: String,
        tool_name: String,
        command_preview: String,
        reason: String,
        severity: String,
    },
    /// Approval response (for UI feedback)
    ApprovalResponse { request_id: String, approved: bool },
    /// Tool was blocked by permission system
    ToolBlocked { tool_name: String, reason: String },
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
    /// User message
    Message(String),
    /// Interrupt current generation
    Interrupt,
}

/// AI CLI provider type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum AiCliProvider {
    #[default]
    Claude,
    Codex,
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
    /// Permission checker for tool executions
    permission_checker: SharedPermissionChecker,
}

impl AgentManager {
    pub fn new() -> Self {
        Self {
            sessions: RwLock::new(HashMap::new()),
            claude_cli_path: RwLock::new(None),
            codex_cli_path: RwLock::new(None),
            permission_checker: crate::ai::permissions::create_permission_checker(),
        }
    }

    /// Get the permission checker (for future tool-level integration)
    #[allow(dead_code)]
    pub fn permission_checker(&self) -> &SharedPermissionChecker {
        &self.permission_checker
    }

    /// Set permission mode
    pub async fn set_permission_mode(&self, mode: PermissionMode) {
        self.permission_checker.set_mode(mode).await;
    }

    /// Get current permission mode
    pub async fn get_permission_mode(&self) -> PermissionMode {
        self.permission_checker.get_mode().await
    }

    /// Add sandboxed namespace for AcceptEdits mode
    pub async fn add_sandboxed_namespace(&self, namespace: String) {
        self.permission_checker
            .add_sandboxed_namespace(namespace)
            .await;
    }

    /// Remove sandboxed namespace
    pub async fn remove_sandboxed_namespace(&self, namespace: &str) {
        self.permission_checker
            .remove_sandboxed_namespace(namespace)
            .await;
    }

    /// Get sandboxed namespaces
    pub async fn get_sandboxed_namespaces(&self) -> Vec<String> {
        self.permission_checker.get_sandboxed_namespaces().await
    }

    /// Submit approval for a pending request
    pub async fn submit_approval(
        &self,
        request_id: &str,
        approved: bool,
        reason: Option<String>,
    ) -> Result<(), String> {
        self.permission_checker
            .submit_approval(request_id, approved, reason)
            .await
    }

    /// List pending approvals
    pub async fn list_pending_approvals(&self) -> Vec<ApprovalRequest> {
        self.permission_checker.list_pending_approvals().await
    }

    /// Get or detect CLI path for the specified provider
    async fn get_cli_path(&self, provider: AiCliProvider) -> Result<String, String> {
        match provider {
            AiCliProvider::Claude => self.get_claude_cli_path().await,
            AiCliProvider::Codex => self.get_codex_cli_path().await,
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
        while let Some(input) = input_rx.recv().await {
            if stop_flag.load(Ordering::SeqCst) {
                break;
            }

            match input {
                AgentInput::Message(user_message) => {
                    is_processing.store(true, Ordering::SeqCst);

                    // Emit thinking indicator
                    let _ = app.emit(&event_name, AIEvent::Thinking { active: true });

                    // Build command arguments based on provider
                    let args = match provider {
                        AiCliProvider::Claude => {
                            // Claude CLI args
                            // --verbose is required when using -p with --output-format stream-json
                            // --dangerously-skip-permissions allows tools to run without asking
                            let mut args = vec![
                                "-p".to_string(),
                                "--verbose".to_string(),
                                "--output-format".to_string(),
                                "stream-json".to_string(),
                                "--dangerously-skip-permissions".to_string(),
                            ];

                            // Add system prompt if provided
                            if let Some(ref prompt) = system_prompt {
                                args.push("--system-prompt".to_string());
                                args.push(prompt.clone());
                            }

                            // Add the user message as the prompt argument
                            args.push(user_message.clone());
                            args
                        }
                        AiCliProvider::Codex => {
                            // Codex CLI uses 'exec' subcommand for non-interactive mode
                            // --json outputs JSONL events
                            // --dangerously-bypass-approvals-and-sandbox skips confirmations
                            let mut args = vec![
                                "exec".to_string(),
                                "--json".to_string(),
                                "--dangerously-bypass-approvals-and-sandbox".to_string(),
                            ];

                            // Combine system prompt with user message if provided
                            let full_message = if let Some(ref prompt) = system_prompt {
                                format!("{}\n\nUser request: {}", prompt, user_message)
                            } else {
                                user_message.clone()
                            };

                            // Add the combined message as the prompt
                            args.push(full_message);
                            args
                        }
                    };

                    let provider_name = match provider {
                        AiCliProvider::Claude => "Claude",
                        AiCliProvider::Codex => "Codex",
                    };

                    tracing::debug!("Spawning {} with args: {:?}", provider_name, args);

                    // Spawn CLI process with retry for transient errors
                    let extended_path = super::cli_detector::get_extended_path();
                    let max_attempts = 2u32;

                    for attempt in 1..=max_attempts {
                        let stderr_capture = Arc::new(tokio::sync::Mutex::new(String::new()));

                        match Command::new(&cli_path)
                            .args(&args)
                            .env("PATH", &extended_path)
                            .stdout(Stdio::piped())
                            .stderr(Stdio::piped())
                            .kill_on_drop(true)
                            .spawn()
                        {
                            Ok(mut child) => {
                                let stdout = child.stdout.take();
                                let stderr = child.stderr.take();

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
                                                None, // stderr already captured above
                                            )
                                            .await;
                                        }
                                    }
                                }

                                // Wait for process to finish
                                match child.wait().await {
                                    Ok(status) => {
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
                                    Err(e) => {
                                        tracing::error!(
                                            "Failed to wait for {} process: {}",
                                            provider_name,
                                            e
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

                    // Done processing, emit final message chunk
                    let _ = app.emit(
                        &event_name,
                        AIEvent::MessageChunk {
                            content: String::new(),
                            done: true,
                        },
                    );
                    is_processing.store(false, Ordering::SeqCst);
                }
                AgentInput::Interrupt => {
                    tracing::info!("Interrupt requested for session {}", session_id);
                    // Process will be killed when child goes out of scope
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
            ClaudeStreamMessage::Result { is_error, .. } => {
                if is_error.unwrap_or(false) {
                    tracing::warn!("Claude returned error result");
                }
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
    pub async fn send_message(&self, session_id: &str, message: String) -> Result<(), String> {
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
            .send(AgentInput::Message(message))
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
    lower.contains("500")
        || lower.contains("529")
        || lower.contains("overloaded")
        || lower.contains("internal server error")
        || lower.contains("rate limit")
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
}
