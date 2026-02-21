#![allow(unused_variables)] // Some state parameters may be unused but are required by Tauri command signatures

use crate::k8s::{AppState, AuthType, KubeConfig, KubeconfigSourceType};
use kube::config::Kubeconfig;
use serde::{Deserialize, Serialize};
use tauri::{command, AppHandle, State};
use tauri_plugin_store::StoreExt;

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
    pub source_file: Option<String>,
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

/// Load kubeconfig using configured sources (or default)
async fn load_kubeconfig_from_sources(app: &AppHandle) -> Option<KubeConfig> {
    // Try to load sources config from store
    let sources_config = {
        let store = app.store("kubeconfig-sources.json").ok()?;
        match store.get("sources_config") {
            Some(value) => {
                serde_json::from_value::<crate::k8s::KubeconfigSourcesConfig>(value.clone()).ok()
            }
            None => None,
        }
    };

    match sources_config {
        Some(config) if !config.sources.is_empty() => {
            match KubeConfig::load_from_sources(&config.sources, config.merge_mode).await {
                Ok(cfg) => Some(cfg),
                Err(e) => {
                    tracing::warn!(
                        "Failed to load from sources: {}, falling back to default",
                        e
                    );
                    KubeConfig::load().await.ok()
                }
            }
        }
        _ => KubeConfig::load().await.ok(),
    }
}

