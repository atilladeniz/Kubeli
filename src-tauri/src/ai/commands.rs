use super::agent_manager::{AgentManager, AiCliProvider};
use super::cli_detector::{
    ClaudeCliInfo, CliDetector, CliStatus, CodexCliInfo, DroidCliInfo, OpenCodeCliInfo,
};
use super::context_builder::{ClusterContext, ContextBuilder};
use crate::k8s::AppState;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};
use tauri::{AppHandle, State};

/// AI configuration state
pub struct AIConfigState {
    /// Cached Claude CLI info
    claude_cli_info: RwLock<Option<ClaudeCliInfo>>,
    /// Cached Codex CLI info
    codex_cli_info: RwLock<Option<CodexCliInfo>>,
    /// Cached OpenCode CLI info
    opencode_cli_info: RwLock<Option<OpenCodeCliInfo>>,
    /// Cached Droid CLI info
    droid_cli_info: RwLock<Option<DroidCliInfo>>,
}

impl AIConfigState {
    pub fn new() -> Self {
        Self {
            claude_cli_info: RwLock::new(None),
            codex_cli_info: RwLock::new(None),
            opencode_cli_info: RwLock::new(None),
            droid_cli_info: RwLock::new(None),
        }
    }

    pub fn get_cached_cli_info(&self) -> Option<ClaudeCliInfo> {
        self.get_cached_claude_cli_info()
    }

    pub fn get_cached_claude_cli_info(&self) -> Option<ClaudeCliInfo> {
        self.claude_cli_info.read().ok().and_then(|i| i.clone())
    }

    pub fn set_cached_cli_info(&self, info: ClaudeCliInfo) {
        self.set_cached_claude_cli_info(info)
    }

    pub fn set_cached_claude_cli_info(&self, info: ClaudeCliInfo) {
        if let Ok(mut cli_info) = self.claude_cli_info.write() {
            *cli_info = Some(info);
        }
    }

    pub fn get_cached_codex_cli_info(&self) -> Option<CodexCliInfo> {
        self.codex_cli_info.read().ok().and_then(|i| i.clone())
    }

    pub fn set_cached_codex_cli_info(&self, info: CodexCliInfo) {
        if let Ok(mut cli_info) = self.codex_cli_info.write() {
            *cli_info = Some(info);
        }
    }

    pub fn get_cached_opencode_cli_info(&self) -> Option<OpenCodeCliInfo> {
        self.opencode_cli_info.read().ok().and_then(|i| i.clone())
    }

    pub fn set_cached_opencode_cli_info(&self, info: OpenCodeCliInfo) {
        if let Ok(mut cli_info) = self.opencode_cli_info.write() {
            *cli_info = Some(info);
        }
    }

    pub fn get_cached_droid_cli_info(&self) -> Option<DroidCliInfo> {
        self.droid_cli_info.read().ok().and_then(|i| i.clone())
    }

    pub fn set_cached_droid_cli_info(&self, info: DroidCliInfo) {
        if let Ok(mut cli_info) = self.droid_cli_info.write() {
            *cli_info = Some(info);
        }
    }
}

impl Default for AIConfigState {
    fn default() -> Self {
        Self::new()
    }
}

/// AI authentication status response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIAuthStatus {
    pub cli_available: bool,
    pub cli_authenticated: bool,
    pub cli_version: Option<String>,
    pub cli_path: Option<String>,
    pub error: Option<String>,
}

/// Check if Claude CLI is available
#[tauri::command]
pub async fn ai_check_cli_available(
    ai_state: State<'_, AIConfigState>,
) -> Result<ClaudeCliInfo, String> {
    let info = CliDetector::check_cli_available().await;
    ai_state.set_cached_cli_info(info.clone());
    Ok(info)
}

/// Verify authentication status
#[tauri::command]
pub async fn ai_verify_authentication(
    ai_state: State<'_, AIConfigState>,
) -> Result<AIAuthStatus, String> {
    let cli_info = CliDetector::check_cli_available().await;
    ai_state.set_cached_cli_info(cli_info.clone());

    let cli_authenticated = if let Some(ref path) = cli_info.cli_path {
        CliDetector::verify_authentication(path)
            .await
            .unwrap_or(false)
    } else {
        false
    };

    Ok(AIAuthStatus {
        cli_available: cli_info.cli_path.is_some(),
        cli_authenticated,
        cli_version: cli_info.version,
        cli_path: cli_info.cli_path,
        error: cli_info.error_message,
    })
}

