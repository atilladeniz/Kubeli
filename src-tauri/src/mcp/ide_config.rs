//! IDE Configuration Management
//!
//! Handles installation and removal of MCP server configuration for various IDEs.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::ai::cli_detector::get_extended_path;

/// Supported IDE types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IdeType {
    ClaudeCode,
    Codex,
    VSCode,
    Cursor,
}

impl IdeType {
    /// Get the config file path for this IDE
    pub fn config_path(&self) -> Option<PathBuf> {
        let home = dirs::home_dir()?;

        match self {
            // Claude Code uses ~/.claude.json for user-level config
            IdeType::ClaudeCode => Some(home.join(".claude.json")),
            IdeType::Codex => Some(home.join(".codex").join("config.toml")),
            IdeType::VSCode => {
                #[cfg(target_os = "macos")]
                {
                    Some(
                        home.join("Library")
                            .join("Application Support")
                            .join("Code")
                            .join("User")
                            .join("settings.json"),
                    )
                }
                #[cfg(target_os = "linux")]
                {
                    Some(
                        home.join(".config")
                            .join("Code")
                            .join("User")
                            .join("settings.json"),
                    )
                }
                #[cfg(target_os = "windows")]
                {
                    dirs::config_dir().map(|c| c.join("Code").join("User").join("settings.json"))
                }
            }
            IdeType::Cursor => Some(home.join(".cursor").join("mcp.json")),
        }
    }

    /// Check if this IDE is installed
    pub fn is_installed(&self) -> bool {
        match self {
            IdeType::ClaudeCode => find_claude_binary().is_some(),
            _ => {
                // For other IDEs, check if config directory exists
                if let Some(path) = self.config_path() {
                    path.parent().map(|p| p.exists()).unwrap_or(false)
                } else {
                    false
                }
            }
        }
    }

    /// Human readable name
    pub fn display_name(&self) -> &'static str {
        match self {
            IdeType::ClaudeCode => "Claude Code",
            IdeType::Codex => "Codex (OpenAI)",
            IdeType::VSCode => "VS Code",
            IdeType::Cursor => "Cursor",
        }
    }
}

/// IDE installation status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdeStatus {
    pub ide: IdeType,
    pub name: String,
    pub installed: bool,
    pub config_path: Option<String>,
    pub mcp_configured: bool,
}

/// Check if running in debug/development mode
fn is_dev_mode() -> bool {
    // Check if current executable is in a debug/target directory
    if let Ok(exe_path) = std::env::current_exe() {
        let path_str = exe_path.to_string_lossy();
        return path_str.contains("/target/debug/")
            || path_str.contains("\\target\\debug\\")
            || path_str.contains("/target/release/")
            || path_str.contains("\\target\\release\\");
    }
    false
}

/// Get Kubeli executable path
/// Automatically detects dev vs production mode
fn get_kubeli_path() -> String {
    // First check if we're in dev mode
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
        // Try to find the AppImage or installed binary
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

/// Find the claude binary path, checking common install locations.
/// Tauri GUI apps don't inherit the full shell PATH, so we check known paths directly.
fn find_claude_binary() -> Option<String> {
    // On Windows, check %USERPROFILE%\.local\bin\claude.exe
    #[cfg(target_os = "windows")]
    let paths = {
        let home = std::env::var("USERPROFILE").unwrap_or_default();
        vec![format!("{}\\.local\\bin\\claude.exe", home)]
    };

    #[cfg(not(target_os = "windows"))]
    let paths = {
        let home = std::env::var("HOME").unwrap_or_default();
        // Check known installation paths in order of preference
        vec![
            // Native installation (recommended) — ~/.local/bin/claude
            format!("{}/.local/bin/claude", home),
            // Homebrew (Apple Silicon)
            "/opt/homebrew/bin/claude".to_string(),
            // Homebrew (Intel) or system-wide
            "/usr/local/bin/claude".to_string(),
            // Legacy npm global
            format!("{}/.npm-global/bin/claude", home),
        ]
    };

    for path in &paths {
        if std::path::Path::new(path).exists() {
            return Some(path.clone());
        }
    }

    // Fallback: use `which` with extended PATH
    let extended_path = get_extended_path();
    if let Ok(output) = std::process::Command::new("which")
        .arg("claude")
        .env("PATH", &extended_path)
        .output()
    {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Some(path);
            }
        }
    }

    None
}

