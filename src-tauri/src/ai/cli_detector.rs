use serde::{Deserialize, Serialize};
use std::env;
use std::process::Stdio;
use tokio::process::Command;

/// Get extended PATH including common Node.js/Homebrew locations
/// This is needed because Tauri apps don't inherit the full shell PATH
pub fn get_extended_path() -> String {
    let current_path = env::var("PATH").unwrap_or_default();
    let home = env::var("HOME").unwrap_or_default();

    // Build paths including home-relative ones
    let local_bin = format!("{}/.local/bin", home);
    let npm_global = format!("{}/.npm-global/bin", home);

    // Common paths where node might be installed
    let mut all_paths = vec![
        // Native Claude Code installation
        local_bin,
        // Homebrew
        "/opt/homebrew/bin".to_string(),
        "/opt/homebrew/sbin".to_string(),
        "/usr/local/bin".to_string(),
        "/usr/local/sbin".to_string(),
        // npm global
        npm_global,
        // System paths
        "/usr/bin".to_string(),
        "/bin".to_string(),
    ];

    // Add paths from version managers (mise, nvm, asdf, fnm, volta)
    if let Some(mise_path) = find_mise_node(&home) {
        all_paths.insert(0, mise_path);
    }
    if let Some(nvm_path) = find_nvm_node(&home) {
        all_paths.insert(0, nvm_path);
    }
    if let Some(asdf_path) = find_asdf_node(&home) {
        all_paths.insert(0, asdf_path);
    }
    if let Some(fnm_path) = find_fnm_node(&home) {
        all_paths.insert(0, fnm_path);
    }
    if let Some(volta_path) = find_volta_node(&home) {
        all_paths.insert(0, volta_path);
    }

    all_paths.push(current_path);

    all_paths.join(":")
}

/// Find node installed via nvm
fn find_nvm_node(home: &str) -> Option<String> {
    let nvm_dir = format!("{}/.nvm/versions/node", home);
    find_latest_version_bin(&nvm_dir)
}

/// Find node installed via mise (formerly rtx)
fn find_mise_node(home: &str) -> Option<String> {
    let mise_dir = format!("{}/.local/share/mise/installs/node", home);
    find_latest_version_bin(&mise_dir)
}

/// Find node installed via asdf
fn find_asdf_node(home: &str) -> Option<String> {
    let asdf_dir = format!("{}/.asdf/installs/nodejs", home);
    find_latest_version_bin(&asdf_dir)
}

/// Find node installed via fnm
fn find_fnm_node(home: &str) -> Option<String> {
    let fnm_dir = format!("{}/.local/share/fnm/node-versions", home);
    if let Ok(entries) = std::fs::read_dir(&fnm_dir) {
        let mut versions: Vec<String> = entries
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_dir())
            .map(|e| e.path().to_string_lossy().to_string())
            .collect();
        versions.sort();
        if let Some(latest) = versions.last() {
            return Some(format!("{}/installation/bin", latest));
        }
    }
    None
}

/// Find node installed via volta
fn find_volta_node(home: &str) -> Option<String> {
    let volta_bin = format!("{}/.volta/bin", home);
    if std::path::Path::new(&volta_bin).exists() {
        return Some(volta_bin);
    }
    None
}

/// Helper to find the latest version bin directory
fn find_latest_version_bin(base_dir: &str) -> Option<String> {
    if let Ok(entries) = std::fs::read_dir(base_dir) {
        let mut versions: Vec<String> = entries
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_dir())
            .map(|e| e.path().to_string_lossy().to_string())
            .collect();
        versions.sort();
        if let Some(latest) = versions.last() {
            return Some(format!("{}/bin", latest));
        }
    }
    None
}

/// Status of CLI installation and authentication
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CliStatus {
    /// CLI is installed and authenticated
    Authenticated,
    /// CLI is installed but not authenticated
    NotAuthenticated,
    /// CLI is not installed
    NotInstalled,
    /// Error checking status
    Error,
}

/// Information about an AI CLI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliInfo {
    pub status: CliStatus,
    pub version: Option<String>,
    pub cli_path: Option<String>,
    pub error_message: Option<String>,
}

impl Default for CliInfo {
    fn default() -> Self {
        Self {
            status: CliStatus::NotInstalled,
            version: None,
            cli_path: None,
            error_message: None,
        }
    }
}