/// Get current authentication status
#[tauri::command]
pub fn ai_get_auth_status(ai_state: State<'_, AIConfigState>) -> Result<AIAuthStatus, String> {
    let cli_info = ai_state.get_cached_cli_info();
    match cli_info {
        Some(info) => Ok(AIAuthStatus {
            cli_available: info.cli_path.is_some(),
            cli_authenticated: info.status == CliStatus::Authenticated,
            cli_version: info.version,
            cli_path: info.cli_path,
            error: info.error_message,
        }),
        None => Ok(AIAuthStatus {
            cli_available: false,
            cli_authenticated: false,
            cli_version: None,
            cli_path: None,
            error: Some("CLI status not checked yet".to_string()),
        }),
    }
}

// ============================================================================
// Codex CLI Commands
// ============================================================================

/// Check if Codex CLI is available
#[tauri::command]
pub async fn ai_check_codex_cli_available(
    ai_state: State<'_, AIConfigState>,
) -> Result<CodexCliInfo, String> {
    let info = CliDetector::check_codex_cli_available().await;
    ai_state.set_cached_codex_cli_info(info.clone());
    Ok(info)
}

/// Verify Codex authentication status
#[tauri::command]
pub async fn ai_verify_codex_authentication(
    ai_state: State<'_, AIConfigState>,
) -> Result<AIAuthStatus, String> {
    let cli_info = CliDetector::check_codex_cli_available().await;
    ai_state.set_cached_codex_cli_info(cli_info.clone());

    let cli_authenticated = if let Some(ref path) = cli_info.cli_path {
        CliDetector::verify_codex_authentication(path)
            .await
            .unwrap_or(false)
    } else {
        false
    };

    Ok(AIAuthStatus {
        cli_available: cli_info.cli_path.is_some(),
        cli_authenticated,
        cli_version: cli_info.version,
        cli_path: cli_info.cli_path,
        error: cli_info.error_message,
    })
}

/// Get Codex authentication status from cache
#[tauri::command]
pub fn ai_get_codex_auth_status(
    ai_state: State<'_, AIConfigState>,
) -> Result<AIAuthStatus, String> {
    let cli_info = ai_state.get_cached_codex_cli_info();
    match cli_info {
        Some(info) => Ok(AIAuthStatus {
            cli_available: info.cli_path.is_some(),
            cli_authenticated: info.status == CliStatus::Authenticated,
            cli_version: info.version,
            cli_path: info.cli_path,
            error: info.error_message,
        }),
        None => Ok(AIAuthStatus {
            cli_available: false,
            cli_authenticated: false,
            cli_version: None,
            cli_path: None,
            error: Some("Codex CLI status not checked yet".to_string()),
        }),
    }
}

// ============================================================================
// OpenCode CLI Commands
// ============================================================================

/// Check if OpenCode CLI is available
#[tauri::command]
pub async fn ai_check_opencode_cli_available(
    ai_state: State<'_, AIConfigState>,
) -> Result<OpenCodeCliInfo, String> {
    let info = CliDetector::check_opencode_cli_available().await;
    ai_state.set_cached_opencode_cli_info(info.clone());
    Ok(info)
}

/// Verify OpenCode authentication status
#[tauri::command]
pub async fn ai_verify_opencode_authentication(
    ai_state: State<'_, AIConfigState>,
) -> Result<AIAuthStatus, String> {
    let cli_info = CliDetector::check_opencode_cli_available().await;
    ai_state.set_cached_opencode_cli_info(cli_info.clone());

    let cli_authenticated = if let Some(ref path) = cli_info.cli_path {
        CliDetector::verify_opencode_authentication(path)
            .await
            .unwrap_or(false)
    } else {
        false
    };

    Ok(AIAuthStatus {
        cli_available: cli_info.cli_path.is_some(),
        cli_authenticated,
        cli_version: cli_info.version,
        cli_path: cli_info.cli_path,
        error: cli_info.error_message,
    })
}

/// Get OpenCode authentication status from cache
#[tauri::command]
pub fn ai_get_opencode_auth_status(
    ai_state: State<'_, AIConfigState>,
) -> Result<AIAuthStatus, String> {
    let cli_info = ai_state.get_cached_opencode_cli_info();
    match cli_info {
        Some(info) => Ok(AIAuthStatus {
            cli_available: info.cli_path.is_some(),
            cli_authenticated: info.status == CliStatus::Authenticated,
            cli_version: info.version,
            cli_path: info.cli_path,
            error: info.error_message,
        }),
        None => Ok(AIAuthStatus {
            cli_available: false,
            cli_authenticated: false,
            cli_version: None,
            cli_path: None,
            error: Some("OpenCode CLI status not checked yet".to_string()),
        }),
    }
}

