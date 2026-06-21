use serde::{Deserialize, Serialize};
use tauri::{command, AppHandle};
use tauri_plugin_store::StoreExt;

/// Per-cluster settings persisted to cluster-settings.json
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ClusterSettings {
    pub accessible_namespaces: Vec<String>,
    /// Skip Kubeli's native OIDC flow and let kube-rs run the kubeconfig's
    /// auth as-is (e.g. an `exec` provider like `kubectl oidc-login`,
    /// kubelogin, or Pinniped). Lets enterprise exec-based auth work even when
    /// the native browser flow can't complete (see issue #335).
    #[serde(default)]
    pub prefer_kubeconfig_auth: bool,
}

impl ClusterSettings {
    /// Whether the settings carry any non-default value worth persisting.
    fn is_meaningful(&self) -> bool {
        !self.accessible_namespaces.is_empty() || self.prefer_kubeconfig_auth
    }
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
            if settings.is_meaningful() {
                Ok(Some(settings))
            } else {
                Ok(None)
            }
        }
        None => Ok(None),
    }
}

/// Read the current settings for a context, falling back to defaults so other
/// fields are preserved across partial updates.
fn current_settings(
    store: &tauri_plugin_store::Store<tauri::Wry>,
    context: &str,
) -> ClusterSettings {
    store
        .get(context)
        .and_then(|value| serde_json::from_value(value.clone()).ok())
        .unwrap_or_default()
}

fn persist_settings(
    store: &tauri_plugin_store::Store<tauri::Wry>,
    context: &str,
    settings: &ClusterSettings,
) -> Result<(), String> {
    if settings.is_meaningful() {
        store.set(
            context,
            serde_json::to_value(settings)
                .map_err(|e| format!("Failed to serialize cluster settings: {}", e))?,
        );
    } else {
        // Nothing worth keeping — drop the entry so it reverts to auto-discovery.
        store.delete(context);
    }
    store
        .save()
        .map_err(|e| format!("Failed to save cluster settings: {}", e))
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

    let mut settings = current_settings(&store, &context);
    settings.accessible_namespaces = namespaces;
    persist_settings(&store, &context, &settings)?;

    tracing::info!(
        "Saved accessible namespaces for context '{}': {:?}",
        context,
        settings.accessible_namespaces
    );

    Ok(())
}

/// Toggle "use kubeconfig authentication only" for a specific context.
#[command]
pub async fn set_cluster_prefer_kubeconfig_auth(
    app: AppHandle,
    context: String,
    prefer: bool,
) -> Result<(), String> {
    let store = app
        .store("cluster-settings.json")
        .map_err(|e| format!("Failed to open cluster settings store: {}", e))?;

    let mut settings = current_settings(&store, &context);
    settings.prefer_kubeconfig_auth = prefer;
    persist_settings(&store, &context, &settings)?;

    tracing::info!(
        "Set prefer_kubeconfig_auth={} for context '{}'",
        prefer,
        context
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_settings_default_prefer_flag_to_false() {
        // Settings written before the flag existed must still deserialize.
        let settings: ClusterSettings =
            serde_json::from_str(r#"{"accessible_namespaces":["team-a"]}"#).unwrap();
        assert!(!settings.prefer_kubeconfig_auth);
        assert_eq!(settings.accessible_namespaces, vec!["team-a"]);
    }

    #[test]
    fn prefer_flag_alone_is_meaningful() {
        // A context with only the auth flag set must be persisted/returned,
        // even though it has no configured namespaces (issue #335).
        let settings = ClusterSettings {
            accessible_namespaces: vec![],
            prefer_kubeconfig_auth: true,
        };
        assert!(settings.is_meaningful());

        assert!(!ClusterSettings::default().is_meaningful());
    }

    #[test]
    fn prefer_flag_round_trips_through_json() {
        let settings = ClusterSettings {
            accessible_namespaces: vec!["ns".into()],
            prefer_kubeconfig_auth: true,
        };
        let json = serde_json::to_string(&settings).unwrap();
        let parsed: ClusterSettings = serde_json::from_str(&json).unwrap();
        assert!(parsed.prefer_kubeconfig_auth);
        assert_eq!(parsed.accessible_namespaces, vec!["ns"]);
    }
}
