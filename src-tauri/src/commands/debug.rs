use crate::k8s::{AppState, KubeConfig};
use serde::{Deserialize, Serialize};
use std::env;
use tauri::{command, State};

/// Debug info for troubleshooting connection issues
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugInfo {
    pub app_version: String,
    pub os: String,
    pub arch: String,
    pub kubeconfig_path: String,
    pub kubeconfig_exists: bool,
    pub contexts: Vec<ContextDebugInfo>,
    pub current_context: Option<String>,
    pub connection_status: String,
    pub environment: EnvironmentInfo,
    pub error_details: Option<String>,
}

/// Context-specific debug info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextDebugInfo {
    pub name: String,
    pub cluster: String,
    pub user: String,
    pub auth_type: String,
    pub server: String,
    pub server_reachable: Option<bool>,
}

/// Environment info for debugging
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentInfo {
    pub home: Option<String>,
    pub kubeconfig_env: Option<String>,
    pub azure_config_dir: Option<String>,
    pub path_contains_azure: bool,
    pub path_contains_gcloud: bool,
    pub path_contains_aws: bool,
}

/// Export debug information for troubleshooting
#[command]
pub async fn export_debug_info(
    state: State<'_, AppState>,
    failed_context: Option<String>,
    error_message: Option<String>,
) -> Result<DebugInfo, String> {
    let app_version = env!("CARGO_PKG_VERSION").to_string();

    // Get OS info
    let os = std::env::consts::OS.to_string();
    let arch = std::env::consts::ARCH.to_string();

    // Get kubeconfig path
    let home = env::var("HOME").unwrap_or_default();
    let kubeconfig_env = env::var("KUBECONFIG").ok();
    let kubeconfig_path = kubeconfig_env
        .clone()
        .unwrap_or_else(|| format!("{}/.kube/config", home));
    let kubeconfig_exists = std::path::Path::new(&kubeconfig_path).exists();

    // Get PATH info for cloud CLIs
    let path = env::var("PATH").unwrap_or_default();
    let path_contains_azure = path.contains("azure") || path.contains("az");
    let path_contains_gcloud = path.contains("gcloud") || path.contains("google-cloud");
    let path_contains_aws = path.contains("aws");

    // Azure config dir
    let azure_config_dir = env::var("AZURE_CONFIG_DIR")
        .ok()
        .or_else(|| Some(format!("{}/.azure", home)));

    let environment = EnvironmentInfo {
        home: Some(home.clone()),
        kubeconfig_env,
        azure_config_dir,
        path_contains_azure,
        path_contains_gcloud,
        path_contains_aws,
    };

    // Get connection status
    let connected = state.k8s.is_connected().await;
    let current_context = state.k8s.get_current_context().await;
    let connection_status = if connected {
        "Connected".to_string()
    } else {
        "Not connected".to_string()
    };

    // Get context info
    let mut contexts = Vec::new();
    if let Ok(kubeconfig) = KubeConfig::load().await {
        for ctx in &kubeconfig.contexts {
            let cluster = kubeconfig.get_cluster(&ctx.cluster);
            let user = kubeconfig.users.iter().find(|u| u.name == ctx.user);

            let auth_type = user
                .map(|u| format!("{:?}", u.auth_type))
                .unwrap_or_else(|| "Unknown".to_string());

            let server = cluster
                .map(|c| c.server.clone())
                .unwrap_or_else(|| "Unknown".to_string());

            // Mask sensitive parts of the server URL for privacy
            let server_masked = if server.len() > 30 {
                format!("{}...{}", &server[..20], &server[server.len() - 10..])
            } else {
                server.clone()
            };

            contexts.push(ContextDebugInfo {
                name: ctx.name.clone(),
                cluster: ctx.cluster.clone(),
                user: ctx.user.clone(),
                auth_type,
                server: server_masked,
                server_reachable: None, // Could add connectivity check later
            });
        }
    }

    // Build error details with more context
    let error_details = if let Some(err) = error_message {
        let mut details = format!("Error: {}\n", err);

        if let Some(ref ctx) = failed_context {
            details.push_str(&format!("Failed context: {}\n", ctx));

            // Add hints based on error type
            if err.contains("exec") || err.contains("credential") {
                details.push_str("\nPossible causes:\n");
                details.push_str("- Azure CLI not logged in (run 'az login')\n");
                details.push_str("- kubelogin not installed or not in PATH\n");
                details.push_str("- PIM role not activated\n");
                details.push_str("- Token expired\n");
            } else if err.contains("certificate") || err.contains("tls") || err.contains("SSL") {
                details.push_str("\nPossible causes:\n");
                details.push_str("- Certificate expired or invalid\n");
                details.push_str("- CA certificate not trusted\n");
                details.push_str("- Network proxy interfering with TLS\n");
            } else if err.contains("timeout") || err.contains("connection refused") {
                details.push_str("\nPossible causes:\n");
                details.push_str("- Cluster not reachable (network issue)\n");
                details.push_str("- VPN not connected\n");
                details.push_str("- Firewall blocking connection\n");
            }
        }

        Some(details)
    } else {
        None
    };

    Ok(DebugInfo {
        app_version,
        os,
        arch,
        kubeconfig_path,
        kubeconfig_exists,
        contexts,
        current_context,
        connection_status,
        environment,
        error_details,
    })
}

