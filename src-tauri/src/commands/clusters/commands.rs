#![allow(unused_variables)] // Some state parameters may be unused but are required by Tauri command signatures

use crate::error::KubeliError;
use crate::k8s::{AppState, AuthType, KubeConfig};
use crate::oidc::commands::OidcState;
use crate::oidc::config::{detect_oidc_exec, exec_provider_runnable};
use crate::oidc::flow::RefreshError;
use kube::config::Kubeconfig;
use kube::Client;
use std::sync::Arc;
use tauri::{command, AppHandle, Manager, State};
use tokio::sync::RwLock;

use super::kubeconfig::{
    build_kubeconfig_for_connect, is_self_contained, load_configured_namespaces,
    load_kubeconfig_from_sources, load_prefer_kubeconfig_auth,
};
use super::types::{
    ClusterInfo, ConnectionStatus, HealthCheckResult, NamespaceResult, OidcAuthInfo,
};

/// Stop the sessions that are bound to the cluster we're looking at (watches,
/// log streams, shells). Called before switching contexts and on disconnect -
/// otherwise these streams keep running against the old cluster.
///
/// Port-forwards are intentionally NOT torn down here (nor on disconnect): a
/// forward is its own live tunnel and should survive a cluster switch, which in
/// this app is a disconnect back to the picker plus connecting elsewhere (#388).
/// Forwards only end on user-stop, pod death, error, or process exit.
async fn teardown_active_sessions(app: &AppHandle, state: &AppState) {
    let old_client = state.k8s.get_client().await.ok();

    let watches: State<'_, Arc<crate::commands::watch::WatchManager>> = app.state();
    watches.stop_all().await;

    let logs: State<'_, Arc<crate::commands::logs::LogStreamManager>> = app.state();
    logs.stop_all().await;

    let shells: State<'_, Arc<crate::commands::shell::ShellSessionManager>> = app.state();
    shells.stop_all(old_client).await;
}

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

    // Serialize connect attempts - two racing connects would interleave
    // init/test and could leave client and context mismatched.
    let _connect_guard = state.k8s.begin_connect().await;

    // Stop a previous connection's OIDC refresh loop before switching; a
    // non-OIDC target would otherwise keep the old task alive forever.
    {
        let oidc_state: State<'_, Arc<OidcState>> = app.state();
        oidc_state.cancel_refresh();
    }

    // Tear down all sessions of the previous connection before the client
    // is replaced.
    teardown_active_sessions(&app, &state).await;

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

    // Decide between two OIDC paths for an exec-based kubeconfig:
    //
    //   1. Let kube-rs run the kubeconfig's exec provider (kubectl oidc-login /
    //      kubelogin / Pinniped). This is the standard, best-practice behaviour
    //      (the same one Headlamp and Lens use) and is what makes issue #335
    //      work: the user's kubeconfig already authenticates with kubectl.
    //   2. Kubeli's native browser flow (Authorization Code + PKCE), which needs
    //      no plugin binary but cannot complete in some environments (#335).
    //
    // Prefer (1) whenever the plugin binary is actually installed, and fall back
    // to (2) only when it is missing — that keeps the no-binary comfort added in
    // e079d70 while no longer overriding a working exec setup. A per-cluster
    // "use kubeconfig auth only" flag forces (1) regardless of detection.
    let prefer_kubeconfig_auth = load_prefer_kubeconfig_auth(&app, &context);
    if prefer_kubeconfig_auth {
        tracing::info!(
            "Context '{}' set to use kubeconfig auth only; skipping native OIDC",
            context
        );
    }

    if let Some(ref user) = user_name {
        if let Some(oidc_config) = detect_oidc_exec(&kubeconfig, user).filter(|cfg| {
            // Use native OIDC only when the user hasn't forced exec auth AND the
            // exec provider isn't runnable; otherwise let kube-rs run exec.
            let run_exec = prefer_kubeconfig_auth || exec_provider_runnable(cfg);
            if run_exec {
                tracing::info!(
                    "Context '{}' uses exec plugin '{}'; letting kube-rs run it (skipping native OIDC)",
                    context,
                    cfg.command
                );
            }
            !run_exec
        }) {
            let oidc_state: State<'_, Arc<OidcState>> = app.state();

            // Remember the CA/TLS settings so the interactive browser flow
            // (oidc_start_auth, which only gets issuer/client/scopes from the UI)
            // can trust a private-CA IdP too.
            oidc_state.remember_config(&oidc_config);

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

    // Hard timeout: exec-plugin based configs can hang indefinitely (e.g.
    // waiting for a device-code login that never happens).
    let init_result = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        state
            .k8s
            .init_with_context(&context, kubeconfig.clone(), source_file.as_deref()),
    )
    .await;

    match init_result {
        Err(_) => {
            tracing::error!("Connection init timed out for context: {}", context);
            state.k8s.clear_connection().await;
            Ok(ConnectionStatus {
                connected: false,
                context: Some(context),
                error: Some("Connection attempt timed out after 30s".to_string()),
                latency_ms: None,
                oidc_auth_required: None,
            })
        }
        Ok(init_result) => match init_result {
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
                        // Remove debug pods orphaned by a previous run/crash
                        if let Ok(client) = state.k8s.get_client().await {
                            crate::commands::shell::sweep_orphaned_debug_pods(client);
                        }
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
                        state.k8s.clear_connection().await;
                        Ok(ConnectionStatus {
                            connected: false,
                            context: Some(context),
                            error: Some(
                                "Connection test failed - unable to reach cluster".to_string(),
                            ),
                            latency_ms: Some(latency),
                            oidc_auth_required: None,
                        })
                    }
                    Err(e) => {
                        tracing::error!("Connection test error: {}", e);
                        state.k8s.clear_connection().await;
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
                // A failed init may have overwritten (or half-replaced) the
                // previous connection - never keep a client that did not pass.
                state.k8s.clear_connection().await;
                Ok(ConnectionStatus {
                    connected: false,
                    context: Some(context),
                    error: Some(format!("Failed to connect: {}", e)),
                    latency_ms: None,
                    oidc_auth_required: None,
                })
            }
        },
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
    teardown_active_sessions(&app, &state).await;

    // Port-forwards are intentionally NOT stopped here. A forward is its own
    // live tunnel and should survive a cluster switch — which in this app is a
    // disconnect back to the picker followed by connecting elsewhere (#388).
    // Forwards die with the process on quit; until then they keep tunneling and
    // stay visible/controllable via the all-forwards view.

    state.k8s.clear_connection().await;
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
            // Structural check for 403 Forbidden (RBAC restriction) instead of
            // message sniffing: walk the anyhow chain for the kube API error.
            let forbidden = e.chain().any(|cause| {
                matches!(
                    cause.downcast_ref::<kube::Error>(),
                    Some(kube::Error::Api(resp)) if resp.code == 403
                )
            });
            if forbidden {
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
    _app: &AppHandle,
    oidc_state: &OidcState,
    config: &crate::oidc::config::OidcExecConfig,
) -> Option<String> {
    // OidcState::refresh() handles the cache check, serialized refresh, rotation
    // and (on a definitive invalid_grant only) cleanup. A None here means no
    // usable token and the caller surfaces oidc_auth_required to start the
    // interactive browser flow.
    match oidc_state.refresh(config).await {
        Ok(token) => Some(token),
        Err(e) => {
            tracing::warn!("OIDC token resolution failed: {}", e);
            None
        }
    }
}

/// Delay before proactively refreshing: ~3/4 of the token's remaining lifetime,
/// with a 5s floor so a near-expired or already-expired token is retried promptly.
fn refresh_delay_secs(remaining_lifetime_secs: i64) -> u64 {
    std::cmp::max(remaining_lifetime_secs * 3 / 4, 5) as u64
}

/// Sleep up to `seconds`, polling `stop_flag` every few seconds so the wait is
/// promptly cancellable. Returns false if cancelled, true if it slept the full
/// duration without being cancelled.
async fn sleep_cancellable(seconds: u64, stop_flag: &std::sync::atomic::AtomicBool) -> bool {
    use std::sync::atomic::Ordering;
    let check_interval = seconds.clamp(1, 5);
    let mut elapsed = 0u64;
    while elapsed < seconds {
        if stop_flag.load(std::sync::atomic::Ordering::Relaxed) {
            return false;
        }
        let step = std::cmp::min(check_interval, seconds - elapsed);
        tokio::time::sleep(tokio::time::Duration::from_secs(step)).await;
        elapsed += step;
    }
    !stop_flag.load(Ordering::Relaxed)
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
    let stop_flag = oidc_state.arm_refresh();

    tokio::spawn(async move {
        while let Some(expires_at) = oidc_state
            .token_store
            .get_token_expiry(&oidc_config.issuer_url, &oidc_config.client_id)
        {
            let lifetime = (expires_at - chrono::Utc::now()).num_seconds();
            let refresh_in = refresh_delay_secs(lifetime);
            tracing::debug!(
                "OIDC token refresh scheduled in {}s (token lifetime {}s)",
                refresh_in,
                lifetime
            );

            if !sleep_cancellable(refresh_in, &stop_flag).await {
                tracing::debug!("OIDC refresh loop cancelled");
                return;
            }

            // Stop if the user switched away from or disconnected this context.
            if k8s_connected.read().await.as_deref() != Some(context_name.as_str()) {
                tracing::debug!("OIDC refresh loop stopping: context changed");
                break;
            }

            // Refresh, retrying transient failures (network, IdP 5xx) with capped
            // backoff so a blip does not permanently kill the loop or force a
            // re-login. Only a terminal invalid_grant stops the loop (refresh()
            // has already discarded the dead token in that case).
            let mut backoff = 5u64;
            let new_token = loop {
                match oidc_state.refresh(&oidc_config).await {
                    Ok(token) => break Some(token),
                    Err(RefreshError::Terminal(e)) => {
                        tracing::warn!("OIDC token refresh failed permanently: {}", e);
                        break None;
                    }
                    Err(RefreshError::Transient(e)) => {
                        tracing::warn!(
                            "OIDC token refresh transient failure, retrying in {}s: {}",
                            backoff,
                            e
                        );
                        if !sleep_cancellable(backoff, &stop_flag).await {
                            return;
                        }
                        backoff = std::cmp::min(backoff * 2, 60);
                    }
                }
            };

            let Some(new_token) = new_token else {
                break;
            };

            let mut refreshed_kubeconfig = kubeconfig.clone();
            inject_oidc_token(&mut refreshed_kubeconfig, &user_name, &new_token);

            match build_client_from_kubeconfig(refreshed_kubeconfig, &context_name).await {
                Ok(new_client) => {
                    // Re-check the context while holding the client lock before
                    // swapping it in. A cluster switch may have landed while we
                    // were refreshing/​building; the connect path publishes the new
                    // context before its client, so if the context no longer
                    // matches, a newer client either is or will be installed and
                    // we must not clobber it with this stale one.
                    let mut client_guard = k8s_manager.write().await;
                    // Check the stop flag under the same lock: a reconnect to
                    // the SAME context arms a new refresh task - the context
                    // check alone would not stop this superseded one from
                    // clobbering the new connection's client.
                    if stop_flag.load(std::sync::atomic::Ordering::Relaxed)
                        || !refresh_target_is_current(&k8s_connected, &context_name).await
                    {
                        tracing::debug!(
                            "OIDC refresh: superseded during refresh, discarding stale client"
                        );
                        break;
                    }
                    *client_guard = Some(new_client);
                    drop(client_guard);
                    tracing::info!("OIDC token refreshed and kube client reinitialized");
                    use tauri::Emitter;
                    // Carry the refreshed context: forwards survive a cluster
                    // switch, so the frontend must restart only this cluster's.
                    let _ = app_handle.emit("oidc-token-refreshed", context_name.clone());
                }
                Err(e) => {
                    tracing::error!("Failed to create client after OIDC refresh: {}", e);
                    break;
                }
            }
        }
    });
}

/// Whether a freshly refreshed client for `context_name` may still be installed.
///
/// The background OIDC refresh can take seconds (token roundtrip + client build),
/// during which the user may switch clusters. Call this while holding the client
/// write lock so the check and the swap are atomic: if the active context no
/// longer matches, a newer connection already owns the client and this stale one
/// must be dropped instead of clobbering it.
async fn refresh_target_is_current(
    k8s_connected: &RwLock<Option<String>>,
    context_name: &str,
) -> bool {
    k8s_connected.read().await.as_deref() == Some(context_name)
}

async fn config_from_kubeconfig(
    kubeconfig: Kubeconfig,
    context_name: &str,
) -> Result<kube::Config, String> {
    let mut config = kube::Config::from_custom_kubeconfig(
        kubeconfig,
        &kube::config::KubeConfigOptions {
            context: Some(context_name.to_string()),
            cluster: None,
            user: None,
        },
    )
    .await
    .map_err(|e| format!("Config creation failed: {}", e))?;

    // Mirror the connect path: keep long-lived streams (log_stream, exec) alive
    // after a token refresh by not reinstating per-read/write timeouts. See #292.
    crate::k8s::client::apply_shared_client_timeouts(&mut config);
    Ok(config)
}

async fn build_client_from_kubeconfig(
    kubeconfig: Kubeconfig,
    context_name: &str,
) -> Result<Client, String> {
    let config = config_from_kubeconfig(kubeconfig, context_name).await?;
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

#[cfg(test)]
mod refresh_tests {
    use super::{config_from_kubeconfig, refresh_delay_secs, refresh_target_is_current};
    use kube::config::Kubeconfig;
    use tokio::sync::RwLock;

    #[test]
    fn refreshes_at_three_quarters_of_lifetime() {
        assert_eq!(refresh_delay_secs(400), 300);
        assert_eq!(refresh_delay_secs(100), 75);
    }

    #[test]
    fn floors_at_five_seconds_for_short_or_expired_tokens() {
        assert_eq!(refresh_delay_secs(4), 5);
        assert_eq!(refresh_delay_secs(0), 5);
        assert_eq!(refresh_delay_secs(-120), 5);
    }

    // Regression: a token refresh that completes after the user switched away
    // must not overwrite the new connection's client. The guard keys off the
    // active context, which the connect path publishes before its client.
    #[tokio::test]
    async fn refresh_only_commits_when_context_still_matches() {
        let connected = RwLock::new(Some("cluster-a".to_string()));
        assert!(refresh_target_is_current(&connected, "cluster-a").await);

        *connected.write().await = Some("cluster-b".to_string());
        assert!(
            !refresh_target_is_current(&connected, "cluster-a").await,
            "stale refresh must not commit after a cluster switch"
        );

        *connected.write().await = None;
        assert!(
            !refresh_target_is_current(&connected, "cluster-a").await,
            "stale refresh must not commit after disconnect"
        );
    }

    // Regression for #292: the client rebuilt after an OIDC token refresh must
    // carry the same no-stream-timeout policy as the initial connect, otherwise
    // long-lived log/exec streams die ~295s after a refresh.
    #[tokio::test]
    async fn refreshed_client_keeps_streams_alive() {
        let kubeconfig = Kubeconfig::from_yaml(
            r#"
apiVersion: v1
kind: Config
clusters:
- name: test
  cluster:
    server: https://127.0.0.1:6443
contexts:
- name: test
  context:
    cluster: test
    user: test
users:
- name: test
  user:
    token: dummy
current-context: test
"#,
        )
        .expect("valid kubeconfig");

        let config = config_from_kubeconfig(kubeconfig, "test")
            .await
            .expect("config builds");

        assert!(
            config.read_timeout.is_none(),
            "read_timeout must stay unset after refresh (issue #292)"
        );
        assert!(
            config.write_timeout.is_none(),
            "write_timeout must stay unset after refresh (issue #292)"
        );
    }
}
