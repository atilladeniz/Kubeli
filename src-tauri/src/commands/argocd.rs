use crate::k8s::AppState;
use kube::{
    api::{DynamicObject, ListParams, Patch, PatchParams},
    discovery::ApiResource,
    Api,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{command, State};

/// ArgoCD Application sync status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ArgoCDSyncStatus {
    Synced,
    OutOfSync,
    Unknown,
}

/// ArgoCD Application health status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ArgoCDHealthStatus {
    Healthy,
    Progressing,
    Degraded,
    Suspended,
    Missing,
    Unknown,
}

/// ArgoCD Application history entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArgoCDHistoryEntry {
    pub id: i64,
    pub revision: String,
    pub deployed_at: Option<String>,
    pub source_repo: String,
    pub source_path: String,
    pub source_target_revision: String,
    pub source_raw: String,
}

/// Current state of an ArgoCD Application's in-flight operation (sync/rollback).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArgoCDOperationState {
    /// "Running", "Succeeded", "Failed", "Error", "Terminating", or null when idle.
    pub phase: Option<String>,
    pub message: Option<String>,
}

/// ArgoCD Application info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArgoCDApplicationInfo {
    pub name: String,
    pub namespace: String,
    pub project: String,
    pub repo_url: String,
    pub path: String,
    pub target_revision: String,
    pub dest_server: String,
    pub dest_namespace: String,
    pub sync_status: ArgoCDSyncStatus,
    pub health_status: ArgoCDHealthStatus,
    pub sync_policy: String,
    pub message: Option<String>,
    pub current_revision: Option<String>,
    pub created_at: Option<String>,
}

fn argocd_api_resource() -> ApiResource {
    ApiResource {
        group: "argoproj.io".to_string(),
        version: "v1alpha1".to_string(),
        api_version: "argoproj.io/v1alpha1".to_string(),
        kind: "Application".to_string(),
        plural: "applications".to_string(),
    }
}

/// List all ArgoCD Applications
#[command]
pub async fn list_argocd_applications(
    state: State<'_, AppState>,
    namespace: Option<String>,
) -> Result<Vec<ArgoCDApplicationInfo>, String> {
    let client = match state.k8s.get_client().await {
        Ok(c) => c,
        Err(_) => return Ok(Vec::new()),
    };

    let ar = argocd_api_resource();
    let lp = ListParams::default();

    let result: Result<Vec<DynamicObject>, _> = if let Some(ref ns) = namespace {
        let api: Api<DynamicObject> = Api::namespaced_with(client.clone(), ns, &ar);
        api.list(&lp).await.map(|list| list.items)
    } else {
        let api: Api<DynamicObject> = Api::all_with(client.clone(), &ar);
        api.list(&lp).await.map(|list| list.items)
    };

    let items = result.unwrap_or_default();

    Ok(items
        .into_iter()
        .filter_map(parse_argocd_application)
        .collect())
}

