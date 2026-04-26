#![allow(unused_variables)] // Some state parameters may be unused but are required by Tauri command signatures

use crate::error::KubeliError;
use crate::k8s::{AppState, AuthType, KubeConfig};
use kube::config::Kubeconfig;
use tauri::{command, AppHandle, State};

use super::kubeconfig::{
    build_kubeconfig_for_connect, is_self_contained, load_configured_namespaces,
    load_kubeconfig_from_sources,
};
use super::types::{ClusterInfo, ConnectionStatus, HealthCheckResult, NamespaceResult};

/// List all available clusters from kubeconfig
#[command]
pub async fn list_clusters(
    app: AppHandle,
    _state: State<'_, AppState>,
) -> Result<Vec<ClusterInfo>, KubeliError> {
    // Try to load kubeconfig from configured sources
    let kubeconfig = match load_kubeconfig_from_sources(&app).await {
        Some(config) => config,
        None => {
            tracing::warn!("No kubeconfig available");
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
                source_file: ctx.source_file.clone(),
            })
        })
        .collect();

    tracing::info!("Found {} clusters", clusters.len());
    Ok(clusters)
}

/// Get current connection status
#[command]
pub async fn get_connection_status(
    state: State<'_, AppState>,
) -> Result<ConnectionStatus, KubeliError> {
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
) -> Result<HealthCheckResult, KubeliError> {
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
    app: AppHandle,
    state: State<'_, AppState>,
    context: String,
) -> Result<ConnectionStatus, KubeliError> {
    tracing::info!("Connecting to cluster with context: {}", context);

    // Resolve source_file for this context before building the kubeconfig
    let source_file = load_kubeconfig_from_sources(&app).await.and_then(|cfg| {
        cfg.contexts
            .iter()
            .find(|c| c.name == context)
            .and_then(|c| c.source_file.clone())
    });

    // When we know the source file, prefer loading ONLY that file to avoid name collisions.
    // Multiple kubeconfig files often define users/clusters with the same name (e.g. "admin")
    // but different certificates. Merging all files causes the first file's entries to
    // shadow subsequent ones, making only the first cluster's auth work.
    //
    // However, some setups intentionally split contexts, clusters, and users across files
    // (merge_mode). If the single file doesn't contain the referenced cluster or user,
    // fall back to the merged kubeconfig.
    let kubeconfig = if let Some(ref src) = source_file {
        let path = std::path::PathBuf::from(src);
        if path.exists() {
            let single = Kubeconfig::read_from(&path)
                .map_err(|e| format!("Failed to read kubeconfig {:?}: {}", path, e))?;

            if is_self_contained(&single, &context) {
                single
            } else {
                tracing::info!(
                    "Source file {:?} has cross-file references, using merged kubeconfig",
                    path
                );
                build_kubeconfig_for_connect(&app).await?
            }
        } else {
            tracing::warn!(
                "Source file {:?} not found, falling back to merged kubeconfig",
                path
            );
            build_kubeconfig_for_connect(&app).await?
        }
    } else {
        build_kubeconfig_for_connect(&app).await?
    };

    match state
        .k8s
        .init_with_context(&context, kubeconfig, source_file.as_deref())
        .await
    {
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
    app: AppHandle,
    state: State<'_, AppState>,
    context: String,
) -> Result<ConnectionStatus, KubeliError> {
    connect_cluster(app, state, context).await
}

/// Disconnect from current cluster
#[command]
#[allow(unused_variables)] // State parameter required by Tauri command signature
pub async fn disconnect_cluster(_state: State<'_, AppState>) -> Result<(), KubeliError> {
    tracing::info!("Disconnecting from cluster");
    // The client manager will be reset when a new connection is made
    // For now, we just log the disconnect
    Ok(())
}

/// Get list of namespaces in the current cluster.
/// Resolution order: configured namespaces → API discovery → fallback to configured on 403.
#[command]
pub async fn get_namespaces(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<NamespaceResult, KubeliError> {
    if !state.k8s.is_connected().await {
        return Err(KubeliError::unknown("Not connected to any cluster"));
    }

    let context = state.k8s.get_current_context().await.unwrap_or_default();

    // Check configured namespaces first
    let configured = load_configured_namespaces(&app, &context);

    if !configured.is_empty() {
        tracing::info!(
            "Using {} configured namespaces for context '{}'",
            configured.len(),
            context
        );
        return Ok(NamespaceResult {
            namespaces: configured,
            source: "configured".to_string(),
        });
    }

    // Try API discovery
    match state.k8s.list_namespaces().await {
        Ok(namespaces) => Ok(NamespaceResult {
            namespaces,
            source: "auto".to_string(),
        }),
        Err(e) => {
            let err_str = format!("{}", e);
            // Check if this is a 403 Forbidden (RBAC restriction)
            if err_str.contains("403") || err_str.to_lowercase().contains("forbidden") {
                tracing::info!(
                    "Namespace listing forbidden for context '{}', RBAC restricted",
                    context
                );
                // Return empty with "none" source — UI will prompt configuration
                Ok(NamespaceResult {
                    namespaces: vec![],
                    source: "none".to_string(),
                })
            } else {
                Err(KubeliError::from(e))
            }
        }
    }
}

/// Add a new cluster from kubeconfig content
#[command]
pub async fn add_cluster(kubeconfig_content: String) -> Result<(), KubeliError> {
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
        Err(e) => Err(KubeliError::unknown(format!("Invalid kubeconfig: {}", e))),
    }
}

/// Remove a cluster configuration
#[command]
pub async fn remove_cluster(context: String) -> Result<(), KubeliError> {
    tracing::info!("Remove cluster requested for context: {}", context);
    // In a full implementation, we would modify the kubeconfig file
    // For now, this is a placeholder
    Err(KubeliError::unknown("Cluster removal not yet implemented"))
}

/// Check if kubeconfig exists
#[command]
pub async fn has_kubeconfig() -> Result<bool, KubeliError> {
    Ok(KubeConfig::exists().await)
}
