use crate::k8s::AppState;
use kube::{
    api::{DynamicObject, ListParams},
    discovery::ApiResource,
    Api,
};
use serde::{Deserialize, Serialize};
use tauri::{command, State};

/// Flux Kustomization status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum FluxKustomizationStatus {
    Ready,
    NotReady,
    Reconciling,
    Failed,
    Unknown,
}

/// Flux Kustomization info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FluxKustomizationInfo {
    pub name: String,
    pub namespace: String,
    pub path: String,
    pub source_ref: String,
    pub interval: String,
    pub status: FluxKustomizationStatus,
    pub message: Option<String>,
    pub last_applied_revision: Option<String>,
    pub created_at: Option<String>,
}

/// List all Flux Kustomizations
#[command]
pub async fn list_flux_kustomizations(
    state: State<'_, AppState>,
    namespace: Option<String>,
) -> Result<Vec<FluxKustomizationInfo>, String> {
    let client = match state.k8s.get_client().await {
        Ok(c) => c,
        Err(_) => return Ok(Vec::new()),
    };

    // Define the Flux Kustomization API resource
    let ar = ApiResource {
        group: "kustomize.toolkit.fluxcd.io".to_string(),
        version: "v1".to_string(),
        api_version: "kustomize.toolkit.fluxcd.io/v1".to_string(),
        kind: "Kustomization".to_string(),
        plural: "kustomizations".to_string(),
    };

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
        .filter_map(|obj| parse_flux_kustomization(obj))
        .collect())
}

/// Parse a Flux Kustomization DynamicObject into FluxKustomizationInfo
fn parse_flux_kustomization(obj: DynamicObject) -> Option<FluxKustomizationInfo> {
    let name = obj.metadata.name.clone()?;
    let namespace = obj.metadata.namespace.clone().unwrap_or_default();
    let created_at = obj
        .metadata
        .creation_timestamp
        .as_ref()
        .map(|t| t.0.to_string());

    // Extract spec info
    let spec = obj.data.get("spec")?;
    let path = spec
        .get("path")
        .and_then(|v| v.as_str())
        .unwrap_or(".")
        .to_string();
    let interval = spec
        .get("interval")
        .and_then(|v| v.as_str())
        .unwrap_or("10m")
        .to_string();

    // Extract sourceRef
    let source_ref = spec
        .get("sourceRef")
        .map(|sr| {
            let kind = sr
                .get("kind")
                .and_then(|v| v.as_str())
                .unwrap_or("GitRepository");
            let name = sr.get("name").and_then(|v| v.as_str()).unwrap_or("unknown");
            let ns = sr.get("namespace").and_then(|v| v.as_str());
            if let Some(ns) = ns {
                format!("{}/{}/{}", kind, ns, name)
            } else {
                format!("{}/{}", kind, name)
            }
        })
        .unwrap_or_else(|| "unknown".to_string());

    // Extract status
    let status = obj.data.get("status");
    let (ks_status, message, last_applied) = if let Some(status) = status {
        // Get conditions to determine status
        let conditions = status.get("conditions").and_then(|c| c.as_array());
        let ready_condition = conditions.and_then(|conds| {
            conds.iter().find(|c| {
                c.get("type")
                    .and_then(|t| t.as_str())
                    .map(|t| t == "Ready")
                    .unwrap_or(false)
            })
        });

        let is_ready = ready_condition
            .and_then(|c| c.get("status"))
            .and_then(|s| s.as_str())
            .map(|s| s == "True")
            .unwrap_or(false);

        let reason = ready_condition
            .and_then(|c| c.get("reason"))
            .and_then(|r| r.as_str())
            .unwrap_or("");

        let message = ready_condition
            .and_then(|c| c.get("message"))
            .and_then(|m| m.as_str())
            .map(|s| s.to_string());

        let last_applied = status
            .get("lastAppliedRevision")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let ks_status = if is_ready {
            FluxKustomizationStatus::Ready
        } else if reason.contains("Failed")
            || message
                .as_ref()
                .map(|m| m.to_lowercase().contains("failed"))
                .unwrap_or(false)
        {
            FluxKustomizationStatus::Failed
        } else if reason.contains("Progressing") {
            FluxKustomizationStatus::Reconciling
        } else if !is_ready {
            FluxKustomizationStatus::NotReady
        } else {
            FluxKustomizationStatus::Unknown
        };

        (ks_status, message, last_applied)
    } else {
        (FluxKustomizationStatus::Unknown, None, None)
    };

    Some(FluxKustomizationInfo {
        name,
        namespace,
        path,
        source_ref,
        interval,
        status: ks_status,
        message,
        last_applied_revision: last_applied,
        created_at,
    })
}
