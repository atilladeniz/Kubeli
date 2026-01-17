#![allow(unused_variables)] // Some state parameters may be unused but are required by Tauri command signatures

use crate::k8s::{AppState, AuthType, KubeConfig};
use serde::{Deserialize, Serialize};
use tauri::{command, State};

/// Cluster information returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterInfo {
    pub id: String,
    pub name: String,
    pub context: String,
    pub server: String,
    pub namespace: Option<String>,
    pub user: String,
    pub auth_type: String,
    pub current: bool,
}

/// Connection status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionStatus {
    pub connected: bool,
    pub context: Option<String>,
    pub error: Option<String>,
    pub latency_ms: Option<u64>,
}

/// Health check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckResult {
    pub healthy: bool,
    pub latency_ms: Option<u64>,
    pub error: Option<String>,
}

/// List all available clusters from kubeconfig
#[command]
pub async fn list_clusters(_state: State<'_, AppState>) -> Result<Vec<ClusterInfo>, String> {
    // Try to load kubeconfig
    let kubeconfig = match KubeConfig::load().await {
        Ok(config) => config,
        Err(e) => {
            tracing::warn!("Failed to load kubeconfig: {}", e);
            return Ok(vec![]);
        }
    };

    let current_context = kubeconfig.current_context.as_deref();

    let clusters: Vec<ClusterInfo> = kubeconfig
        .contexts
        .iter()
        .filter_map(|ctx| {
            let cluster = kubeconfig.get_cluster(&ctx.cluster)?;
            let user = kubeconfig.users.iter().find(|u| u.name == ctx.user)?;

            let auth_type_str = match &user.auth_type {
                AuthType::ClientCertificate => "certificate",
                AuthType::Token => "token",
                AuthType::ExecPlugin => "exec",
                AuthType::Oidc => "oidc",
                AuthType::Unknown => "unknown",
            };

            Some(ClusterInfo {
                id: ctx.name.clone(),
                name: ctx.cluster.clone(),
                context: ctx.name.clone(),
                server: cluster.server.clone(),
                namespace: ctx.namespace.clone(),
                user: ctx.user.clone(),
                auth_type: auth_type_str.to_string(),
                current: current_context == Some(ctx.name.as_str()),
            })
        })
        .collect();

    tracing::info!("Found {} clusters", clusters.len());
    Ok(clusters)
}

/// Get current connection status
#[command]
pub async fn get_connection_status(state: State<'_, AppState>) -> Result<ConnectionStatus, String> {
    let connected = state.k8s.is_connected().await;
    let context = state.k8s.get_current_context().await;

    Ok(ConnectionStatus {
        connected,
        context,
        error: None,
        latency_ms: None,
    })
}

/// Check connection health with latency measurement
#[command]
pub async fn check_connection_health(
    state: State<'_, AppState>,
) -> Result<HealthCheckResult, String> {
    if !state.k8s.is_connected().await {
        return Ok(HealthCheckResult {
            healthy: false,
            latency_ms: None,
            error: Some("Not connected to any cluster".to_string()),
        });
    }

    let start = std::time::Instant::now();

    match state.k8s.test_connection().await {
        Ok(true) => {
            let latency = start.elapsed().as_millis() as u64;
            Ok(HealthCheckResult {
                healthy: true,
                latency_ms: Some(latency),
                error: None,
            })
        }
        Ok(false) => {
            let latency = start.elapsed().as_millis() as u64;
            Ok(HealthCheckResult {
                healthy: false,
                latency_ms: Some(latency),
                error: Some("Connection test failed".to_string()),
            })
        }
        Err(e) => Ok(HealthCheckResult {
            healthy: false,
            latency_ms: None,
            error: Some(e.to_string()),
        }),
    }
}

/// Connect to a cluster using a specific context
#[command]
pub async fn connect_cluster(
    state: State<'_, AppState>,
    context: String,
) -> Result<ConnectionStatus, String> {
    tracing::info!("Connecting to cluster with context: {}", context);

    match state.k8s.init_with_context(&context).await {
        Ok(_) => {
            // Test the connection with latency measurement
            let start = std::time::Instant::now();
            match state.k8s.test_connection().await {
                Ok(true) => {
                    let latency = start.elapsed().as_millis() as u64;
                    tracing::info!(
                        "Successfully connected to cluster: {} (latency: {}ms)",
                        context,
                        latency
                    );
                    Ok(ConnectionStatus {
                        connected: true,
                        context: Some(context),
                        error: None,
                        latency_ms: Some(latency),
                    })
                }
                Ok(false) => {
                    let latency = start.elapsed().as_millis() as u64;
                    tracing::warn!("Connection test failed for context: {}", context);
                    Ok(ConnectionStatus {
                        connected: false,
                        context: Some(context),
                        error: Some("Connection test failed - unable to reach cluster".to_string()),
                        latency_ms: Some(latency),
                    })
                }
                Err(e) => {
                    tracing::error!("Connection test error: {}", e);
                    Ok(ConnectionStatus {
                        connected: false,
                        context: Some(context),
                        error: Some(format!("Connection test failed: {}", e)),
                        latency_ms: None,
                    })
                }
            }
        }
        Err(e) => {
            tracing::error!("Failed to connect to cluster: {}", e);
            Ok(ConnectionStatus {
                connected: false,
                context: Some(context),
                error: Some(format!("Failed to connect: {}", e)),
                latency_ms: None,
            })
        }
    }
}

/// Switch to a different context
#[command]
pub async fn switch_context(
    state: State<'_, AppState>,
    context: String,
) -> Result<ConnectionStatus, String> {
    connect_cluster(state, context).await
}

/// Disconnect from current cluster
#[command]
#[allow(unused_variables)] // State parameter required by Tauri command signature
pub async fn disconnect_cluster(_state: State<'_, AppState>) -> Result<(), String> {
    tracing::info!("Disconnecting from cluster");
    // The client manager will be reset when a new connection is made
    // For now, we just log the disconnect
    Ok(())
}

/// Get list of namespaces in the current cluster
#[command]
pub async fn get_namespaces(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    if !state.k8s.is_connected().await {
        return Err("Not connected to any cluster".to_string());
    }

    state
        .k8s
        .list_namespaces()
        .await
        .map_err(|e| format!("Failed to list namespaces: {}", e))
}

/// Add a new cluster from kubeconfig content
#[command]
pub async fn add_cluster(kubeconfig_content: String) -> Result<(), String> {
    // For now, we just validate the kubeconfig
    // In a full implementation, we would merge it with the existing kubeconfig
    match KubeConfig::parse(&kubeconfig_content, std::path::PathBuf::from("imported")) {
        Ok(config) => {
            tracing::info!(
                "Validated kubeconfig with {} contexts",
                config.contexts.len()
            );
            Ok(())
        }
        Err(e) => Err(format!("Invalid kubeconfig: {}", e)),
    }
}

/// Remove a cluster configuration
#[command]
pub async fn remove_cluster(context: String) -> Result<(), String> {
    tracing::info!("Remove cluster requested for context: {}", context);
    // In a full implementation, we would modify the kubeconfig file
    // For now, this is a placeholder
    Err("Cluster removal not yet implemented".to_string())
}

/// Check if kubeconfig exists
#[command]
pub async fn has_kubeconfig() -> Result<bool, String> {
    Ok(KubeConfig::exists().await)
}
