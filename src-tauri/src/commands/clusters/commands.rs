#![allow(unused_variables)] // Some state parameters may be unused but are required by Tauri command signatures

use crate::error::KubeliError;
use crate::k8s::{AppState, AuthType, KubeConfig};
use crate::oidc::commands::OidcState;
use crate::oidc::config::detect_oidc_exec;
use kube::config::Kubeconfig;
use kube::Client;
use std::sync::Arc;
use tauri::{command, AppHandle, Manager, State};
use tokio::sync::RwLock;

use super::kubeconfig::{
    build_kubeconfig_for_connect, is_self_contained, load_configured_namespaces,
    load_kubeconfig_from_sources,
};
use super::types::{
    ClusterInfo, ConnectionStatus, HealthCheckResult, NamespaceResult, OidcAuthInfo,
};

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
        oidc_auth_required: None,
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
    let mut kubeconfig = if let Some(ref src) = source_file {
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

    // Detect an OIDC exec plugin for this context's user and resolve a token
    // natively (cached → refresh → interactive). If none can be obtained,
    // surface oidc_auth_required so the frontend can start the browser flow.
    let user_name = kubeconfig
        .contexts
        .iter()
        .find(|c| c.name == context)
        .and_then(|c| c.context.as_ref())
        .and_then(|ctx| ctx.user.clone());

    let mut active_oidc: Option<crate::oidc::config::OidcExecConfig> = None;

    if let Some(ref user) = user_name {
        if let Some(oidc_config) = detect_oidc_exec(&kubeconfig, user) {
            let oidc_state: State<'_, Arc<OidcState>> = app.state();

            let token = resolve_oidc_token(&app, &oidc_state, &oidc_config).await;

            match token {
                Some(id_token) => {
                    inject_oidc_token(&mut kubeconfig, user, &id_token);
                    active_oidc = Some(oidc_config);
                }
                None => {
                    return Ok(ConnectionStatus {
                        connected: false,
                        context: Some(context),
                        error: None,
                        latency_ms: None,
                        oidc_auth_required: Some(OidcAuthInfo {
                            issuer_url: oidc_config.issuer_url,
                            client_id: oidc_config.client_id,
                            extra_scopes: oidc_config.extra_scopes,
                        }),
                    });
                }
            }
        }
    }

    match state
        .k8s
        .init_with_context(&context, kubeconfig.clone(), source_file.as_deref())
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
                    // Keep the OIDC token fresh for the lifetime of the connection
                    if let (Some(oidc_config), Some(ref user)) = (active_oidc, &user_name) {
                        let oidc_state: State<'_, Arc<OidcState>> = app.state();
                        spawn_oidc_refresh_task(
                            app.clone(),
                            state.k8s.client_handle(),
                            state.k8s.context_handle(),
                            Arc::clone(&oidc_state),
                            oidc_config,
                            context.clone(),
                            kubeconfig,
                            user.clone(),
                        );
                    }

                    Ok(ConnectionStatus {
                        connected: true,
                        context: Some(context),
                        error: None,
                        latency_ms: Some(latency),
                        oidc_auth_required: None,
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
                        oidc_auth_required: None,
                    })
                }
                Err(e) => {
                    tracing::error!("Connection test error: {}", e);
                    Ok(ConnectionStatus {
                        connected: false,
                        context: Some(context),
                        error: Some(format!("Connection test failed: {}", e)),
                        latency_ms: None,
                        oidc_auth_required: None,
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
                oidc_auth_required: None,
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
pub async fn disconnect_cluster(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), KubeliError> {
    tracing::info!("Disconnecting from cluster");
    let oidc_state: State<'_, Arc<OidcState>> = app.state();
    oidc_state.cancel_refresh();
    *state.k8s.client_handle().write().await = None;
    *state.k8s.context_handle().write().await = None;
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

async fn resolve_oidc_token(
    app: &AppHandle,
    oidc_state: &OidcState,
    config: &crate::oidc::config::OidcExecConfig,
) -> Option<String> {
    if let Some(token) = oidc_state
        .token_store
        .get_valid_token(&config.issuer_url, &config.client_id)
    {
        return Some(token);
    }

    let refresh_token = crate::oidc::store::OidcTokenStore::load_refresh_token(
        &config.issuer_url,
        &config.client_id,
    );

    if let Some(ref rt) = refresh_token {
        match oidc_state.flow_manager.refresh_token(config, rt).await {
            Ok(tokens) => {
                oidc_state.token_store.store_tokens(
                    &config.issuer_url,
                    &config.client_id,
                    tokens.clone(),
                );
                if let Some(ref new_rt) = tokens.refresh_token {
                    crate::oidc::store::OidcTokenStore::save_refresh_token(
                        &config.issuer_url,
                        &config.client_id,
                        new_rt,
                    );
                }
                return Some(tokens.id_token);
            }
            Err(_) => {
                oidc_state
                    .token_store
                    .clear(&config.issuer_url, &config.client_id);
                crate::oidc::store::OidcTokenStore::delete_refresh_token(
                    &config.issuer_url,
                    &config.client_id,
                );
            }
        }
    }

    None
}

#[allow(clippy::too_many_arguments)]
fn spawn_oidc_refresh_task(
    app_handle: AppHandle,
    k8s_manager: Arc<RwLock<Option<Client>>>,
    k8s_connected: Arc<RwLock<Option<String>>>,
    oidc_state: Arc<OidcState>,
    oidc_config: crate::oidc::config::OidcExecConfig,
    context_name: String,
    kubeconfig: Kubeconfig,
    user_name: String,
) {
    oidc_state.cancel_refresh();
    let stop_flag = oidc_state.get_refresh_stop_flag();

    tokio::spawn(async move {
        loop {
            let expires_at = match oidc_state
                .token_store
                .get_token_expiry(&oidc_config.issuer_url, &oidc_config.client_id)
            {
                Some(expiry) => expiry,
                None => break,
            };

            let now = chrono::Utc::now();
            let lifetime = (expires_at - now).num_seconds();
            let refresh_in = std::cmp::max(lifetime * 3 / 4, 5) as u64;

            tracing::debug!(
                "OIDC token refresh scheduled in {}s (token lifetime {}s)",
                refresh_in,
                lifetime
            );

            let check_interval = std::cmp::min(refresh_in, 5);
            let mut elapsed = 0u64;
            while elapsed < refresh_in {
                if stop_flag.load(std::sync::atomic::Ordering::Relaxed) {
                    tracing::debug!("OIDC refresh loop cancelled");
                    return;
                }
                tokio::time::sleep(tokio::time::Duration::from_secs(check_interval)).await;
                elapsed += check_interval;
            }

            if stop_flag.load(std::sync::atomic::Ordering::Relaxed) {
                break;
            }

            let connected_context = k8s_connected.read().await.clone();
            if connected_context.as_deref() != Some(context_name.as_str()) {
                tracing::debug!("OIDC refresh loop stopping: context changed");
                break;
            }

            let refresh_token = match crate::oidc::store::OidcTokenStore::load_refresh_token(
                &oidc_config.issuer_url,
                &oidc_config.client_id,
            ) {
                Some(rt) => rt,
                None => {
                    tracing::warn!("No refresh token available, stopping OIDC refresh loop");
                    break;
                }
            };

            match oidc_state
                .flow_manager
                .refresh_token(&oidc_config, &refresh_token)
                .await
            {
                Ok(tokens) => {
                    let new_token = tokens.id_token.clone();
                    if let Some(ref new_rt) = tokens.refresh_token {
                        crate::oidc::store::OidcTokenStore::save_refresh_token(
                            &oidc_config.issuer_url,
                            &oidc_config.client_id,
                            new_rt,
                        );
                    }
                    oidc_state.token_store.store_tokens(
                        &oidc_config.issuer_url,
                        &oidc_config.client_id,
                        tokens,
                    );

                    let mut refreshed_kubeconfig = kubeconfig.clone();
                    inject_oidc_token(&mut refreshed_kubeconfig, &user_name, &new_token);

                    let new_client =
                        match build_client_from_kubeconfig(refreshed_kubeconfig, &context_name)
                            .await
                        {
                            Ok(c) => c,
                            Err(e) => {
                                tracing::error!(
                                    "Failed to create client after OIDC refresh: {}",
                                    e
                                );
                                break;
                            }
                        };

                    *k8s_manager.write().await = Some(new_client);

                    tracing::info!("OIDC token refreshed and kube client reinitialized");

                    use tauri::Emitter;
                    let _ = app_handle.emit("oidc-token-refreshed", ());
                }
                Err(e) => {
                    tracing::warn!("OIDC token refresh failed: {}", e);
                    oidc_state
                        .token_store
                        .clear(&oidc_config.issuer_url, &oidc_config.client_id);
                    crate::oidc::store::OidcTokenStore::delete_refresh_token(
                        &oidc_config.issuer_url,
                        &oidc_config.client_id,
                    );
                    break;
                }
            }
        }
    });
}

async fn build_client_from_kubeconfig(
    kubeconfig: Kubeconfig,
    context_name: &str,
) -> Result<Client, String> {
    let config = kube::Config::from_custom_kubeconfig(
        kubeconfig,
        &kube::config::KubeConfigOptions {
            context: Some(context_name.to_string()),
            cluster: None,
            user: None,
        },
    )
    .await
    .map_err(|e| format!("Config creation failed: {}", e))?;

    Client::try_from(config).map_err(|e| format!("Client creation failed: {}", e))
}

fn inject_oidc_token(kubeconfig: &mut Kubeconfig, user_name: &str, token: &str) {
    if let Some(auth_entry) = kubeconfig
        .auth_infos
        .iter_mut()
        .find(|a| a.name == user_name)
    {
        if let Some(ref mut auth_info) = auth_entry.auth_info {
            auth_info.exec = None;
            auth_info.token = Some(secrecy::SecretString::from(token.to_string()));
        }
    }
}

/// Check if kubeconfig exists
#[command]
pub async fn has_kubeconfig() -> Result<bool, KubeliError> {
    Ok(KubeConfig::exists().await)
}
