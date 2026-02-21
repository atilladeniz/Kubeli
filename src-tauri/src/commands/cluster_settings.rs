use serde::{Deserialize, Serialize};
use tauri::{command, AppHandle};
use tauri_plugin_store::StoreExt;

/// Per-cluster settings persisted to cluster-settings.json
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ClusterSettings {
    pub accessible_namespaces: Vec<String>,
}

/// Get cluster settings for a specific context
#[command]
pub async fn get_cluster_settings(
    app: AppHandle,
    context: String,
) -> Result<Option<ClusterSettings>, String> {
    let store = app
        .store("cluster-settings.json")
        .map_err(|e| format!("Failed to open cluster settings store: {}", e))?;

    match store.get(&context) {
        Some(value) => {
            let settings: ClusterSettings = serde_json::from_value(value.clone())
                .map_err(|e| format!("Failed to parse cluster settings: {}", e))?;
            if settings.accessible_namespaces.is_empty() {
                Ok(None)
            } else {
                Ok(Some(settings))
            }
        }
        None => Ok(None),
    }
}

/// Set accessible namespaces for a specific context
#[command]
pub async fn set_cluster_accessible_namespaces(
    app: AppHandle,
    context: String,
    namespaces: Vec<String>,
) -> Result<(), String> {
    let store = app
        .store("cluster-settings.json")
        .map_err(|e| format!("Failed to open cluster settings store: {}", e))?;

    let settings = ClusterSettings {
        accessible_namespaces: namespaces,
    };

    store.set(
        &context,
        serde_json::to_value(&settings)
            .map_err(|e| format!("Failed to serialize cluster settings: {}", e))?,
    );

    store
        .save()
        .map_err(|e| format!("Failed to save cluster settings: {}", e))?;

    tracing::info!(
        "Saved accessible namespaces for context '{}': {:?}",
        context,
        settings.accessible_namespaces
    );

    Ok(())
}

/// Clear cluster settings for a specific context (revert to auto-discovery)
#[command]
pub async fn clear_cluster_settings(app: AppHandle, context: String) -> Result<(), String> {
    let store = app
        .store("cluster-settings.json")
        .map_err(|e| format!("Failed to open cluster settings store: {}", e))?;

    store.delete(&context);

    store
        .save()
        .map_err(|e| format!("Failed to save cluster settings: {}", e))?;

    tracing::info!("Cleared cluster settings for context '{}'", context);

    Ok(())
}