/// Type aliases for specific CLI implementations
pub type ClaudeCliInfo = CliInfo;
pub type CodexCliInfo = CliInfo;

/// Detect AI CLI installations (Claude Code and Codex)
pub struct CliDetector;

impl CliDetector {
    // ========================================================================
    // Claude Code CLI Detection
    // ========================================================================

    /// Check if Claude CLI is available in PATH
    pub async fn check_cli_available() -> ClaudeCliInfo {
        Self::check_claude_cli_available().await
    }

    /// Check if Claude CLI is available in PATH
    pub async fn check_claude_cli_available() -> ClaudeCliInfo {
        // Try to find claude in PATH
        let cli_path = Self::find_claude_cli_path().await;

        if cli_path.is_none() {
            return ClaudeCliInfo {
                status: CliStatus::NotInstalled,
                version: None,
                cli_path: None,
                error_message: Some("Claude CLI not found in PATH".to_string()),
            };
        }

        let path = cli_path.clone().unwrap();

        // Try to get version
        match Self::get_claude_cli_version(&path).await {
            Ok(version) => ClaudeCliInfo {
                status: CliStatus::Authenticated, // If version works, likely authenticated
                version: Some(version),
                cli_path,
                error_message: None,
            },
            Err(e) => ClaudeCliInfo {
                status: CliStatus::NotAuthenticated,
                version: None,
                cli_path,
                error_message: Some(e),
            },
        }
    }

    /// Find claude CLI path
    async fn find_claude_cli_path() -> Option<String> {
        let home = env::var("HOME").unwrap_or_default();

        // Native installation path (recommended)
        let native_local_bin = format!("{}/.local/bin/claude", home);

        // Homebrew cask installation
        let homebrew_bin = "/opt/homebrew/bin/claude".to_string();
        let homebrew_intel = "/usr/local/bin/claude".to_string();

        // Legacy npm global installations
        let npm_global = format!("{}/.npm-global/bin/claude", home);
        let npm_prefix = format!("{}/node_modules/.bin/claude", home);

        // Check common locations in order of preference
        let mut possible_paths = vec![
            // Native installation (recommended) - ~/.local/bin/claude
            native_local_bin,
            // Homebrew (Apple Silicon)
            homebrew_bin,
            // Homebrew (Intel) or system-wide
            homebrew_intel,
            // Legacy npm global installations
            npm_global,
            npm_prefix,
        ];

        // Add version manager paths (mise, nvm, asdf, fnm, volta)
        if let Some(mise_bin) = find_mise_node(&home) {
            possible_paths.push(format!("{}/claude", mise_bin));
        }
        if let Some(nvm_bin) = find_nvm_node(&home) {
            possible_paths.push(format!("{}/claude", nvm_bin));
        }
        if let Some(asdf_bin) = find_asdf_node(&home) {
            possible_paths.push(format!("{}/claude", asdf_bin));
        }
        if let Some(fnm_bin) = find_fnm_node(&home) {
            possible_paths.push(format!("{}/claude", fnm_bin));
        }
        if let Some(volta_bin) = find_volta_node(&home) {
            possible_paths.push(format!("{}/claude", volta_bin));
        }

        for path in &possible_paths {
            if std::path::Path::new(path).exists() {
                return Some(path.clone());
            }
        }

        // Try using `which` command with extended PATH
        let extended_path = get_extended_path();
        let output = Command::new("which")
            .arg("claude")
            .env("PATH", &extended_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .output()
            .await;

        if let Ok(output) = output {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    return Some(path);
                }
            }
        }