/// Detect all installed IDEs
pub fn detect_installed_ides() -> Vec<IdeStatus> {
    let ides = [
        IdeType::ClaudeCode,
        IdeType::Codex,
        IdeType::VSCode,
        IdeType::Cursor,
    ];

    ides.iter()
        .map(|ide| {
            let config_path = ide.config_path();
            let mcp_configured = config_path
                .as_ref()
                .map(|p| check_mcp_configured(*ide, p))
                .unwrap_or(false);

            IdeStatus {
                ide: *ide,
                name: ide.display_name().to_string(),
                installed: ide.is_installed(),
                config_path: config_path.map(|p| p.to_string_lossy().to_string()),
                mcp_configured,
            }
        })
        .collect()
}

/// Check if MCP is already configured for an IDE
fn check_mcp_configured(ide: IdeType, path: &PathBuf) -> bool {
    match ide {
        IdeType::ClaudeCode => {
            // Use Claude CLI to check if kubeli is configured
            let Some(claude) = find_claude_binary() else {
                return false;
            };
            if let Ok(output) = std::process::Command::new(&claude)
                .args(["mcp", "get", "kubeli"])
                .output()
            {
                return output.status.success();
            }
            false
        }
        IdeType::Cursor => {
            // JSON format - check for "kubeli" in mcpServers
            if !path.exists() {
                return false;
            }
            let content = match std::fs::read_to_string(path) {
                Ok(c) => c,
                Err(_) => return false,
            };
            content.contains("\"kubeli\"") && content.contains("mcpServers")
        }
        IdeType::Codex => {
            // TOML format - check for [mcp_servers.kubeli]
            if !path.exists() {
                return false;
            }
            let content = match std::fs::read_to_string(path) {
                Ok(c) => c,
                Err(_) => return false,
            };
            content.contains("[mcp_servers.kubeli]")
        }
        IdeType::VSCode => {
            // JSON format - check for "kubeli" in mcp.servers
            if !path.exists() {
                return false;
            }
            let content = match std::fs::read_to_string(path) {
                Ok(c) => c,
                Err(_) => return false,
            };
            content.contains("\"kubeli\"") && content.contains("mcp.servers")
        }
    }
}

/// Install MCP configuration for an IDE
pub fn install_mcp_config(ide: IdeType) -> Result<(), String> {
    let config_path = ide
        .config_path()
        .ok_or_else(|| format!("Could not determine config path for {}", ide.display_name()))?;

    // Ensure parent directory exists
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let kubeli_path = get_kubeli_path();

    match ide {
        IdeType::ClaudeCode => install_claude_code_config(&config_path, &kubeli_path),
        IdeType::Codex => install_codex_config(&config_path, &kubeli_path),
        IdeType::VSCode => install_vscode_config(&config_path, &kubeli_path),
        IdeType::Cursor => install_cursor_config(&config_path, &kubeli_path),
    }
}

/// Uninstall MCP configuration for an IDE
pub fn uninstall_mcp_config(ide: IdeType) -> Result<(), String> {
    let config_path = ide
        .config_path()
        .ok_or_else(|| format!("Could not determine config path for {}", ide.display_name()))?;

    if !config_path.exists() {
        return Ok(()); // Nothing to uninstall
    }

    match ide {
        IdeType::ClaudeCode => uninstall_claude_code_config(&config_path),
        IdeType::Codex => uninstall_codex_config(&config_path),
        IdeType::VSCode => uninstall_vscode_config(&config_path),
        IdeType::Cursor => uninstall_cursor_config(&config_path),
    }
}

// --- Claude Code ---
// Use the Claude CLI to manage MCP servers properly.
// This ensures correct handling of the complex ~/.claude.json structure.

