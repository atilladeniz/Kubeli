//! MCP Server Implementation
//!
//! Implements a Model Context Protocol server for IDE integration.

use kube::config::{KubeConfigOptions, Kubeconfig};
use rmcp::transport::stdio;
use rmcp::ServiceExt;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

use super::tools::KubeliMcpServer;
use crate::k8s::client::apply_shared_client_timeouts;
use crate::k8s::{KubeClientManager, KubeConfig, KubeconfigSourceType, KubeconfigSourcesConfig};

/// MCP Server state
pub struct McpServerState {
    pub kube_client: Arc<RwLock<Option<kube::Client>>>,
}

impl McpServerState {
    pub fn new() -> Self {
        Self {
            kube_client: Arc::new(RwLock::new(None)),
        }
    }

    pub async fn connect_to_cluster(&self) -> Result<(), String> {
        // Prefer the kubeconfig sources configured in the app so the MCP
        // server sees the same clusters; fall back to the default kubeconfig.
        let client = match client_from_configured_sources().await {
            Some(client) => client,
            None => {
                let manager = KubeClientManager::new();
                manager
                    .init()
                    .await
                    .map_err(|e| format!("Failed to initialize kube client: {}", e))?;

                manager
                    .get_client()
                    .await
                    .map_err(|e| format!("Failed to get kube client: {}", e))?
            }
        };

        let mut guard = self.kube_client.write().await;
        *guard = Some(client);
        Ok(())
    }
}

/// Path of the kubeconfig sources store written by the desktop app.
/// The MCP server runs as a separate process (`--mcp`) without the Tauri
/// store plugin, so it reads the store file directly.
fn sources_store_path() -> Option<PathBuf> {
    // tauri-plugin-store writes to the app data dir (identifier "com.kubeli",
    // see tauri.conf.json).
    Some(
        dirs::data_dir()?
            .join("com.kubeli")
            .join("kubeconfig-sources.json"),
    )
}

/// Parse the tauri-plugin-store JSON (`{"sources_config": {...}}`).
fn parse_sources_store(content: &str) -> Option<KubeconfigSourcesConfig> {
    let json: serde_json::Value = serde_json::from_str(content).ok()?;
    serde_json::from_value(json.get("sources_config")?.clone()).ok()
}

/// Build a client from the app's configured kubeconfig sources, mirroring
/// the merge logic of `build_kubeconfig_for_connect`. Returns None when no
/// sources are configured or none of them can be used.
async fn client_from_configured_sources() -> Option<kube::Client> {
    let path = sources_store_path()?;
    let content = tokio::fs::read_to_string(&path).await.ok()?;
    let config = parse_sources_store(&content)?;
    if config.sources.is_empty() {
        return None;
    }

    let mut files: Vec<PathBuf> = Vec::new();
    for source in &config.sources {
        let path = PathBuf::from(&source.path);
        match source.source_type {
            KubeconfigSourceType::File => {
                if path.exists() {
                    files.push(path);
                }
            }
            KubeconfigSourceType::Folder => {
                if let Ok(entries) = KubeConfig::scan_folder(&path).await {
                    files.extend(entries);
                }
            }
        }
    }

    let mut merged: Option<Kubeconfig> = None;
    for file in &files {
        let cfg = match Kubeconfig::read_from(file) {
            Ok(c) => c,
            Err(e) => {
                tracing::warn!("Skipping kubeconfig {:?}: {}", file, e);
                continue;
            }
        };
        merged = Some(match merged {
            Some(existing) => match existing.merge(cfg) {
                Ok(m) => m,
                Err(e) => {
                    tracing::warn!("Failed to merge kubeconfig {:?}: {}", file, e);
                    return None;
                }
            },
            None => cfg,
        });
    }

    let mut config =
        match kube::Config::from_custom_kubeconfig(merged?, &KubeConfigOptions::default()).await {
            Ok(c) => c,
            Err(e) => {
                tracing::warn!("Failed to build config from configured sources: {}", e);
                return None;
            }
        };
    apply_shared_client_timeouts(&mut config);
    match kube::Client::try_from(config) {
        Ok(client) => Some(client),
        Err(e) => {
            tracing::warn!("Failed to create client from configured sources: {}", e);
            None
        }
    }
}

/// Run the MCP server in stdio mode
pub async fn run_mcp_server() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing for logging (to stderr to not interfere with stdio)
    tracing_subscriber::fmt()
        .with_writer(std::io::stderr)
        .with_env_filter("info")
        .init();

    tracing::info!("Starting Kubeli MCP Server...");

    // Create server state
    let state = Arc::new(McpServerState::new());

    // Try to connect to the default cluster
    if let Err(e) = state.connect_to_cluster().await {
        tracing::warn!("Could not connect to default cluster: {}", e);
    }

    // Create the MCP server with tools
    let server = KubeliMcpServer::new(state);

    tracing::info!("MCP Server ready, waiting for connections...");

    // Serve via stdio transport
    let service = server.serve(stdio()).await?;
    service.waiting().await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::parse_sources_store;

    #[test]
    fn parses_sources_config_from_store_file() {
        let content = r#"{
            "sources_config": {
                "merge_mode": false,
                "sources": [
                    {"path": "/home/user/.kube/config", "source_type": "file"},
                    {"path": "/home/user/.kube/extra", "source_type": "folder"}
                ]
            }
        }"#;
        let config = parse_sources_store(content).expect("should parse");
        assert_eq!(config.sources.len(), 2);
        assert!(!config.merge_mode);
        assert_eq!(config.sources[0].path, "/home/user/.kube/config");
    }

    #[test]
    fn returns_none_for_missing_key_or_invalid_json() {
        assert!(parse_sources_store("{}").is_none());
        assert!(parse_sources_store("not json").is_none());
        assert!(parse_sources_store(r#"{"sources_config": 42}"#).is_none());
    }
}
