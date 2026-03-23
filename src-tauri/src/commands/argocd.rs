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

    // Extract source info
    let source = spec.get("source");
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
        .filter_map(|entry| {
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

            let source = entry.get("source");
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

            let source_raw = source
                .map(|s| serde_json::to_string_pretty(s).unwrap_or_default())
                .unwrap_or_default();

            Some(ArgoCDHistoryEntry {
                id,
                revision,
                deployed_at,
                source_repo,
                source_path,
                source_target_revision,
                source_raw,
            })
        })
        .collect();

    Ok(entries)
}

/// Rollback an ArgoCD Application to a specific revision
#[command]
pub async fn rollback_argocd_application(
    state: State<'_, AppState>,
    name: String,
    namespace: String,
    revision: String,
) -> Result<(), String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let ar = argocd_api_resource();
    let api: Api<DynamicObject> = Api::namespaced_with(client, &namespace, &ar);

    let patch = json!({
        "operation": {
            "initiatedBy": {
                "username": "kubeli"
            },
            "sync": {
                "revision": revision
            }
        }
    });

    api.patch(&name, &PatchParams::apply("kubeli"), &Patch::Merge(&patch))
        .await
        .map_err(|e| format!("Failed to rollback application: {}", e))?;

    Ok(())
}
