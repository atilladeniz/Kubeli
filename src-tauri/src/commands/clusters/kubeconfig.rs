use crate::k8s::{KubeConfig, KubeconfigSourceType};
use kube::config::Kubeconfig;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use crate::commands::cluster_settings::ClusterSettings;

/// Load kubeconfig using configured sources (or default)
pub(super) async fn load_kubeconfig_from_sources(app: &AppHandle) -> Option<KubeConfig> {
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

/// Build a merged kube-rs Kubeconfig from all configured sources for client connection
pub(super) async fn build_kubeconfig_for_connect(app: &AppHandle) -> Result<Kubeconfig, String> {
    let sources_config = crate::commands::kubeconfig::load_sources_config(app);

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
pub(super) fn merge_kubeconfig_files(files: &[std::path::PathBuf]) -> Result<Kubeconfig, String> {
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

/// Check if a kubeconfig file is self-contained for a given context.
/// Returns true if the file contains the context AND its referenced cluster and user.
/// Returns false for cross-file references (merge_mode), where cluster or user
/// are defined in a different file.
pub(super) fn is_self_contained(kubeconfig: &Kubeconfig, context_name: &str) -> bool {
    kubeconfig
        .contexts
        .iter()
        .find(|c| c.name == context_name)
        .and_then(|c| c.context.as_ref())
        .is_some_and(|ctx| {
            let has_cluster =
                ctx.cluster.is_empty() || kubeconfig.clusters.iter().any(|c| c.name == ctx.cluster);
            let has_user = ctx
                .user
                .as_deref()
                .is_none_or(|u| kubeconfig.auth_infos.iter().any(|a| a.name == u));
            has_cluster && has_user
        })
}

/// Load configured namespaces from the cluster settings store
pub(super) fn load_configured_namespaces(app: &AppHandle, context: &str) -> Vec<String> {
    let store = match app.store("cluster-settings.json") {
        Ok(s) => s,
        Err(_) => return vec![],
    };

    match store.get(context) {
        Some(value) => serde_json::from_value::<ClusterSettings>(value.clone())
            .map(|s| s.accessible_namespaces)
            .unwrap_or_default(),
        None => vec![],
    }
}

#[cfg(test)]
#[path = "kubeconfig_tests.rs"]
mod tests;
