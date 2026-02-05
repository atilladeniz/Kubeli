#![allow(unused_variables)]

use crate::k8s::{
    KubeConfig, KubeconfigSource, KubeconfigSourceInfo, KubeconfigSourceType,
    KubeconfigSourcesConfig,
};
use tauri::{command, AppHandle};
use tauri_plugin_store::StoreExt;

const STORE_FILENAME: &str = "kubeconfig-sources.json";
const STORE_KEY: &str = "sources_config";

/// Load sources config from Tauri store
pub(crate) fn load_sources_config(app: &AppHandle) -> KubeconfigSourcesConfig {
    let store = match app.store(STORE_FILENAME) {
        Ok(s) => s,
        Err(_) => return KubeConfig::default_sources_config(),
    };

    match store.get(STORE_KEY) {
        Some(value) => serde_json::from_value::<KubeconfigSourcesConfig>(value.clone())
            .unwrap_or_else(|_| KubeConfig::default_sources_config()),
        None => KubeConfig::default_sources_config(),
    }
}

/// Save sources config to Tauri store
fn save_sources_config(app: &AppHandle, config: &KubeconfigSourcesConfig) -> Result<(), String> {
    let store = app
        .store(STORE_FILENAME)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    let value =
        serde_json::to_value(config).map_err(|e| format!("Failed to serialize config: {}", e))?;

    store.set(STORE_KEY, value);
    store
        .save()
        .map_err(|e| format!("Failed to save store: {}", e))?;

    Ok(())
}

/// Get the current kubeconfig sources configuration
#[command]
pub async fn get_kubeconfig_sources(app: AppHandle) -> Result<KubeconfigSourcesConfig, String> {
    Ok(load_sources_config(&app))
}

/// Set the kubeconfig sources configuration
#[command]
pub async fn set_kubeconfig_sources(
    app: AppHandle,
    config: KubeconfigSourcesConfig,
) -> Result<(), String> {
    save_sources_config(&app, &config)
}

/// Add a kubeconfig source (file or folder)
#[command]
pub async fn add_kubeconfig_source(
    app: AppHandle,
    path: String,
    source_type: KubeconfigSourceType,
) -> Result<KubeconfigSourcesConfig, String> {
    let mut config = load_sources_config(&app);

    // Check for duplicates
    if config.sources.iter().any(|s| s.path == path) {
        return Err(format!("Source already exists: {}", path));
    }

    // Auto-detect type if path is actually a directory
    let resolved_type = if std::path::Path::new(&path).is_dir() {
        KubeconfigSourceType::Folder
    } else {
        source_type
    };

    config.sources.push(KubeconfigSource {
        path,
        source_type: resolved_type,
    });
    save_sources_config(&app, &config)?;

    Ok(config)
}

/// Remove a kubeconfig source
#[command]
pub async fn remove_kubeconfig_source(
    app: AppHandle,
    path: String,
) -> Result<KubeconfigSourcesConfig, String> {
    if KubeConfig::is_default_source(&path) {
        return Err("Cannot remove the default kubeconfig source".to_string());
    }

    let mut config = load_sources_config(&app);
    config.sources.retain(|s| s.path != path);
    save_sources_config(&app, &config)?;

    Ok(config)
}

/// List kubeconfig sources with metadata (file count, context count, validity)
#[command]
pub async fn list_kubeconfig_sources(app: AppHandle) -> Result<Vec<KubeconfigSourceInfo>, String> {
    let config = load_sources_config(&app);
    let mut infos = Vec::new();

    for source in &config.sources {
        match KubeConfig::validate_path(&source.path).await {
            Ok(info) => infos.push(info),
            Err(e) => infos.push(KubeconfigSourceInfo {
                path: source.path.clone(),
                source_type: source.source_type.clone(),
                file_count: 0,
                context_count: 0,
                valid: false,
                error: Some(e.to_string()),
                is_default: KubeConfig::is_default_source(&source.path),
            }),
        }
    }

    Ok(infos)
}

/// Validate a kubeconfig path (file or folder)
#[command]
pub async fn validate_kubeconfig_path(path: String) -> Result<KubeconfigSourceInfo, String> {
    KubeConfig::validate_path(&path)
        .await
        .map_err(|e| e.to_string())
}

/// Set merge mode on/off
#[command]
pub async fn set_kubeconfig_merge_mode(
    app: AppHandle,
    enabled: bool,
) -> Result<KubeconfigSourcesConfig, String> {
    let mut config = load_sources_config(&app);
    config.merge_mode = enabled;
    save_sources_config(&app, &config)?;

    Ok(config)
}