/// Generate a debug log file content
#[command]
pub async fn generate_debug_log(
    state: State<'_, AppState>,
    failed_context: Option<String>,
    error_message: Option<String>,
) -> Result<String, String> {
    let debug_info = export_debug_info(state.clone(), failed_context, error_message).await?;

    let mut log = String::new();
    log.push_str("=== Kubeli Debug Log ===\n");
    log.push_str(&format!(
        "Generated: {}\n\n",
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
    ));

    log.push_str("=== System Info ===\n");
    log.push_str(&format!("App Version: {}\n", debug_info.app_version));
    log.push_str(&format!("OS: {} ({})\n", debug_info.os, debug_info.arch));
    log.push_str(&format!(
        "Kubeconfig Path: {}\n",
        debug_info.kubeconfig_path
    ));
    log.push_str(&format!(
        "Kubeconfig Exists: {}\n",
        debug_info.kubeconfig_exists
    ));
    log.push_str(&format!(
        "Connection Status: {}\n",
        debug_info.connection_status
    ));
    if let Some(ctx) = &debug_info.current_context {
        log.push_str(&format!("Current Context: {}\n", ctx));
    }

    log.push_str("\n=== Environment ===\n");
    if let Some(home) = &debug_info.environment.home {
        log.push_str(&format!("HOME: {}\n", home));
    }
    if let Some(kc) = &debug_info.environment.kubeconfig_env {
        log.push_str(&format!("KUBECONFIG: {}\n", kc));
    }
    log.push_str(&format!(
        "Azure CLI in PATH: {}\n",
        debug_info.environment.path_contains_azure
    ));
    log.push_str(&format!(
        "gcloud in PATH: {}\n",
        debug_info.environment.path_contains_gcloud
    ));
    log.push_str(&format!(
        "AWS CLI in PATH: {}\n",
        debug_info.environment.path_contains_aws
    ));

    log.push_str("\n=== Contexts ===\n");
    for ctx in &debug_info.contexts {
        log.push_str(&format!("\n[{}]\n", ctx.name));
        log.push_str(&format!("  Cluster: {}\n", ctx.cluster));
        log.push_str(&format!("  User: {}\n", ctx.user));
        log.push_str(&format!("  Auth Type: {}\n", ctx.auth_type));
        log.push_str(&format!("  Server: {}\n", ctx.server));
    }

    if let Some(details) = &debug_info.error_details {
        log.push_str("\n=== Error Details ===\n");
        log.push_str(details);
    }

    if let Some(connection_log) = state.k8s.get_last_connection_log().await {
        log.push_str("\n=== Latest Connection Attempt ===\n");
        log.push_str(&connection_log);
        if !connection_log.ends_with('\n') {
            log.push('\n');
        }
    }

    log.push_str("\n=== End of Debug Log ===\n");

    Ok(log)
}