// ============================================================================
// Droid CLI Commands (Factory.ai)
// ============================================================================

/// Check if Droid CLI is available
#[tauri::command]
pub async fn ai_check_droid_cli_available(
    ai_state: State<'_, AIConfigState>,
) -> Result<DroidCliInfo, String> {
    let info = CliDetector::check_droid_cli_available().await;
    ai_state.set_cached_droid_cli_info(info.clone());
    Ok(info)
}

/// Verify Droid authentication status
#[tauri::command]
pub async fn ai_verify_droid_authentication(
    ai_state: State<'_, AIConfigState>,
) -> Result<AIAuthStatus, String> {
    let cli_info = CliDetector::check_droid_cli_available().await;
    ai_state.set_cached_droid_cli_info(cli_info.clone());

    let cli_authenticated = if let Some(ref path) = cli_info.cli_path {
        CliDetector::verify_droid_authentication(path)
            .await
            .unwrap_or(false)
    } else {
        false
    };

    Ok(AIAuthStatus {
        cli_available: cli_info.cli_path.is_some(),
        cli_authenticated,
        cli_version: cli_info.version,
        cli_path: cli_info.cli_path,
        error: cli_info.error_message,
    })
}

/// Get Droid authentication status from cache
#[tauri::command]
pub fn ai_get_droid_auth_status(
    ai_state: State<'_, AIConfigState>,
) -> Result<AIAuthStatus, String> {
    let cli_info = ai_state.get_cached_droid_cli_info();
    match cli_info {
        Some(info) => Ok(AIAuthStatus {
            cli_available: info.cli_path.is_some(),
            cli_authenticated: info.status == CliStatus::Authenticated,
            cli_version: info.version,
            cli_path: info.cli_path,
            error: info.error_message,
        }),
        None => Ok(AIAuthStatus {
            cli_available: false,
            cli_authenticated: false,
            cli_version: None,
            cli_path: None,
            error: Some("Droid CLI status not checked yet".to_string()),
        }),
    }
}

// ============================================================================
// AI Session Management Commands
// ============================================================================

/// Session info for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub session_id: String,
    pub cluster_context: String,
    pub provider: AiCliProvider,
}

/// Start a new AI session
#[tauri::command]
pub async fn ai_start_session(
    app: AppHandle,
    agent_manager: State<'_, Arc<AgentManager>>,
    cluster_context: String,
    initial_context: Option<String>,
    provider: Option<AiCliProvider>,
) -> Result<String, String> {
    agent_manager
        .start_session(
            app,
            cluster_context,
            initial_context,
            provider.unwrap_or_default(),
        )
        .await
}

/// Send a message to an AI session
#[tauri::command]
pub async fn ai_send_message(
    agent_manager: State<'_, Arc<AgentManager>>,
    session_id: String,
    message: String,
) -> Result<(), String> {
    agent_manager.send_message(&session_id, message).await
}

/// Interrupt the current AI generation
#[tauri::command]
pub async fn ai_interrupt(
    agent_manager: State<'_, Arc<AgentManager>>,
    session_id: String,
) -> Result<(), String> {
    agent_manager.interrupt(&session_id).await
}

/// Stop an AI session
#[tauri::command]
pub async fn ai_stop_session(
    agent_manager: State<'_, Arc<AgentManager>>,
    session_id: String,
) -> Result<(), String> {
    agent_manager.stop_session(&session_id).await
}

/// List active AI sessions
#[tauri::command]
pub async fn ai_list_sessions(
    agent_manager: State<'_, Arc<AgentManager>>,
) -> Result<Vec<SessionInfo>, String> {
    let sessions = agent_manager.list_sessions().await;
    Ok(sessions
        .into_iter()
        .map(|(session_id, cluster_context, provider)| SessionInfo {
            session_id,
            cluster_context,
            provider,
        })
        .collect())
}

/// Check if a session is active
#[tauri::command]
pub async fn ai_is_session_active(
    agent_manager: State<'_, Arc<AgentManager>>,
    session_id: String,
) -> Result<bool, String> {
    Ok(agent_manager.is_session_active(&session_id).await)
}

// ============================================================================
// Context Building Commands
// ============================================================================

/// Build cluster context for AI
#[tauri::command]
pub async fn ai_build_context(
    state: State<'_, AppState>,
    context_name: String,
    current_namespace: Option<String>,
) -> Result<ClusterContext, String> {
    ContextBuilder::build(&state, &context_name, current_namespace).await
}