fn install_claude_code_config(_path: &PathBuf, kubeli_path: &str) -> Result<(), String> {
    let claude = find_claude_binary()
        .ok_or_else(|| "Claude Code CLI not found. Is it installed?".to_string())?;

    // First try to remove any existing kubeli config
    let _ = std::process::Command::new(&claude)
        .args(["mcp", "remove", "kubeli"])
        .output();

    // Add kubeli as a user-scope MCP server using the CLI
    let output = std::process::Command::new(&claude)
        .args([
            "mcp",
            "add",
            "kubeli",
            "--scope",
            "user",
            "--transport",
            "stdio",
            "--",
            kubeli_path,
            "--mcp",
        ])
        .output()
        .map_err(|e| format!("Failed to run claude CLI: {}. Is Claude Code installed?", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to add MCP server: {}", stderr));
    }

    Ok(())
}

fn uninstall_claude_code_config(_path: &PathBuf) -> Result<(), String> {
    let claude = find_claude_binary()
        .ok_or_else(|| "Claude Code CLI not found. Is it installed?".to_string())?;

    // Remove kubeli MCP server using the CLI
    let output = std::process::Command::new(&claude)
        .args(["mcp", "remove", "kubeli"])
        .output()
        .map_err(|e| format!("Failed to run claude CLI: {}", e))?;

    if !output.status.success() {
        // Ignore errors if the server doesn't exist
        let stderr = String::from_utf8_lossy(&output.stderr);
        if !stderr.contains("not found") && !stderr.contains("doesn't exist") {
            return Err(format!("Failed to remove MCP server: {}", stderr));
        }
    }

    Ok(())
}

// --- Codex (TOML) ---

fn install_codex_config(path: &PathBuf, kubeli_path: &str) -> Result<(), String> {
    let mut content = if path.exists() {
        std::fs::read_to_string(path).map_err(|e| format!("Failed to read config: {}", e))?
    } else {
        String::new()
    };

    // Check if already configured
    if content.contains("[mcp_servers.kubeli]") {
        return Ok(()); // Already configured
    }

    // Add Kubeli config
    let kubeli_config = format!(
        r#"
[mcp_servers.kubeli]
command = "{}"
args = ["--mcp"]
startup_timeout_sec = 15
tool_timeout_sec = 120
"#,
        kubeli_path
    );

    content.push_str(&kubeli_config);

    std::fs::write(path, content).map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(())
}

fn uninstall_codex_config(path: &PathBuf) -> Result<(), String> {
    let content =
        std::fs::read_to_string(path).map_err(|e| format!("Failed to read config: {}", e))?;

    // Parse TOML and remove kubeli section
    let mut doc: toml::Value = content
        .parse()
        .map_err(|e| format!("Failed to parse TOML: {}", e))?;

    if let Some(servers) = doc.get_mut("mcp_servers") {
        if let Some(table) = servers.as_table_mut() {
            table.remove("kubeli");
        }
    }

    let content =
        toml::to_string_pretty(&doc).map_err(|e| format!("Failed to serialize TOML: {}", e))?;

    std::fs::write(path, content).map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(())
}

// --- VS Code (JSON) ---

fn install_vscode_config(path: &PathBuf, kubeli_path: &str) -> Result<(), String> {
    let mut config: serde_json::Value = if path.exists() {
        let content =
            std::fs::read_to_string(path).map_err(|e| format!("Failed to read config: {}", e))?;
        serde_json::from_str(&content).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Ensure mcp.servers exists
    if config.get("mcp.servers").is_none() {
        config["mcp.servers"] = serde_json::json!({});
    }

    // Add Kubeli config
    config["mcp.servers"]["kubeli"] = serde_json::json!({
        "command": kubeli_path,
        "args": ["--mcp"]
    });

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    std::fs::write(path, content).map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(())
}

fn uninstall_vscode_config(path: &PathBuf) -> Result<(), String> {
    let content =
        std::fs::read_to_string(path).map_err(|e| format!("Failed to read config: {}", e))?;

    let mut config: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse config: {}", e))?;

    if let Some(servers) = config.get_mut("mcp.servers") {
        if let Some(obj) = servers.as_object_mut() {
            obj.remove("kubeli");
        }
    }

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    std::fs::write(path, content).map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(())
}

// --- Cursor (JSON) ---

fn install_cursor_config(path: &PathBuf, kubeli_path: &str) -> Result<(), String> {
    let mut config: serde_json::Value = if path.exists() {
        let content =
            std::fs::read_to_string(path).map_err(|e| format!("Failed to read config: {}", e))?;
        serde_json::from_str(&content).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Ensure mcpServers exists
    if config.get("mcpServers").is_none() {
        config["mcpServers"] = serde_json::json!({});
    }

    // Add Kubeli config
    config["mcpServers"]["kubeli"] = serde_json::json!({
        "command": kubeli_path,
        "args": ["--mcp"]
    });

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    std::fs::write(path, content).map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(())
}

fn uninstall_cursor_config(path: &PathBuf) -> Result<(), String> {
    let content =
        std::fs::read_to_string(path).map_err(|e| format!("Failed to read config: {}", e))?;

    let mut config: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse config: {}", e))?;

    if let Some(servers) = config.get_mut("mcpServers") {
        if let Some(obj) = servers.as_object_mut() {
            obj.remove("kubeli");
        }
    }

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    std::fs::write(path, content).map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ide_config_paths() {
        // Just ensure no panics
        for ide in [
            IdeType::ClaudeCode,
            IdeType::Codex,
            IdeType::VSCode,
            IdeType::Cursor,
        ] {
            let _ = ide.config_path();
            let _ = ide.is_installed();
            let _ = ide.display_name();
        }
    }
}