/// Parse an ArgoCD Application DynamicObject into ArgoCDApplicationInfo
fn parse_argocd_application(obj: DynamicObject) -> Option<ArgoCDApplicationInfo> {
    let name = obj.metadata.name.clone()?;
    let namespace = obj.metadata.namespace.clone().unwrap_or_default();
    let created_at = obj
        .metadata
        .creation_timestamp
        .as_ref()
        .map(|t| t.0.to_string());

    let spec = obj.data.get("spec")?;

    // Extract project
    let project = spec
        .get("project")
        .and_then(|v| v.as_str())
        .unwrap_or("default")
        .to_string();

    // Extract source info (fall back to the first of spec.sources for
    // multi-source Applications, which omit the singular spec.source).
    let source = spec.get("source").or_else(|| {
        spec.get("sources")
            .and_then(|s| s.as_array())
            .and_then(|a| a.first())
    });
    let repo_url = source
        .and_then(|s| s.get("repoURL"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let path = source
        .and_then(|s| s.get("path"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let target_revision = source
        .and_then(|s| s.get("targetRevision"))
        .and_then(|v| v.as_str())
        .unwrap_or("HEAD")
        .to_string();

    // Extract destination info
    let destination = spec.get("destination");
    let dest_server = destination
        .and_then(|d| d.get("server"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let dest_namespace = destination
        .and_then(|d| d.get("namespace"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    // Extract sync policy
    let sync_policy_obj = spec.get("syncPolicy");
    let sync_policy = if sync_policy_obj.and_then(|sp| sp.get("automated")).is_some() {
        "auto".to_string()
    } else {
        "manual".to_string()
    };

    // Extract status
    let status = obj.data.get("status");

    let sync_status = status
        .and_then(|s| s.get("sync"))
        .and_then(|s| s.get("status"))
        .and_then(|v| v.as_str())
        .map(|s| match s {
            "Synced" => ArgoCDSyncStatus::Synced,
            "OutOfSync" => ArgoCDSyncStatus::OutOfSync,
            _ => ArgoCDSyncStatus::Unknown,
        })
        .unwrap_or(ArgoCDSyncStatus::Unknown);

    let health_status = status
        .and_then(|s| s.get("health"))
        .and_then(|s| s.get("status"))
        .and_then(|v| v.as_str())
        .map(|s| match s {
            "Healthy" => ArgoCDHealthStatus::Healthy,
            "Progressing" => ArgoCDHealthStatus::Progressing,
            "Degraded" => ArgoCDHealthStatus::Degraded,
            "Suspended" => ArgoCDHealthStatus::Suspended,
            "Missing" => ArgoCDHealthStatus::Missing,
            _ => ArgoCDHealthStatus::Unknown,
        })
        .unwrap_or(ArgoCDHealthStatus::Unknown);

    let message = status
        .and_then(|s| s.get("health"))
        .and_then(|s| s.get("message"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let current_revision = status
        .and_then(|s| s.get("sync"))
        .and_then(|s| s.get("revision"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    Some(ArgoCDApplicationInfo {
        name,
        namespace,
        project,
        repo_url,
        path,
        target_revision,
        dest_server,
        dest_namespace,
        sync_status,
        health_status,
        sync_policy,
        message,
        current_revision,
        created_at,
    })
}

/// Trigger a normal refresh for an ArgoCD Application
#[command]
pub async fn refresh_argocd_application(
    state: State<'_, AppState>,
    name: String,
    namespace: String,
) -> Result<(), String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let ar = argocd_api_resource();
    let api: Api<DynamicObject> = Api::namespaced_with(client, &namespace, &ar);

    let patch = json!({
        "metadata": {
            "annotations": {
                "argocd.argoproj.io/refresh": "normal"
            }
        }
    });

    api.patch(&name, &PatchParams::apply("kubeli"), &Patch::Merge(&patch))
        .await
        .map_err(|e| format!("Failed to trigger refresh: {}", e))?;

    Ok(())
}

/// Trigger a hard refresh for an ArgoCD Application
#[command]
pub async fn hard_refresh_argocd_application(
    state: State<'_, AppState>,
    name: String,
    namespace: String,
) -> Result<(), String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let ar = argocd_api_resource();
    let api: Api<DynamicObject> = Api::namespaced_with(client, &namespace, &ar);

    let patch = json!({
        "metadata": {
            "annotations": {
                "argocd.argoproj.io/refresh": "hard"
            }
        }
    });

    api.patch(&name, &PatchParams::apply("kubeli"), &Patch::Merge(&patch))
        .await
        .map_err(|e| format!("Failed to trigger hard refresh: {}", e))?;

    Ok(())
}

/// Returns an error if the Application already has an operation in progress.
///
/// ArgoCD's API server rejects setting `.operation` while one is running; a raw
/// merge patch would instead overwrite or be ignored, so a successful patch
/// would not mean a successful sync. We guard explicitly.
/// Read `status.operationState.phase` (e.g. "Running", "Succeeded", "Failed").
fn operation_phase(app: &DynamicObject) -> Option<String> {
    app.data
        .get("status")
        .and_then(|s| s.get("operationState"))
        .and_then(|o| o.get("phase"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

/// Whether an operation phase counts as still in progress. ArgoCD keeps the
/// `.operation` field set while the phase is `Running` *or* `Terminating` (a
/// running operation being cancelled), and rejects a new operation in both
/// cases — so we must treat both as in-progress, not just `Running`.
fn is_in_progress_phase(phase: Option<&str>) -> bool {
    matches!(phase, Some("Running") | Some("Terminating"))
}

fn ensure_no_running_operation(app: &DynamicObject, name: &str) -> Result<(), String> {
    if is_in_progress_phase(operation_phase(app).as_deref()) {
        return Err(format!(
            "Application '{}' already has an operation in progress",
            name
        ));
    }
    Ok(())
}

/// Serialize a history record's source(s) for the diff/rollback preview.
///
/// Single-source apps use `source`; multi-source apps use the whole `sources`
/// array so the preview reflects every source. `build_rollback_operation`
/// restores all sources, so previewing only `sources[0]` would understate the
/// change the rollback actually makes.
fn history_source_raw(entry: &serde_json::Value) -> String {
    if let Some(source) = entry.get("source") {
        serde_json::to_string_pretty(source).unwrap_or_default()
    } else if let Some(sources) = entry.get("sources") {
        serde_json::to_string_pretty(sources).unwrap_or_default()
    } else {
        String::new()
    }
}

/// Find the `status.history[]` record with the given ArgoCD history id.
fn select_history_entry(history: &[serde_json::Value], id: i64) -> Option<&serde_json::Value> {
    history
        .iter()
        .find(|e| e.get("id").and_then(|v| v.as_i64()) == Some(id))
}

/// Build the rollback `operation` payload for a history `entry`.
///
/// Restores the recorded source(s)/revision so the rollback reproduces that
/// deployment's source rather than syncing only the git revision against the
/// current spec. Carries over the Application's current
/// `spec.syncPolicy.syncOptions` (history records source/revision only, not sync
/// options). `prune` is left at ArgoCD's CLI default (false).
fn build_rollback_operation(
    spec: Option<&serde_json::Value>,
    entry: &serde_json::Value,
) -> serde_json::Value {
    let mut sync = json!({
        "revision": entry.get("revision").and_then(|v| v.as_str()).unwrap_or_default(),
    });
    if let Some(source) = entry.get("source") {
        sync["source"] = source.clone();
    } else if let Some(sources) = entry.get("sources") {
        sync["sources"] = sources.clone();
        if let Some(revisions) = entry.get("revisions") {
            sync["revisions"] = revisions.clone();
        }
    }
    if let Some(sync_options) = spec
        .and_then(|s| s.get("syncPolicy"))
        .and_then(|sp| sp.get("syncOptions"))
    {
        sync["syncOptions"] = sync_options.clone();
    }
    json!({
        "operation": {
            "initiatedBy": { "username": "kubeli" },
            "sync": sync
        }
    })
}

/// Trigger a sync for an ArgoCD Application
#[command]
pub async fn sync_argocd_application(
    state: State<'_, AppState>,
    name: String,
    namespace: String,
) -> Result<(), String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let ar = argocd_api_resource();
    let api: Api<DynamicObject> = Api::namespaced_with(client, &namespace, &ar);

    let app = api
        .get(&name)
        .await
        .map_err(|e| format!("Failed to get application: {}", e))?;
    ensure_no_running_operation(&app, &name)?;

    let patch = json!({
        "operation": {
            "initiatedBy": {
                "username": "kubeli"
            },
            "sync": {
                "revision": ""
            }
        }
    });

    api.patch(&name, &PatchParams::apply("kubeli"), &Patch::Merge(&patch))
        .await
        .map_err(|e| format!("Failed to trigger sync: {}", e))?;

    Ok(())
}

/// Get deploy history for an ArgoCD Application
#[command]
pub async fn get_argocd_application_history(
    state: State<'_, AppState>,
    name: String,
    namespace: String,
) -> Result<Vec<ArgoCDHistoryEntry>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let ar = argocd_api_resource();
    let api: Api<DynamicObject> = Api::namespaced_with(client, &namespace, &ar);

    let app = api
        .get(&name)
        .await
        .map_err(|e| format!("Failed to get application: {}", e))?;

    let history = app
        .data
        .get("status")
        .and_then(|s| s.get("history"))
        .and_then(|h| h.as_array())
        .cloned()
        .unwrap_or_default();

    let entries: Vec<ArgoCDHistoryEntry> = history
        .into_iter()
        .map(|entry| {
            let id = entry.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
            let revision = entry
                .get("revision")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let deployed_at = entry
                .get("deployedAt")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            let source = entry.get("source").or_else(|| {
                entry
                    .get("sources")
                    .and_then(|s| s.as_array())
                    .and_then(|a| a.first())
            });
            let source_repo = source
                .and_then(|s| s.get("repoURL"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let source_path = source
                .and_then(|s| s.get("path"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let source_target_revision = source
                .and_then(|s| s.get("targetRevision"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let source_raw = history_source_raw(&entry);

            ArgoCDHistoryEntry {
                id,
                revision,
                deployed_at,
                source_repo,
                source_path,
                source_target_revision,
                source_raw,
            }
        })
        .collect();

    Ok(entries)
}

/// Rollback an ArgoCD Application to a specific deployment history record.
///
/// `id` is the ArgoCD `status.history[].id` of the target deployment (not the
/// git revision), matching `argocd app rollback`. We look the record up so we
/// can restore the recorded source(s) — repo/path/chart/targetRevision — rather
/// than syncing only the git revision against the current spec.source (which is
/// wrong for Helm, path-changed, or multi-source Applications). Sync options are
/// taken from the current spec, since history does not record them.
#[command]
pub async fn rollback_argocd_application(
    state: State<'_, AppState>,
    name: String,
    namespace: String,
    id: i64,
) -> Result<(), String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let ar = argocd_api_resource();
    let api: Api<DynamicObject> = Api::namespaced_with(client, &namespace, &ar);

    let app = api
        .get(&name)
        .await
        .map_err(|e| format!("Failed to get application: {}", e))?;

    ensure_no_running_operation(&app, &name)?;

    let history = app
        .data
        .get("status")
        .and_then(|s| s.get("history"))
        .and_then(|h| h.as_array());
    let entry = history
        .and_then(|entries| select_history_entry(entries, id))
        .ok_or_else(|| format!("History record {} not found for application {}", id, name))?;

    let patch = build_rollback_operation(app.data.get("spec"), entry);

    api.patch(&name, &PatchParams::apply("kubeli"), &Patch::Merge(&patch))
        .await
        .map_err(|e| format!("Failed to rollback application: {}", e))?;

    Ok(())
}

/// Read the current operation state of an ArgoCD Application, so the UI can
/// disable rollback while a sync is running and poll progress afterwards.
#[command]
pub async fn get_argocd_operation_state(
    state: State<'_, AppState>,
    name: String,
    namespace: String,
) -> Result<ArgoCDOperationState, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let ar = argocd_api_resource();
    let api: Api<DynamicObject> = Api::namespaced_with(client, &namespace, &ar);

    let app = api
        .get(&name)
        .await
        .map_err(|e| format!("Failed to get application: {}", e))?;

    let message = app
        .data
        .get("status")
        .and_then(|s| s.get("operationState"))
        .and_then(|o| o.get("message"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    Ok(ArgoCDOperationState {
        phase: operation_phase(&app),
        message,
    })
}

#[cfg(test)]
mod tests {
    use super::{
        build_rollback_operation, history_source_raw, is_in_progress_phase, select_history_entry,
    };
    use serde_json::json;

    #[test]
    fn in_progress_phase_covers_running_and_terminating() {
        assert!(is_in_progress_phase(Some("Running")));
        assert!(is_in_progress_phase(Some("Terminating")));
        assert!(!is_in_progress_phase(Some("Succeeded")));
        assert!(!is_in_progress_phase(Some("Failed")));
        assert!(!is_in_progress_phase(Some("Error")));
        assert!(!is_in_progress_phase(None));
    }

    #[test]
    fn source_raw_single_source_serializes_the_source() {
        let entry = json!({
            "id": 1,
            "source": { "repoURL": "https://example.com/repo", "path": "app" }
        });
        let raw = history_source_raw(&entry);
        assert!(raw.contains("https://example.com/repo"));
        // Single-source must not be wrapped in an array.
        assert!(raw.trim_start().starts_with('{'));
    }

    #[test]
    fn source_raw_multi_source_includes_every_source() {
        let entry = json!({
            "id": 2,
            "sources": [
                { "repoURL": "https://example.com/first" },
                { "repoURL": "https://example.com/second" }
            ]
        });
        let raw = history_source_raw(&entry);
        // Both sources must appear so the preview matches what rollback restores.
        assert!(raw.contains("https://example.com/first"));
        assert!(raw.contains("https://example.com/second"));
        assert!(raw.trim_start().starts_with('['));
    }

    #[test]
    fn source_raw_missing_source_is_empty() {
        assert_eq!(history_source_raw(&json!({ "id": 3 })), "");
    }

    #[test]
    fn rollback_single_source_restores_source_and_revision() {
        let entry = json!({
            "id": 3,
            "revision": "abc123",
            "source": { "repoURL": "https://example.com/repo", "path": "app", "targetRevision": "v1.0.0" }
        });
        let op = build_rollback_operation(None, &entry);
        let sync = &op["operation"]["sync"];
        assert_eq!(sync["revision"], "abc123");
        assert_eq!(sync["source"]["path"], "app");
        assert!(sync.get("sources").is_none());
        assert!(sync.get("syncOptions").is_none());
    }

    #[test]
    fn rollback_multi_source_restores_sources_and_revisions() {
        let entry = json!({
            "id": 5,
            "revision": "",
            "sources": [ { "repoURL": "r1" }, { "repoURL": "r2" } ],
            "revisions": ["v1", "v2"]
        });
        let op = build_rollback_operation(None, &entry);
        let sync = &op["operation"]["sync"];
        assert_eq!(sync["sources"].as_array().unwrap().len(), 2);
        assert_eq!(sync["revisions"][1], "v2");
        assert!(sync.get("source").is_none());
    }

    #[test]
    fn rollback_multi_source_without_revisions_omits_them() {
        let entry = json!({
            "id": 1,
            "sources": [ { "repoURL": "r1" } ]
        });
        let op = build_rollback_operation(None, &entry);
        let sync = &op["operation"]["sync"];
        assert!(sync.get("sources").is_some());
        assert!(sync.get("revisions").is_none());
    }

    #[test]
    fn rollback_carries_current_sync_options() {
        let spec = json!({
            "syncPolicy": { "syncOptions": ["CreateNamespace=true", "ApplyOutOfSyncOnly=true"] }
        });
        let entry = json!({ "id": 2, "revision": "r", "source": {} });
        let op = build_rollback_operation(Some(&spec), &entry);
        assert_eq!(
            op["operation"]["sync"]["syncOptions"],
            json!(["CreateNamespace=true", "ApplyOutOfSyncOnly=true"])
        );
    }

    #[test]
    fn rollback_initiated_by_kubeli() {
        let entry = json!({ "id": 1, "revision": "r", "source": {} });
        let op = build_rollback_operation(None, &entry);
        assert_eq!(op["operation"]["initiatedBy"]["username"], "kubeli");
    }

    #[test]
    fn select_history_entry_finds_by_id_including_zero() {
        let history = vec![
            json!({ "id": 0, "revision": "first" }),
            json!({ "id": 1, "revision": "second" }),
        ];
        assert_eq!(
            select_history_entry(&history, 0).unwrap()["revision"],
            "first"
        );
        assert_eq!(
            select_history_entry(&history, 1).unwrap()["revision"],
            "second"
        );
        assert!(select_history_entry(&history, 99).is_none());
    }
}