/// Get system prompt from cluster context
#[tauri::command]
pub async fn ai_get_system_prompt(
    state: State<'_, AppState>,
    context_name: String,
    current_namespace: Option<String>,
) -> Result<String, String> {
    let context = ContextBuilder::build(&state, &context_name, current_namespace).await?;
    Ok(context.to_system_prompt())
}

// ============================================================================
// Session Persistence Commands
// ============================================================================

use super::session_store::{MessageRecord, SessionRecord, SessionSummary, SharedSessionStore};
use chrono::Utc;

/// List saved sessions for a cluster
#[tauri::command]
pub async fn ai_list_saved_sessions(
    session_store: State<'_, SharedSessionStore>,
    cluster_context: String,
) -> Result<Vec<SessionSummary>, String> {
    session_store
        .list_sessions_for_cluster(&cluster_context)
        .await
        .map_err(|e| format!("Failed to list sessions: {}", e))
}

/// Get conversation history for a session
#[tauri::command]
pub async fn ai_get_conversation_history(
    session_store: State<'_, SharedSessionStore>,
    session_id: String,
) -> Result<Vec<MessageRecord>, String> {
    session_store
        .get_messages(&session_id)
        .await
        .map_err(|e| format!("Failed to get conversation history: {}", e))
}

/// Save a new session to the database
#[tauri::command]
pub async fn ai_save_session(
    session_store: State<'_, SharedSessionStore>,
    session_id: String,
    cluster_context: String,
    permission_mode: String,
    title: Option<String>,
) -> Result<(), String> {
    let now = Utc::now();
    let session = SessionRecord {
        session_id,
        cluster_context,
        created_at: now,
        last_active_at: now,
        permission_mode,
        title,
    };
    session_store
        .save_session(&session)
        .await
        .map_err(|e| format!("Failed to save session: {}", e))
}

/// Save a message to the database
#[tauri::command]
pub async fn ai_save_message(
    session_store: State<'_, SharedSessionStore>,
    message_id: String,
    session_id: String,
    role: String,
    content: String,
    tool_calls: Option<String>,
) -> Result<(), String> {
    let message = MessageRecord {
        message_id,
        session_id,
        role,
        content,
        tool_calls,
        timestamp: Utc::now(),
    };
    session_store
        .save_message(&message)
        .await
        .map_err(|e| format!("Failed to save message: {}", e))
}

/// Update a message in the database
#[tauri::command]
pub async fn ai_update_message(
    session_store: State<'_, SharedSessionStore>,
    message_id: String,
    content: String,
    tool_calls: Option<String>,
) -> Result<(), String> {
    session_store
        .update_message(&message_id, &content, tool_calls.as_deref())
        .await
        .map_err(|e| format!("Failed to update message: {}", e))
}

/// Update session title
#[tauri::command]
pub async fn ai_update_session_title(
    session_store: State<'_, SharedSessionStore>,
    session_id: String,
    title: String,
) -> Result<(), String> {
    session_store
        .update_session_title(&session_id, &title)
        .await
        .map_err(|e| format!("Failed to update session title: {}", e))
}

/// Delete a saved session
#[tauri::command]
pub async fn ai_delete_saved_session(
    session_store: State<'_, SharedSessionStore>,
    session_id: String,
) -> Result<(), String> {
    session_store
        .delete_session(&session_id)
        .await
        .map_err(|e| format!("Failed to delete session: {}", e))?;
    tracing::info!("Deleted saved session: {}", session_id);
    Ok(())
}

/// Delete all sessions for a cluster
#[tauri::command]
pub async fn ai_delete_cluster_sessions(
    session_store: State<'_, SharedSessionStore>,
    cluster_context: String,
) -> Result<(), String> {
    session_store
        .delete_sessions_for_cluster(&cluster_context)
        .await
        .map_err(|e| format!("Failed to delete cluster sessions: {}", e))?;
    tracing::info!("Deleted all sessions for cluster: {}", cluster_context);
    Ok(())
}

/// Get conversation context for resuming a session
#[tauri::command]
pub async fn ai_get_resume_context(
    session_store: State<'_, SharedSessionStore>,
    session_id: String,
) -> Result<String, String> {
    session_store
        .build_conversation_context(&session_id)
        .await
        .map_err(|e| format!("Failed to build resume context: {}", e))
}

/// Clean up old sessions
#[tauri::command]
pub async fn ai_cleanup_old_sessions(
    session_store: State<'_, SharedSessionStore>,
    days: i64,
) -> Result<usize, String> {
    session_store
        .cleanup_old_sessions(days)
        .await
        .map_err(|e| format!("Failed to cleanup old sessions: {}", e))
}
