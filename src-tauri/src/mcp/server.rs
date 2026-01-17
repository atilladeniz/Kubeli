//! MCP Server Implementation
//!
//! Implements a Model Context Protocol server for IDE integration.

use rmcp::transport::stdio;
use rmcp::ServiceExt;
use std::sync::Arc;
use tokio::sync::RwLock;

use super::tools::KubeliMcpServer;
use crate::k8s::KubeClientManager;

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
        let manager = KubeClientManager::new();
        manager
            .init()
            .await
            .map_err(|e| format!("Failed to initialize kube client: {}", e))?;

        let client = manager
            .get_client()
            .await
            .map_err(|e| format!("Failed to get kube client: {}", e))?;

        let mut guard = self.kube_client.write().await;
        *guard = Some(client);
        Ok(())
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