/// List all available clusters from kubeconfig
#[command]
pub async fn list_clusters(
    app: AppHandle,
    _state: State<'_, AppState>,
) -> Result<Vec<ClusterInfo>, String> {
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

/// Build a merged kube-rs Kubeconfig from all configured sources for client connection
async fn build_kubeconfig_for_connect(app: &AppHandle) -> Result<Kubeconfig, String> {
    let sources_config = super::kubeconfig::load_sources_config(app);

    if sources_config.sources.is_empty() {
        return Kubeconfig::read().map_err(|e| format!("Failed to read kubeconfig: {}", e));
    }

    let mut all_files: Vec<std::path::PathBuf> = Vec::new();
    for source in &sources_config.sources {
        let path = std::path::PathBuf::from(&source.path);
        match source.source_type {
            KubeconfigSourceType::File => {
                if path.exists() {
                    all_files.push(path);
                }
            }
            KubeconfigSourceType::Folder => {
                if let Ok(entries) = KubeConfig::scan_folder(&path).await {
                    all_files.extend(entries);
                }
            }
        }
    }

    // Also respect KUBECONFIG env var
    if let Ok(env_val) = std::env::var("KUBECONFIG") {
        for path in std::env::split_paths(&env_val) {
            if path.exists() && !all_files.iter().any(|f| f == &path) {
                all_files.push(path);
            }
        }
    }

    if all_files.is_empty() {
        return Kubeconfig::read().map_err(|e| format!("Failed to read kubeconfig: {}", e));
    }

    merge_kubeconfig_files(&all_files).or_else(|_| {
        Kubeconfig::read().map_err(|e| format!("No valid kubeconfig files found: {}", e))
    })
}

/// Read and merge multiple kubeconfig files into a single kube-rs Kubeconfig.
/// Uses `Kubeconfig::read_from` to correctly resolve relative certificate paths.
/// Returns Err if no valid files could be parsed.
fn merge_kubeconfig_files(files: &[std::path::PathBuf]) -> Result<Kubeconfig, String> {
    let mut merged: Option<Kubeconfig> = None;

    for file in files {
        let cfg = match Kubeconfig::read_from(file) {
            Ok(c) => c,
            Err(e) => {
                tracing::warn!("Skipping kubeconfig {:?}: {}", file, e);
                continue;
            }
        };

        merged = Some(match merged {
            Some(existing) => existing
                .merge(cfg)
                .map_err(|e| format!("Failed to merge kubeconfig {:?}: {}", file, e))?,
            None => cfg,
        });
    }

    merged.ok_or_else(|| "No valid kubeconfig files could be parsed".to_string())
}

/// Connect to a cluster using a specific context
#[command]
pub async fn connect_cluster(
    app: AppHandle,
    state: State<'_, AppState>,
    context: String,
) -> Result<ConnectionStatus, String> {
    tracing::info!("Connecting to cluster with context: {}", context);

    // Resolve source_file for this context before building the merged kubeconfig
    let source_file = load_kubeconfig_from_sources(&app).await.and_then(|cfg| {
        cfg.contexts
            .iter()
            .find(|c| c.name == context)
            .and_then(|c| c.source_file.clone())
    });

    // Build merged kubeconfig from all configured sources
    let kubeconfig = build_kubeconfig_for_connect(&app).await?;

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
) -> Result<ConnectionStatus, String> {
    connect_cluster(app, state, context).await
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn write_kubeconfig(dir: &std::path::Path, name: &str, content: &str) -> PathBuf {
        let path = dir.join(name);
        std::fs::write(&path, content).unwrap();
        path
    }

    const KUBECONFIG_A: &str = r#"
apiVersion: v1
kind: Config
current-context: ctx-a
clusters:
- name: cluster-a
  cluster:
    server: https://cluster-a:6443
contexts:
- name: ctx-a
  context:
    cluster: cluster-a
    user: user-a
users:
- name: user-a
  user:
    token: token-a
"#;

    const KUBECONFIG_B: &str = r#"
apiVersion: v1
kind: Config
current-context: ctx-b
clusters:
- name: cluster-b
  cluster:
    server: https://cluster-b:6443
contexts:
- name: ctx-b
  context:
    cluster: cluster-b
    user: user-b
users:
- name: user-b
  user:
    token: token-b
"#;

    #[test]
    fn test_merge_single_file() {
        let dir = tempfile::tempdir().unwrap();
        let f = write_kubeconfig(dir.path(), "config.yaml", KUBECONFIG_A);

        let result = merge_kubeconfig_files(&[f]).unwrap();
        assert_eq!(result.contexts.len(), 1);
        assert_eq!(result.contexts[0].name, "ctx-a");
        assert_eq!(result.clusters.len(), 1);
        assert_eq!(result.auth_infos.len(), 1);
        assert_eq!(result.current_context, Some("ctx-a".to_string()));
    }

    #[test]
    fn test_merge_multiple_files_all_contexts_accessible() {
        let dir = tempfile::tempdir().unwrap();
        let f1 = write_kubeconfig(dir.path(), "cluster-a.yaml", KUBECONFIG_A);
        let f2 = write_kubeconfig(dir.path(), "cluster-b.yaml", KUBECONFIG_B);

        let result = merge_kubeconfig_files(&[f1, f2]).unwrap();

        // Both contexts must be present (this was the bug — only default file was read)
        assert_eq!(result.contexts.len(), 2);
        let ctx_names: Vec<&str> = result.contexts.iter().map(|c| c.name.as_str()).collect();
        assert!(ctx_names.contains(&"ctx-a"));
        assert!(ctx_names.contains(&"ctx-b"));

        // Both clusters and auth_infos merged
        assert_eq!(result.clusters.len(), 2);
        assert_eq!(result.auth_infos.len(), 2);
    }

    #[test]
    fn test_merge_current_context_from_first_file() {
        let dir = tempfile::tempdir().unwrap();
        let f1 = write_kubeconfig(dir.path(), "first.yaml", KUBECONFIG_A);
        let f2 = write_kubeconfig(dir.path(), "second.yaml", KUBECONFIG_B);

        let result = merge_kubeconfig_files(&[f1, f2]).unwrap();
        assert_eq!(result.current_context, Some("ctx-a".to_string()));

        // Reverse order: ctx-b should be current
        let dir2 = tempfile::tempdir().unwrap();
        let f3 = write_kubeconfig(dir2.path(), "first.yaml", KUBECONFIG_B);
        let f4 = write_kubeconfig(dir2.path(), "second.yaml", KUBECONFIG_A);

        let result2 = merge_kubeconfig_files(&[f3, f4]).unwrap();
        assert_eq!(result2.current_context, Some("ctx-b".to_string()));
    }

    #[test]
    fn test_merge_skips_invalid_files() {
        let dir = tempfile::tempdir().unwrap();
        let bad = write_kubeconfig(dir.path(), "bad.yaml", "not: valid: yaml: [[[");
        let good = write_kubeconfig(dir.path(), "good.yaml", KUBECONFIG_A);

        let result = merge_kubeconfig_files(&[bad, good]).unwrap();
        assert_eq!(result.contexts.len(), 1);
        assert_eq!(result.contexts[0].name, "ctx-a");
    }

    #[test]
    fn test_merge_skips_nonexistent_files() {
        let dir = tempfile::tempdir().unwrap();
        let missing = dir.path().join("nonexistent.yaml");
        let good = write_kubeconfig(dir.path(), "good.yaml", KUBECONFIG_B);

        let result = merge_kubeconfig_files(&[missing, good]).unwrap();
        assert_eq!(result.contexts.len(), 1);
        assert_eq!(result.contexts[0].name, "ctx-b");
    }

    #[test]
    fn test_merge_no_valid_files_returns_error() {
        let dir = tempfile::tempdir().unwrap();
        let bad = write_kubeconfig(dir.path(), "bad.yaml", "garbage content");

        let result = merge_kubeconfig_files(&[bad]);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("No valid kubeconfig files could be parsed"));
    }

    #[test]
    fn test_merge_empty_file_list_returns_error() {
        let result = merge_kubeconfig_files(&[]);
        assert!(result.is_err());
    }

    #[test]
    fn test_merge_context_can_be_found_by_name() {
        let dir = tempfile::tempdir().unwrap();
        let f1 = write_kubeconfig(dir.path(), "a.yaml", KUBECONFIG_A);
        let f2 = write_kubeconfig(dir.path(), "b.yaml", KUBECONFIG_B);

        let merged = merge_kubeconfig_files(&[f1, f2]).unwrap();

        // Simulate what init_with_context does: find context by name
        let found_a = merged.contexts.iter().find(|c| c.name == "ctx-a");
        let found_b = merged.contexts.iter().find(|c| c.name == "ctx-b");
        assert!(found_a.is_some(), "ctx-a must be findable in merged config");
        assert!(found_b.is_some(), "ctx-b must be findable in merged config");

        // Verify auth_infos are also accessible (needed for client creation)
        let user_a = merged.auth_infos.iter().find(|u| u.name == "user-a");
        let user_b = merged.auth_infos.iter().find(|u| u.name == "user-b");
        assert!(user_a.is_some(), "user-a must be findable");
        assert!(user_b.is_some(), "user-b must be findable");
    }

    #[test]
    fn test_merge_duplicate_context_first_wins() {
        let dir = tempfile::tempdir().unwrap();
        let f1 = write_kubeconfig(dir.path(), "first.yaml", KUBECONFIG_A);
        // Second file reuses context name "ctx-a" but with a different cluster
        let duplicate = r#"
apiVersion: v1
kind: Config
current-context: ctx-a
clusters:
- name: other-cluster
  cluster:
    server: https://other:6443
contexts:
- name: ctx-a
  context:
    cluster: other-cluster
    user: other-user
users:
- name: other-user
  user:
    token: other-token
"#;
        let f2 = write_kubeconfig(dir.path(), "second.yaml", duplicate);

        let merged = merge_kubeconfig_files(&[f1, f2]).unwrap();
        // Only one context with name "ctx-a" (first file wins)
        let matching: Vec<_> = merged
            .contexts
            .iter()
            .filter(|c| c.name == "ctx-a")
            .collect();
        assert_eq!(matching.len(), 1);
        // The cluster reference should be from the first file
        assert_eq!(
            matching[0].context.as_ref().unwrap().cluster,
            "cluster-a",
            "first file's cluster reference must win"
        );
    }

    #[test]
    fn test_merge_resolves_relative_cert_paths() {
        let dir = tempfile::tempdir().unwrap();

        // Write a CA file next to the kubeconfig
        let ca_path = dir.path().join("ca.crt");
        std::fs::write(&ca_path, "fake-ca-data").unwrap();

        // Kubeconfig with relative certificate-authority path
        let config_with_relative = r#"
apiVersion: v1
kind: Config
clusters:
- name: rel-cluster
  cluster:
    server: https://rel:6443
    certificate-authority: ca.crt
contexts:
- name: rel-ctx
  context:
    cluster: rel-cluster
    user: rel-user
users:
- name: rel-user
  user:
    token: rel-token
"#;
        let f = write_kubeconfig(dir.path(), "rel.yaml", config_with_relative);

        let merged = merge_kubeconfig_files(&[f]).unwrap();
        let cluster = merged
            .clusters
            .iter()
            .find(|c| c.name == "rel-cluster")
            .unwrap();
        let ca = cluster
            .cluster
            .as_ref()
            .unwrap()
            .certificate_authority
            .as_ref()
            .unwrap();

        // The relative path "ca.crt" must be resolved to an absolute path
        assert!(
            std::path::Path::new(ca).is_absolute(),
            "certificate-authority must be resolved to absolute path, got: {}",
            ca
        );
        assert!(
            ca.ends_with("ca.crt"),
            "resolved path must still point to ca.crt, got: {}",
            ca
        );
    }
}
