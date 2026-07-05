//! MCP (Model Context Protocol) Commands
//!
//! Tauri commands for managing MCP server configuration in IDEs.

use crate::mcp::ide_config::{
    detect_installed_ides, install_mcp_config, uninstall_mcp_config, IdeStatus, IdeType,
};
use serde::{Deserialize, Serialize};

/// IDE information for the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdeInfo {
    pub id: String,
    pub name: String,
    pub installed: bool,
    pub config_path: Option<String>,
    pub mcp_configured: bool,
}

impl From<IdeStatus> for IdeInfo {
    fn from(status: IdeStatus) -> Self {
        Self {
            id: match status.ide {
                IdeType::ClaudeCode => "claude_code".to_string(),
                IdeType::Codex => "codex".to_string(),
                IdeType::VSCode => "vscode".to_string(),
                IdeType::Cursor => "cursor".to_string(),
            },
            name: status.name,
            installed: status.installed,
            config_path: status.config_path,
            mcp_configured: status.mcp_configured,
        }
    }
}

fn parse_ide_type(id: &str) -> Result<IdeType, String> {
    match id {
        "claude_code" => Ok(IdeType::ClaudeCode),
        "codex" => Ok(IdeType::Codex),
        "vscode" => Ok(IdeType::VSCode),
        "cursor" => Ok(IdeType::Cursor),
        _ => Err(format!("Unknown IDE type: {}", id)),
    }
}

/// Detect all installed IDEs and their MCP configuration status.
/// Async so the filesystem probing runs off the main thread — sync commands
/// block the UI thread and froze the first MCP tab open.
#[tauri::command]
pub async fn mcp_detect_ides() -> Vec<IdeInfo> {
    tauri::async_runtime::spawn_blocking(|| {
        detect_installed_ides()
            .into_iter()
            .map(IdeInfo::from)
            .collect()
    })
    .await
    .unwrap_or_default()
}

/// Install MCP configuration for a specific IDE.
/// Async + blocking pool: config writes do file I/O and must not run on the
/// main thread (same reasoning as mcp_detect_ides).
#[tauri::command]
pub async fn mcp_install_ide(ide_id: String) -> Result<(), String> {
    let ide = parse_ide_type(&ide_id)?;
    tauri::async_runtime::spawn_blocking(move || install_mcp_config(ide))
        .await
        .map_err(|e| format!("Install task failed: {e}"))?
}

/// Uninstall MCP configuration for a specific IDE
#[tauri::command]
pub async fn mcp_uninstall_ide(ide_id: String) -> Result<(), String> {
    let ide = parse_ide_type(&ide_id)?;
    tauri::async_runtime::spawn_blocking(move || uninstall_mcp_config(ide))
        .await
        .map_err(|e| format!("Uninstall task failed: {e}"))?
}

/// Check if running in debug/development mode
fn is_dev_mode() -> bool {
    if let Ok(exe_path) = std::env::current_exe() {
        let path_str = exe_path.to_string_lossy();
        return path_str.contains("/target/debug/")
            || path_str.contains("\\target\\debug\\")
            || path_str.contains("/target/release/")
            || path_str.contains("\\target\\release\\");
    }
    false
}

/// Get the Kubeli executable path (for manual configuration)
/// Automatically detects dev vs production mode
#[tauri::command]
pub fn mcp_get_kubeli_path() -> String {
    // In dev mode, use the current executable path
    if is_dev_mode() {
        if let Ok(exe_path) = std::env::current_exe() {
            return exe_path.to_string_lossy().to_string();
        }
    }

    #[cfg(target_os = "macos")]
    {
        "/Applications/Kubeli.app/Contents/MacOS/Kubeli".to_string()
    }
    #[cfg(target_os = "linux")]
    {
        std::env::current_exe()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| "/usr/bin/kubeli".to_string())
    }
    #[cfg(target_os = "windows")]
    {
        std::env::current_exe()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| "C:\\Program Files\\Kubeli\\Kubeli.exe".to_string())
    }
}