        None
    }

    /// Get Claude CLI version
    async fn get_claude_cli_version(cli_path: &str) -> Result<String, String> {
        let extended_path = get_extended_path();

        let output = Command::new(cli_path)
            .arg("--version")
            .env("PATH", &extended_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .map_err(|e| format!("Failed to execute claude CLI: {}", e))?;

        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            Ok(version)
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            Err(format!("CLI returned error: {}", stderr))
        }
    }

    /// Verify Claude authentication status
    pub async fn verify_authentication(cli_path: &str) -> Result<bool, String> {
        Self::verify_claude_authentication(cli_path).await
    }

    /// Verify Claude authentication status by trying to run help
    pub async fn verify_claude_authentication(cli_path: &str) -> Result<bool, String> {
        let extended_path = get_extended_path();

        // Run a simple check - claude should return quickly if authenticated
        let output = Command::new(cli_path)
            .arg("--help")
            .env("PATH", &extended_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .map_err(|e| format!("Failed to execute claude CLI: {}", e))?;

        Ok(output.status.success())
    }

    // ========================================================================
    // Codex CLI Detection (OpenAI)
    // ========================================================================

    /// Check if Codex CLI is available in PATH
    pub async fn check_codex_cli_available() -> CodexCliInfo {
        // Try to find codex in PATH
        let cli_path = Self::find_codex_cli_path().await;

        if cli_path.is_none() {
            return CodexCliInfo {
                status: CliStatus::NotInstalled,
                version: None,
                cli_path: None,
                error_message: Some("Codex CLI not found in PATH".to_string()),
            };
        }

        let path = cli_path.clone().unwrap();

        // Try to get version
        match Self::get_codex_cli_version(&path).await {
            Ok(version) => CodexCliInfo {
                status: CliStatus::Authenticated, // If version works, likely authenticated
                version: Some(version),
                cli_path,
                error_message: None,
            },
            Err(e) => CodexCliInfo {
                status: CliStatus::NotAuthenticated,
                version: None,
                cli_path,
                error_message: Some(e),
            },
        }
    }

    /// Find Codex CLI path
    async fn find_codex_cli_path() -> Option<String> {
        let home = env::var("HOME").unwrap_or_default();

        // Homebrew installation (primary method)
        let homebrew_bin = "/opt/homebrew/bin/codex".to_string();
        let homebrew_intel = "/usr/local/bin/codex".to_string();

        // npm global installations
        let npm_global = format!("{}/.npm-global/bin/codex", home);
        let local_bin = format!("{}/.local/bin/codex", home);

        // Check common locations in order of preference
        let mut possible_paths = vec![
            // Homebrew (Apple Silicon) - primary installation method
            homebrew_bin,
            // Homebrew (Intel) or system-wide
            homebrew_intel,
            // Local bin
            local_bin,
            // npm global
            npm_global,
        ];

        // Add version manager paths (mise, nvm, asdf, fnm, volta)
        if let Some(mise_bin) = find_mise_node(&home) {
            possible_paths.push(format!("{}/codex", mise_bin));
        }
        if let Some(nvm_bin) = find_nvm_node(&home) {
            possible_paths.push(format!("{}/codex", nvm_bin));
        }
        if let Some(asdf_bin) = find_asdf_node(&home) {
            possible_paths.push(format!("{}/codex", asdf_bin));
        }
        if let Some(fnm_bin) = find_fnm_node(&home) {
            possible_paths.push(format!("{}/codex", fnm_bin));
        }
        if let Some(volta_bin) = find_volta_node(&home) {
            possible_paths.push(format!("{}/codex", volta_bin));
        }

        for path in &possible_paths {
            if std::path::Path::new(path).exists() {
                return Some(path.clone());
            }
        }

        // Try using `which` command with extended PATH
        let extended_path = get_extended_path();
        let output = Command::new("which")
            .arg("codex")
            .env("PATH", &extended_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .output()
            .await;

        if let Ok(output) = output {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    return Some(path);
                }
            }
        }

        None
    }

    /// Get Codex CLI version
    async fn get_codex_cli_version(cli_path: &str) -> Result<String, String> {
        let extended_path = get_extended_path();

        let output = Command::new(cli_path)
            .arg("--version")
            .env("PATH", &extended_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .map_err(|e| format!("Failed to execute codex CLI: {}", e))?;

        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            Ok(version)
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            Err(format!("CLI returned error: {}", stderr))
        }
    }

    /// Verify Codex authentication status by trying to run help
    pub async fn verify_codex_authentication(cli_path: &str) -> Result<bool, String> {
        let extended_path = get_extended_path();

        // Run a simple check - codex should return quickly if authenticated
        let output = Command::new(cli_path)
            .arg("--help")
            .env("PATH", &extended_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .map_err(|e| format!("Failed to execute codex CLI: {}", e))?;

        Ok(output.status.success())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_cli_detection() {
        let info = CliDetector::check_cli_available().await;
        // Just verify it doesn't panic
        println!("CLI Status: {:?}", info.status);
    }
}
