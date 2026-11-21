use serde::{Deserialize, Serialize};
use std::env;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tokio::process::Command;

/// Get extended PATH including common Node.js/Homebrew locations
/// This is needed because Tauri apps don't inherit the full shell PATH
pub fn get_extended_path() -> String {
    let current_path = env::var("PATH").unwrap_or_default();
    if cfg!(windows) {
        // The Unix list below is meaningless on Windows, and joining with ':'
        // would corrupt the inherited PATH (its separator is ';').
        let win = WindowsEnv::from_env();
        let mut dirs = win.known_dirs();
        dirs.extend(win.path_dirs());
        return env::join_paths(dirs)
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or(current_path);
    }
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

// ============================================================================
// Windows lookup
// ============================================================================

/// Extensions tried on Windows, in order of preference. A real `.exe` wins over
/// a batch shim from any directory: `.cmd`/`.bat` run through cmd.exe, which
/// adds its own quoting rules, and Rust refuses to pass arguments containing
/// newlines to them (prompts go on stdin for that reason, see
/// `agent_manager::build_provider_args`). Extensionless files are skipped on
/// purpose, since npm puts a `claude` shell script for Git Bash next to
/// `claude.cmd` and Windows cannot spawn it.
const WINDOWS_EXTENSIONS: &[&str] = &[".exe", ".cmd", ".bat"];

/// Prevents a console window from flashing up when the GUI app spawns a CLI.
#[cfg(windows)]
pub const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Build a command for an AI CLI with the extended PATH set. On Windows the
/// child gets no console window.
pub fn cli_command(program: impl AsRef<std::ffi::OsStr>) -> Command {
    let mut cmd = Command::new(program);
    cmd.env("PATH", get_extended_path());
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

/// Split a PATH-style list on `separator`, dropping empty entries and the
/// quotes Windows allows around entries.
fn split_path_list(path_list: &str, separator: char) -> Vec<PathBuf> {
    path_list
        .split(separator)
        .map(|entry| entry.trim().trim_matches('"'))
        .filter(|entry| !entry.is_empty())
        .map(PathBuf::from)
        .collect()
}

/// Find `name` + extension in `dirs`. Each extension is tried across all dirs
/// before the next one, so the first extension is preferred everywhere.
fn find_in_dirs(name: &str, dirs: &[PathBuf], extensions: &[&str]) -> Option<PathBuf> {
    extensions.iter().find_map(|ext| {
        let file_name = format!("{}{}", name, ext.to_ascii_lowercase());
        dirs.iter()
            .map(|dir| dir.join(&file_name))
            .find(|candidate| candidate.is_file())
    })
}

/// The locations a Windows lookup depends on, read from the environment once
/// (tests build one by hand).
struct WindowsEnv {
    home: PathBuf,
    /// `%APPDATA%`
    roaming: PathBuf,
    /// `%LOCALAPPDATA%`
    local: PathBuf,
    /// `%ProgramFiles%`
    program_files: PathBuf,
    /// `$env:SCOOP`, default `%USERPROFILE%\scoop`
    scoop: PathBuf,
    /// `$env:SCOOP_GLOBAL`, default `%ProgramData%\scoop`
    scoop_global: PathBuf,
    /// `;`-separated PATH
    path: String,
}

impl WindowsEnv {
    fn from_env() -> Self {
        let home = dirs::home_dir().unwrap_or_default();
        let var = |name: &str| {
            env::var_os(name)
                .filter(|v| !v.is_empty())
                .map(PathBuf::from)
        };
        let program_data = var("ProgramData").unwrap_or_else(|| PathBuf::from(r"C:\ProgramData"));
        Self {
            roaming: dirs::data_dir().unwrap_or_else(|| home.join("AppData").join("Roaming")),
            local: dirs::data_local_dir().unwrap_or_else(|| home.join("AppData").join("Local")),
            program_files: var("ProgramFiles")
                .unwrap_or_else(|| PathBuf::from(r"C:\Program Files")),
            scoop: var("SCOOP").unwrap_or_else(|| home.join("scoop")),
            scoop_global: var("SCOOP_GLOBAL").unwrap_or_else(|| program_data.join("scoop")),
            path: env::var("PATH").unwrap_or_default(),
            home,
        }
    }

    /// Directories where Windows installs of the supported CLIs land. The
    /// native Claude Code dir comes first, matching the Unix order.
    ///
    /// - Claude Code native installer: `%USERPROFILE%\.local\bin\claude.exe`
    /// - WinGet portable packages: `%LOCALAPPDATA%\Microsoft\WinGet\Links`
    ///   (user scope) and `%ProgramFiles%\WinGet\Links` (machine scope)
    /// - Codex standalone installer: `%LOCALAPPDATA%\Programs\OpenAI\Codex\bin`
    /// - Droid installer: `%USERPROFILE%\bin\droid.exe`
    /// - OpenCode v1 install script (Git Bash only): `%USERPROFILE%\.opencode\bin`
    /// - Scoop shims: `$env:SCOOP\shims` and `$env:SCOOP_GLOBAL\shims`
    /// - npm global shims: `%APPDATA%\npm\<name>.cmd`
    fn known_dirs(&self) -> Vec<PathBuf> {
        vec![
            self.home.join(".local").join("bin"),
            self.local.join("Microsoft").join("WinGet").join("Links"),
            self.program_files.join("WinGet").join("Links"),
            self.local
                .join("Programs")
                .join("OpenAI")
                .join("Codex")
                .join("bin"),
            self.home.join("bin"),
            self.home.join(".opencode").join("bin"),
            self.scoop.join("shims"),
            self.scoop_global.join("shims"),
            self.npm_prefix(),
        ]
    }

    /// Default npm global prefix (`%APPDATA%\npm`).
    fn npm_prefix(&self) -> PathBuf {
        self.roaming.join("npm")
    }

    fn path_dirs(&self) -> Vec<PathBuf> {
        split_path_list(&self.path, ';')
    }
}

/// Directories inside an npm prefix that hold a CLI's real `.exe`:
/// `<prefix>\node_modules\<suffix>` for each `/`-separated suffix.
fn npm_package_dirs(prefix: &Path, suffixes: &[&str]) -> Vec<PathBuf> {
    let node_modules = prefix.join("node_modules");
    suffixes
        .iter()
        .map(|rel| rel.split('/').fold(node_modules.clone(), |p, c| p.join(c)))
        .collect()
}

/// npm package dirs holding `claude.exe`. The wrapper's `bin/claude.exe` is a
/// placeholder that its postinstall replaces; the per-platform package holds
/// the real binary.
const CLAUDE_NPM_EXE_DIRS: &[&str] = &[
    "@anthropic-ai/claude-code/node_modules/@anthropic-ai/claude-code-win32-x64",
    "@anthropic-ai/claude-code/node_modules/@anthropic-ai/claude-code-win32-arm64",
    "@anthropic-ai/claude-code-win32-x64",
    "@anthropic-ai/claude-code-win32-arm64",
    "@anthropic-ai/claude-code/bin",
];

/// npm package dirs holding `codex.exe` (the wrapper itself is a Node script).
const CODEX_NPM_EXE_DIRS: &[&str] = &[
    "@openai/codex/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin",
    "@openai/codex/node_modules/@openai/codex-win32-arm64/vendor/aarch64-pc-windows-msvc/bin",
    "@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin",
    "@openai/codex-win32-arm64/vendor/aarch64-pc-windows-msvc/bin",
];

/// npm package dirs holding `opencode.exe`: v1 (`opencode-ai`) and v2
/// (`@opencode/cli`), wrapper bins and per-platform packages.
const OPENCODE_NPM_EXE_DIRS: &[&str] = &[
    "opencode-ai/node_modules/opencode-windows-x64/bin",
    "opencode-ai/node_modules/opencode-windows-x64-baseline/bin",
    "opencode-ai/node_modules/opencode-windows-arm64/bin",
    "opencode-windows-x64/bin",
    "opencode-windows-x64-baseline/bin",
    "opencode-windows-arm64/bin",
    "@opencode/cli/node_modules/@opencode/cli-windows-x64/bin",
    "@opencode/cli/node_modules/@opencode/cli-windows-x64-baseline/bin",
    "@opencode/cli/node_modules/@opencode/cli-windows-arm64/bin",
    "@opencode/cli-windows-x64/bin",
    "@opencode/cli-windows-x64-baseline/bin",
    "@opencode/cli-windows-arm64/bin",
    "opencode-ai/bin",
    "@opencode/cli/bin",
];

/// npm package dirs holding `droid.exe` (the `droid` wrapper is a Node script).
const DROID_NPM_EXE_DIRS: &[&str] = &[
    "droid/node_modules/@factory/cli-win32-x64/bin",
    "droid/node_modules/@factory/cli-win32-x64-baseline/bin",
    "droid/node_modules/@factory/cli-win32-arm64/bin",
    "@factory/cli/node_modules/@factory/cli-win32-x64/bin",
    "@factory/cli/node_modules/@factory/cli-win32-x64-baseline/bin",
    "@factory/cli/node_modules/@factory/cli-win32-arm64/bin",
    "@factory/cli-win32-x64/bin",
    "@factory/cli-win32-x64-baseline/bin",
    "@factory/cli-win32-arm64/bin",
];

/// Resolve a CLI on Windows. Search order: `override_dirs`, the known install
/// dirs, the npm package dirs under `%APPDATA%\npm`, then PATH. An `.exe`
/// anywhere wins over a `.cmd`/`.bat` shim. If only a shim turns up, the npm
/// package dirs next to it are probed too, so a custom npm prefix still
/// resolves to the real `.exe`.
fn resolve_windows_cli(
    win: &WindowsEnv,
    name: &str,
    override_dirs: &[PathBuf],
    npm_exe_dirs: &[&str],
) -> Option<PathBuf> {
    let mut search = override_dirs.to_vec();
    search.extend(win.known_dirs());
    search.extend(npm_package_dirs(&win.npm_prefix(), npm_exe_dirs));
    search.extend(win.path_dirs());

    let found = find_in_dirs(name, &search, WINDOWS_EXTENSIONS)?;
    let is_exe = found
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("exe"));
    if is_exe {
        return Some(found);
    }
    let shim_dir = found.parent()?;
    find_in_dirs(name, &npm_package_dirs(shim_dir, npm_exe_dirs), &[".exe"]).or(Some(found))
}

/// `resolve_windows_cli` against the current environment.
fn find_windows_cli(
    name: &str,
    override_dirs: &[PathBuf],
    npm_exe_dirs: &[&str],
) -> Option<String> {
    resolve_windows_cli(&WindowsEnv::from_env(), name, override_dirs, npm_exe_dirs)
        .map(|p| p.to_string_lossy().into_owned())
}

/// Resolve Claude Code on Windows (native installer, WinGet, npm, PATH).
pub fn find_claude_windows() -> Option<String> {
    find_windows_cli("claude", &[], CLAUDE_NPM_EXE_DIRS)
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
pub type OpenCodeCliInfo = CliInfo;
pub type DroidCliInfo = CliInfo;

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

        let Some(path) = cli_path.clone() else {
            return ClaudeCliInfo {
                status: CliStatus::NotInstalled,
                version: None,
                cli_path: None,
                error_message: Some("Claude CLI not found in PATH".to_string()),
            };
        };

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
        if cfg!(windows) {
            return find_claude_windows();
        }
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
        let output = cli_command(cli_path)
            .arg("--version")
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
        // Run a simple check - claude should return quickly if authenticated
        let output = cli_command(cli_path)
            .arg("--help")
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

        let Some(path) = cli_path.clone() else {
            return CodexCliInfo {
                status: CliStatus::NotInstalled,
                version: None,
                cli_path: None,
                error_message: Some("Codex CLI not found in PATH".to_string()),
            };
        };

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
    ///
    /// Codex is distributed as a Node.js wrapper script that spawns a native binary.
    /// In production Tauri apps (launched from Finder), `node` may not be in PATH,
    /// causing the wrapper script to fail. We prioritize finding the native binary
    /// directly, falling back to the wrapper script only if needed.
    async fn find_codex_cli_path() -> Option<String> {
        if cfg!(windows) {
            return find_windows_cli("codex", &[], CODEX_NPM_EXE_DIRS);
        }
        let home = env::var("HOME").unwrap_or_default();

        // First: try to find the native Codex binary directly.
        // This avoids the Node.js dependency which fails in production GUI apps
        // where `node` is not in PATH.
        if let Some(native) = Self::find_codex_native_binary(&home) {
            return Some(native);
        }

        // Fallback: look for the Node.js wrapper scripts (works in dev mode
        // where the terminal's full PATH is inherited)

        // Homebrew installation
        let homebrew_bin = "/opt/homebrew/bin/codex".to_string();
        let homebrew_intel = "/usr/local/bin/codex".to_string();

        // npm global installations
        let npm_global = format!("{}/.npm-global/bin/codex", home);
        let local_bin = format!("{}/.local/bin/codex", home);

        let mut possible_paths = vec![homebrew_bin, homebrew_intel, local_bin, npm_global];

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

    /// Find the native Codex binary directly, bypassing the Node.js wrapper.
    ///
    /// Codex packages contain a native Mach-O/ELF binary at a known vendor path
    /// inside the npm package. We check common installation roots for this binary.
    fn find_codex_native_binary(home: &str) -> Option<String> {
        let target_triple = if cfg!(target_arch = "aarch64") {
            "aarch64-apple-darwin"
        } else {
            "x86_64-apple-darwin"
        };

        let platform_package = if cfg!(target_arch = "aarch64") {
            "@openai/codex-darwin-arm64"
        } else {
            "@openai/codex-darwin-x64"
        };

        // Known installation roots where @openai/codex may be installed
        let codex_package_roots = [
            // npm global: native dep is nested inside codex's own node_modules
            format!(
                "{}/.npm-global/lib/node_modules/@openai/codex/node_modules/{}/vendor/{}/codex/codex",
                home, platform_package, target_triple
            ),
            // npm global: hoisted (flat node_modules)
            format!(
                "{}/.npm-global/lib/node_modules/{}/vendor/{}/codex/codex",
                home, platform_package, target_triple
            ),
            // Homebrew (Apple Silicon): vendor dir inside the codex package itself
            format!(
                "/opt/homebrew/lib/node_modules/@openai/codex/vendor/{}/codex/codex",
                target_triple
            ),
            // Homebrew (Apple Silicon): nested node_modules
            format!(
                "/opt/homebrew/lib/node_modules/@openai/codex/node_modules/{}/vendor/{}/codex/codex",
                platform_package, target_triple
            ),
            // Homebrew (Intel)
            format!(
                "/usr/local/lib/node_modules/@openai/codex/vendor/{}/codex/codex",
                target_triple
            ),
            format!(
                "/usr/local/lib/node_modules/@openai/codex/node_modules/{}/vendor/{}/codex/codex",
                platform_package, target_triple
            ),
        ];

        // Also check version manager paths
        let version_manager_finders: Vec<Option<String>> = vec![
            find_nvm_node(home),
            find_mise_node(home),
            find_asdf_node(home),
            find_fnm_node(home),
            find_volta_node(home),
        ];

        let mut all_paths: Vec<String> = codex_package_roots.to_vec();

        for vm_bin in version_manager_finders.into_iter().flatten() {
            // Version manager bin dirs are like ~/.nvm/versions/node/v22.x/bin
            // The lib dir is a sibling: ~/.nvm/versions/node/v22.x/lib
            if let Some(base) = vm_bin.strip_suffix("/bin") {
                all_paths.push(format!(
                    "{}/lib/node_modules/@openai/codex/node_modules/{}/vendor/{}/codex/codex",
                    base, platform_package, target_triple
                ));
                all_paths.push(format!(
                    "{}/lib/node_modules/@openai/codex/vendor/{}/codex/codex",
                    base, target_triple
                ));
            }
        }

        for path in &all_paths {
            let p = std::path::Path::new(path);
            if p.exists() && p.is_file() {
                tracing::info!("Found native Codex binary at: {}", path);
                return Some(path.clone());
            }
        }

        tracing::debug!("Native Codex binary not found in any known location");
        None
    }

    /// Get Codex CLI version
    async fn get_codex_cli_version(cli_path: &str) -> Result<String, String> {
        let output = cli_command(cli_path)
            .arg("--version")
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
        // Run a simple check - codex should return quickly if authenticated
        let output = cli_command(cli_path)
            .arg("--help")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .map_err(|e| format!("Failed to execute codex CLI: {}", e))?;

        Ok(output.status.success())
    }

    // ========================================================================
    // OpenCode CLI Detection (sst/opencode)
    // ========================================================================

    /// Check if OpenCode CLI is available in PATH
    pub async fn check_opencode_cli_available() -> OpenCodeCliInfo {
        let cli_path = Self::find_opencode_cli_path().await;

        let Some(path) = cli_path.clone() else {
            return OpenCodeCliInfo {
                status: CliStatus::NotInstalled,
                version: None,
                cli_path: None,
                error_message: Some("OpenCode CLI not found in PATH".to_string()),
            };
        };

        match Self::get_simple_cli_version(&path).await {
            Ok(version) => OpenCodeCliInfo {
                status: CliStatus::Authenticated,
                version: Some(version),
                cli_path,
                error_message: None,
            },
            Err(e) => OpenCodeCliInfo {
                status: CliStatus::NotAuthenticated,
                version: None,
                cli_path,
                error_message: Some(e),
            },
        }
    }

    /// Find OpenCode CLI path
    async fn find_opencode_cli_path() -> Option<String> {
        if cfg!(windows) {
            // npm packages `opencode-ai` (v1) and `@opencode/cli` (v2) ship
            // `bin/opencode.exe`
            let overrides: Vec<PathBuf> = ["OPENCODE_INSTALL_DIR", "XDG_BIN_DIR"]
                .iter()
                .filter_map(env::var_os)
                .map(PathBuf::from)
                .collect();
            return find_windows_cli("opencode", &overrides, OPENCODE_NPM_EXE_DIRS);
        }
        let home = env::var("HOME").unwrap_or_default();

        // Default install dirs published by sst/opencode
        let opencode_default = format!("{}/.opencode/bin/opencode", home);
        let local_bin = format!("{}/.local/bin/opencode", home);
        let xdg_bin = format!("{}/bin/opencode", home);

        let mut possible_paths = vec![
            opencode_default,
            local_bin,
            xdg_bin,
            "/opt/homebrew/bin/opencode".to_string(),
            "/usr/local/bin/opencode".to_string(),
        ];

        // Honor explicit override if set
        if let Ok(install_dir) = env::var("OPENCODE_INSTALL_DIR") {
            possible_paths.insert(0, format!("{}/opencode", install_dir));
        }
        if let Ok(xdg_bin_dir) = env::var("XDG_BIN_DIR") {
            possible_paths.insert(0, format!("{}/opencode", xdg_bin_dir));
        }

        // npm-based installs
        possible_paths.push(format!("{}/.npm-global/bin/opencode", home));
        if let Some(mise_bin) = find_mise_node(&home) {
            possible_paths.push(format!("{}/opencode", mise_bin));
        }
        if let Some(nvm_bin) = find_nvm_node(&home) {
            possible_paths.push(format!("{}/opencode", nvm_bin));
        }
        if let Some(asdf_bin) = find_asdf_node(&home) {
            possible_paths.push(format!("{}/opencode", asdf_bin));
        }
        if let Some(fnm_bin) = find_fnm_node(&home) {
            possible_paths.push(format!("{}/opencode", fnm_bin));
        }
        if let Some(volta_bin) = find_volta_node(&home) {
            possible_paths.push(format!("{}/opencode", volta_bin));
        }

        for path in &possible_paths {
            if std::path::Path::new(path).exists() {
                return Some(path.clone());
            }
        }

        // Fallback: which opencode
        let extended_path = get_extended_path();
        let output = Command::new("which")
            .arg("opencode")
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

    /// Verify OpenCode authentication by running --help
    pub async fn verify_opencode_authentication(cli_path: &str) -> Result<bool, String> {
        Self::verify_simple_authentication(cli_path, "opencode").await
    }

    // ========================================================================
    // Droid CLI Detection (Factory.ai)
    // ========================================================================

    /// Check if Droid CLI is available in PATH
    pub async fn check_droid_cli_available() -> DroidCliInfo {
        let cli_path = Self::find_droid_cli_path().await;

        let Some(path) = cli_path.clone() else {
            return DroidCliInfo {
                status: CliStatus::NotInstalled,
                version: None,
                cli_path: None,
                error_message: Some("Droid CLI not found in PATH".to_string()),
            };
        };

        match Self::get_simple_cli_version(&path).await {
            Ok(version) => DroidCliInfo {
                status: CliStatus::Authenticated,
                version: Some(version),
                cli_path,
                error_message: None,
            },
            Err(e) => DroidCliInfo {
                status: CliStatus::NotAuthenticated,
                version: None,
                cli_path,
                error_message: Some(e),
            },
        }
    }

    /// Find Droid CLI path
    async fn find_droid_cli_path() -> Option<String> {
        if cfg!(windows) {
            return find_windows_cli("droid", &[], DROID_NPM_EXE_DIRS);
        }
        let home = env::var("HOME").unwrap_or_default();

        let mut possible_paths = vec![
            format!("{}/.local/bin/droid", home),
            "/opt/homebrew/bin/droid".to_string(),
            "/usr/local/bin/droid".to_string(),
            format!("{}/.npm-global/bin/droid", home),
            format!("{}/.factory/bin/droid", home),
        ];

        if let Some(mise_bin) = find_mise_node(&home) {
            possible_paths.push(format!("{}/droid", mise_bin));
        }
        if let Some(nvm_bin) = find_nvm_node(&home) {
            possible_paths.push(format!("{}/droid", nvm_bin));
        }
        if let Some(asdf_bin) = find_asdf_node(&home) {
            possible_paths.push(format!("{}/droid", asdf_bin));
        }
        if let Some(fnm_bin) = find_fnm_node(&home) {
            possible_paths.push(format!("{}/droid", fnm_bin));
        }
        if let Some(volta_bin) = find_volta_node(&home) {
            possible_paths.push(format!("{}/droid", volta_bin));
        }

        for path in &possible_paths {
            if std::path::Path::new(path).exists() {
                return Some(path.clone());
            }
        }

        let extended_path = get_extended_path();
        let output = Command::new("which")
            .arg("droid")
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

    /// Verify Droid authentication by running --help
    pub async fn verify_droid_authentication(cli_path: &str) -> Result<bool, String> {
        Self::verify_simple_authentication(cli_path, "droid").await
    }

    // ========================================================================
    // Shared helpers (work for any CLI that supports --version / --help)
    // ========================================================================

    async fn get_simple_cli_version(cli_path: &str) -> Result<String, String> {
        let output = cli_command(cli_path)
            .arg("--version")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .map_err(|e| format!("Failed to execute CLI: {}", e))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            Err(format!("CLI returned error: {}", stderr))
        }
    }

    async fn verify_simple_authentication(cli_path: &str, name: &str) -> Result<bool, String> {
        let output = cli_command(cli_path)
            .arg("--help")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .map_err(|e| format!("Failed to execute {} CLI: {}", name, e))?;

        Ok(output.status.success())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Fake Windows machine: profile, %ProgramFiles% and %ProgramData% under a
    /// temp dir.
    struct FakeProfile {
        _tmp: tempfile::TempDir,
        win: WindowsEnv,
    }

    impl FakeProfile {
        fn new() -> Self {
            let tmp = tempfile::tempdir().unwrap();
            let home = tmp.path().join("Users").join("me");
            let win = WindowsEnv {
                roaming: home.join("AppData").join("Roaming"),
                local: home.join("AppData").join("Local"),
                program_files: tmp.path().join("Program Files"),
                scoop: home.join("scoop"),
                scoop_global: tmp.path().join("ProgramData").join("scoop"),
                path: String::new(),
                home,
            };
            Self { _tmp: tmp, win }
        }

        fn home(&self) -> &Path {
            &self.win.home
        }

        fn npm(&self) -> PathBuf {
            self.win.npm_prefix()
        }

        fn touch(&self, path: &Path) -> PathBuf {
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(path, b"").unwrap();
            path.to_path_buf()
        }

        fn find(&mut self, name: &str, npm_exe_dirs: &[&str], path_var: &str) -> Option<PathBuf> {
            self.win.path = path_var.to_string();
            resolve_windows_cli(&self.win, name, &[], npm_exe_dirs)
        }
    }

    fn rel(path: &str) -> PathBuf {
        path.split('/').collect()
    }

    // Regression for #555: the native installer only creates
    // %USERPROFILE%\.local\bin\claude.exe (no extensionless `claude`).
    #[test]
    fn windows_finds_native_claude_exe() {
        let mut p = FakeProfile::new();
        let exe = p.touch(&p.home().join(".local").join("bin").join("claude.exe"));
        assert_eq!(p.find("claude", CLAUDE_NPM_EXE_DIRS, ""), Some(exe));
    }

    #[test]
    fn windows_finds_cli_on_path_without_which() {
        let mut p = FakeProfile::new();
        let tools = p.home().join("tools");
        let exe = p.touch(&tools.join("codex.exe"));
        let path_var = format!(r#"C:\does\not\exist;;"{}";"#, tools.display());
        assert_eq!(p.find("codex", CODEX_NPM_EXE_DIRS, &path_var), Some(exe));
    }

    #[test]
    fn windows_finds_npm_cmd_shim_but_not_bash_script() {
        let mut p = FakeProfile::new();
        // npm writes a shell script for Git Bash next to the .cmd shim
        p.touch(&p.npm().join("droid"));
        let cmd = p.touch(&p.npm().join("droid.cmd"));
        assert_eq!(p.find("droid", DROID_NPM_EXE_DIRS, ""), Some(cmd));
    }

    #[test]
    fn windows_prefers_npm_package_exe_over_cmd_shim() {
        let cases = [
            (
                "claude",
                CLAUDE_NPM_EXE_DIRS,
                "@anthropic-ai/claude-code/node_modules/@anthropic-ai/claude-code-win32-x64",
            ),
            (
                "codex",
                CODEX_NPM_EXE_DIRS,
                "@openai/codex/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin",
            ),
            (
                "opencode",
                OPENCODE_NPM_EXE_DIRS,
                "opencode-ai/node_modules/opencode-windows-x64/bin",
            ),
            (
                "droid",
                DROID_NPM_EXE_DIRS,
                "droid/node_modules/@factory/cli-win32-x64/bin",
            ),
        ];
        for (name, npm_dirs, package_dir) in cases {
            let mut p = FakeProfile::new();
            p.touch(&p.npm().join(format!("{name}.cmd")));
            let exe = p.touch(
                &p.npm()
                    .join("node_modules")
                    .join(rel(package_dir))
                    .join(format!("{name}.exe")),
            );
            assert_eq!(p.find(name, npm_dirs, ""), Some(exe), "{name}");
        }
    }

    #[test]
    fn windows_resolves_exe_next_to_shim_in_custom_npm_prefix() {
        let mut p = FakeProfile::new();
        let prefix = p.home().join("custom-npm");
        p.touch(&prefix.join("claude.cmd"));
        let exe = p.touch(
            &prefix
                .join("node_modules")
                .join(rel("@anthropic-ai/claude-code-win32-x64"))
                .join("claude.exe"),
        );
        let path_var = prefix.display().to_string();
        assert_eq!(p.find("claude", CLAUDE_NPM_EXE_DIRS, &path_var), Some(exe));
    }

    #[test]
    fn windows_keeps_shim_when_no_package_exe_exists() {
        let mut p = FakeProfile::new();
        let prefix = p.home().join("custom-npm");
        let cmd = p.touch(&prefix.join("droid.cmd"));
        let path_var = prefix.display().to_string();
        assert_eq!(p.find("droid", DROID_NPM_EXE_DIRS, &path_var), Some(cmd));
    }

    #[test]
    fn windows_known_install_locations() {
        let mut p = FakeProfile::new();
        let codex = p.touch(&p.win.local.join(rel("Programs/OpenAI/Codex/bin/codex.exe")));
        let droid = p.touch(&p.home().join("bin").join("droid.exe"));
        let opencode = p.touch(&p.home().join(rel(".opencode/bin/opencode.exe")));
        assert_eq!(p.find("codex", CODEX_NPM_EXE_DIRS, ""), Some(codex));
        assert_eq!(p.find("droid", DROID_NPM_EXE_DIRS, ""), Some(droid));
        assert_eq!(
            p.find("opencode", OPENCODE_NPM_EXE_DIRS, ""),
            Some(opencode)
        );
    }

    #[test]
    fn windows_finds_winget_and_scoop_links() {
        let user_winget = |p: &FakeProfile| p.win.local.join(rel("Microsoft/WinGet/Links"));
        let machine_winget = |p: &FakeProfile| p.win.program_files.join(rel("WinGet/Links"));
        let scoop = |p: &FakeProfile| p.win.scoop.join("shims");
        let scoop_global = |p: &FakeProfile| p.win.scoop_global.join("shims");
        for dir in [user_winget, machine_winget, scoop, scoop_global] {
            let mut p = FakeProfile::new();
            let exe = p.touch(&dir(&p).join("claude.exe"));
            assert_eq!(p.find("claude", CLAUDE_NPM_EXE_DIRS, ""), Some(exe));
        }
    }

    #[test]
    fn windows_prefers_native_install_over_npm_exe() {
        let mut p = FakeProfile::new();
        p.touch(
            &p.npm()
                .join("node_modules")
                .join(rel("@anthropic-ai/claude-code-win32-x64/claude.exe")),
        );
        let native = p.touch(&p.home().join(rel(".local/bin/claude.exe")));
        assert_eq!(p.find("claude", CLAUDE_NPM_EXE_DIRS, ""), Some(native));
    }

    #[test]
    fn windows_returns_none_when_missing() {
        let mut p = FakeProfile::new();
        assert_eq!(
            p.find("claude", CLAUDE_NPM_EXE_DIRS, r"C:\Windows\System32"),
            None
        );
    }

    #[test]
    fn extensions_are_matched_lowercase() {
        let p = FakeProfile::new();
        let exe = p.touch(&p.home().join("claude.exe"));
        assert_eq!(
            find_in_dirs("claude", &[p.home().to_path_buf()], &[".EXE"]),
            Some(exe)
        );
    }

    #[test]
    fn split_path_list_handles_quotes_and_empty_entries() {
        assert_eq!(
            split_path_list(r#"C:\a;;"C:\Program Files\b"; "#, ';'),
            vec![PathBuf::from(r"C:\a"), PathBuf::from(r"C:\Program Files\b")]
        );
    }

    #[tokio::test]
    async fn test_cli_detection() {
        let info = CliDetector::check_cli_available().await;
        // Just verify it doesn't panic
        println!("CLI Status: {:?}", info.status);
    }

    #[test]
    fn test_codex_native_binary_detection() {
        let home = env::var("HOME").unwrap_or_default();
        let result = CliDetector::find_codex_native_binary(&home);
        // Just verify it doesn't panic; result depends on local installation
        println!("Native Codex binary: {:?}", result);
    }

    #[tokio::test]
    async fn test_codex_cli_detection() {
        let info = CliDetector::check_codex_cli_available().await;
        println!("Codex CLI Status: {:?}", info.status);
        println!("Codex CLI Path: {:?}", info.cli_path);
    }

    #[tokio::test]
    async fn test_opencode_cli_detection() {
        let info = CliDetector::check_opencode_cli_available().await;
        println!("OpenCode CLI Status: {:?}", info.status);
        println!("OpenCode CLI Path: {:?}", info.cli_path);
    }

    #[tokio::test]
    async fn test_droid_cli_detection() {
        let info = CliDetector::check_droid_cli_available().await;
        println!("Droid CLI Status: {:?}", info.status);
        println!("Droid CLI Path: {:?}", info.cli_path);
    }
}
