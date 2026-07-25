use crate::k8s::AppState;
use kube::{
    api::{DynamicObject, ListParams, Patch, PatchParams},
    discovery::ApiResource,
    Api,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{command, State};

/// Flux Kustomization status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum FluxKustomizationStatus {
    Ready,
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
    pub suspended: bool,
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

    let ar = kustomization_ar();
    let lp = ListParams::default();

    let result: Result<Vec<DynamicObject>, _> = if let Some(ref ns) = namespace {
        let api: Api<DynamicObject> = Api::namespaced_with(client.clone(), ns, &ar);
        api.list(&lp).await.map(|list| list.items)
    } else {
        let api: Api<DynamicObject> = Api::all_with(client.clone(), &ar);
        api.list(&lp).await.map(|list| list.items)
    };

    let items = match result {
        Ok(items) => items,
        // 404 means the Flux Kustomization CRD is not installed - show an
        // empty list. Everything else (401/403/network) is a real error.
        Err(kube::Error::Api(resp)) if resp.code == 404 => return Ok(Vec::new()),
        Err(e) => return Err(format!("Failed to list Flux Kustomizations: {}", e)),
    };

    Ok(items
        .into_iter()
        .filter_map(parse_flux_kustomization)
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
    let suspended = spec
        .get("suspend")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

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
        let ready = find_condition(status, "Ready");
        let stalled = find_condition(status, "Stalled");
        // The Stalled condition carries the actual root cause; Ready is the fallback
        let message = if condition_status(stalled) == "True" {
            condition_message(stalled).or_else(|| condition_message(ready))
        } else {
            condition_message(ready)
        };
        let last_applied = status
            .get("lastAppliedRevision")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Condition-based detection: Ready=True wins, Stalled means failing,
        // Reconciling=True or Ready=Unknown means in progress
        let ks_status = match condition_status(ready) {
            "True" => FluxKustomizationStatus::Ready,
            _ if condition_status(stalled) == "True" => FluxKustomizationStatus::Failed,
            _ if condition_status(find_condition(status, "Reconciling")) == "True" => {
                FluxKustomizationStatus::Reconciling
            }
            "Unknown" => FluxKustomizationStatus::Reconciling,
            "False" => FluxKustomizationStatus::Failed,
            _ => FluxKustomizationStatus::Unknown,
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
        suspended,
        message,
        last_applied_revision: last_applied,
        created_at,
    })
}

/// Annotation Flux watches for reconcile requests
const REQUESTED_AT: &str = "reconcile.fluxcd.io/requestedAt";
/// Annotation forcing a one-off Helm install/upgrade (must carry the requestedAt token)
const FORCE_AT: &str = "reconcile.fluxcd.io/forceAt";
/// Annotation resetting the Helm failure/retry counter (must carry the requestedAt token)
const RESET_AT: &str = "reconcile.fluxcd.io/resetAt";

fn kustomization_ar() -> ApiResource {
    ApiResource {
        group: "kustomize.toolkit.fluxcd.io".to_string(),
        version: "v1".to_string(),
        api_version: "kustomize.toolkit.fluxcd.io/v1".to_string(),
        kind: "Kustomization".to_string(),
        plural: "kustomizations".to_string(),
    }
}

fn helmrelease_ar() -> ApiResource {
    ApiResource {
        group: "helm.toolkit.fluxcd.io".to_string(),
        version: "v2".to_string(),
        api_version: "helm.toolkit.fluxcd.io/v2".to_string(),
        kind: "HelmRelease".to_string(),
        plural: "helmreleases".to_string(),
    }
}

/// ApiResource for a Flux source kind (GitRepository, HelmRepository, ...)
fn source_ar(kind: &str, version: &str) -> Result<ApiResource, String> {
    let plural = match kind {
        "GitRepository" => "gitrepositories",
        "OCIRepository" => "ocirepositories",
        "HelmRepository" => "helmrepositories",
        "HelmChart" => "helmcharts",
        "Bucket" => "buckets",
        other => return Err(format!("Unsupported Flux source kind: {}", other)),
    };
    Ok(ApiResource {
        group: "source.toolkit.fluxcd.io".to_string(),
        version: version.to_string(),
        api_version: format!("source.toolkit.fluxcd.io/{}", version),
        kind: kind.to_string(),
        plural: plural.to_string(),
    })
}

/// Merge-patch a value onto an object
async fn merge_patch(
    client: kube::Client,
    ar: &ApiResource,
    namespace: &str,
    name: &str,
    patch: serde_json::Value,
) -> Result<(), kube::Error> {
    let api: Api<DynamicObject> = Api::namespaced_with(client, namespace, ar);
    api.patch(name, &PatchParams::apply("kubeli"), &Patch::Merge(&patch))
        .await?;
    Ok(())
}

/// Set reconcile annotations (requestedAt + optional forceAt/resetAt) with one token
async fn request_reconcile(
    client: kube::Client,
    ar: &ApiResource,
    namespace: &str,
    name: &str,
    token: &str,
    extra_annotation: Option<&str>,
) -> Result<(), String> {
    let mut annotations = serde_json::Map::new();
    annotations.insert(REQUESTED_AT.to_string(), json!(token));
    if let Some(key) = extra_annotation {
        annotations.insert(key.to_string(), json!(token));
    }
    let patch = json!({ "metadata": { "annotations": annotations } });
    merge_patch(client, ar, namespace, name, patch)
        .await
        .map_err(|e| format!("Failed to trigger reconciliation: {}", e))
}

/// GET a source across the API versions Flux serves (v1 first, then v1beta2
/// for older installs)
async fn get_source(
    client: kube::Client,
    kind: &str,
    namespace: &str,
    name: &str,
) -> Result<(ApiResource, DynamicObject), String> {
    for version in ["v1", "v1beta2"] {
        let ar = source_ar(kind, version)?;
        let api: Api<DynamicObject> = Api::namespaced_with(client.clone(), namespace, &ar);
        match api.get(name).await {
            Ok(obj) => return Ok((ar, obj)),
            Err(kube::Error::Api(resp)) if resp.code == 404 => continue,
            Err(e) => return Err(format!("Failed to get source {}/{}: {}", kind, name, e)),
        }
    }
    Err(format!("Source {}/{} not found", kind, name))
}

/// Annotate a Flux source and wait until it has handled the request and is
/// Ready, so the dependent resource reconciles against the fresh artifact
/// instead of the previous one (mirrors `flux reconcile --with-source`).
async fn reconcile_source_and_wait(
    client: kube::Client,
    kind: &str,
    namespace: &str,
    name: &str,
    token: &str,
) -> Result<(), String> {
    let (ar, obj) = get_source(client.clone(), kind, namespace, name).await?;
    let suspended = obj
        .data
        .get("spec")
        .and_then(|s| s.get("suspend"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if suspended {
        return Err(format!(
            "Source {}/{} is suspended — resume it first",
            kind, name
        ));
    }

    let patch = json!({ "metadata": { "annotations": { REQUESTED_AT: token } } });
    merge_patch(client.clone(), &ar, namespace, name, patch)
        .await
        .map_err(|e| format!("Failed to reconcile source {}/{}: {}", kind, name, e))?;

    let api: Api<DynamicObject> = Api::namespaced_with(client, namespace, &ar);
    let mut consecutive_errors = 0;
    for _ in 0..30 {
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        match api.get(name).await {
            Ok(obj) => {
                consecutive_errors = 0;
                if let Some(result) = reconcile_outcome(&obj.data, token) {
                    if result.outcome == "succeeded" {
                        return Ok(());
                    }
                    return Err(format!(
                        "Source {}/{} failed: {}",
                        kind,
                        name,
                        result.message.unwrap_or_default()
                    ));
                }
            }
            Err(e) => {
                consecutive_errors += 1;
                if consecutive_errors >= 5 {
                    return Err(format!("Failed to watch source {}/{}: {}", kind, name, e));
                }
            }
        }
    }
    Err(format!(
        "Timed out waiting for source {}/{} to reconcile",
        kind, name
    ))
}

/// Read (kind, name, namespace) of a Kustomization's sourceRef
fn kustomization_source_ref(spec: &serde_json::Value) -> Option<(String, String, Option<String>)> {
    parse_source_ref(spec.get("sourceRef")?, "GitRepository")
}

/// The source object to reconcile before a HelmRelease:
/// spec.chartRef (OCIRepository or HelmChart) wins; otherwise the HelmChart
/// generated from the chart template (recorded in status.helmChart), which is
/// what actually feeds the release; the raw template sourceRef is only a
/// fallback while no generated chart exists yet
fn helmrelease_chart_source(data: &serde_json::Value) -> Option<(String, String, Option<String>)> {
    let spec = data.get("spec")?;
    if let Some(chart_ref) = spec.get("chartRef") {
        return parse_source_ref(chart_ref, "OCIRepository");
    }
    if let Some(chart) = data
        .get("status")
        .and_then(|s| s.get("helmChart"))
        .and_then(|v| v.as_str())
    {
        if let Some((ns, name)) = chart.split_once('/') {
            if !ns.is_empty() && !name.is_empty() {
                return Some((
                    "HelmChart".to_string(),
                    name.to_string(),
                    Some(ns.to_string()),
                ));
            }
        }
    }
    parse_source_ref(
        spec.get("chart")?.get("spec")?.get("sourceRef")?,
        "HelmRepository",
    )
}

fn parse_source_ref(
    source_ref: &serde_json::Value,
    default_kind: &str,
) -> Option<(String, String, Option<String>)> {
    Some((
        source_ref
            .get("kind")
            .and_then(|v| v.as_str())
            .unwrap_or(default_kind)
            .to_string(),
        source_ref.get("name").and_then(|v| v.as_str())?.to_string(),
        source_ref
            .get("namespace")
            .and_then(|v| v.as_str())
            .map(String::from),
    ))
}

fn find_condition<'a>(status: &'a serde_json::Value, kind: &str) -> Option<&'a serde_json::Value> {
    status
        .get("conditions")
        .and_then(|c| c.as_array())?
        .iter()
        .find(|c| c.get("type").and_then(|t| t.as_str()) == Some(kind))
}

fn condition_status(condition: Option<&serde_json::Value>) -> &str {
    condition
        .and_then(|c| c.get("status"))
        .and_then(|s| s.as_str())
        .unwrap_or("")
}

fn condition_message(condition: Option<&serde_json::Value>) -> Option<String> {
    condition
        .and_then(|c| c.get("message"))
        .and_then(|m| m.as_str())
        .map(String::from)
}

/// Trigger reconciliation for a Flux Kustomization.
/// Returns the request token so the caller can await the result.
#[command]
pub async fn reconcile_flux_kustomization(
    state: State<'_, AppState>,
    name: String,
    namespace: String,
) -> Result<String, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;
    let token = chrono::Utc::now().to_rfc3339();
    request_reconcile(client, &kustomization_ar(), &namespace, &name, &token, None).await?;
    Ok(token)
}

/// Reconcile a Kustomization's source first, then the Kustomization itself,
/// so a fresh commit is fetched immediately instead of waiting for the source interval
#[command]
pub async fn reconcile_flux_kustomization_with_source(
    state: State<'_, AppState>,
    name: String,
    namespace: String,
) -> Result<String, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;
    let ar = kustomization_ar();
    let api: Api<DynamicObject> = Api::namespaced_with(client.clone(), &namespace, &ar);
    let obj = api
        .get(&name)
        .await
        .map_err(|e| format!("Failed to get kustomization: {}", e))?;
    let (kind, source_name, source_ns) = obj
        .data
        .get("spec")
        .and_then(kustomization_source_ref)
        .ok_or("Kustomization has no sourceRef")?;

    let token = chrono::Utc::now().to_rfc3339();
    reconcile_source_and_wait(
        client.clone(),
        &kind,
        source_ns.as_deref().unwrap_or(&namespace),
        &source_name,
        &token,
    )
    .await?;
    request_reconcile(client, &ar, &namespace, &name, &token, None).await?;
    Ok(token)
}

/// Suspend a Flux Kustomization
#[command]
pub async fn suspend_flux_kustomization(
    state: State<'_, AppState>,
    name: String,
    namespace: String,
) -> Result<(), String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;
    merge_patch(
        client,
        &kustomization_ar(),
        &namespace,
        &name,
        json!({ "spec": { "suspend": true } }),
    )
    .await
    .map_err(|e| format!("Failed to suspend kustomization: {}", e))
}

/// Resume a Flux Kustomization
#[command]
pub async fn resume_flux_kustomization(
    state: State<'_, AppState>,
    name: String,
    namespace: String,
) -> Result<(), String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;
    merge_patch(
        client,
        &kustomization_ar(),
        &namespace,
        &name,
        json!({ "spec": { "suspend": false } }),
    )
    .await
    .map_err(|e| format!("Failed to resume kustomization: {}", e))
}

/// Trigger reconciliation for a Flux HelmRelease.
/// Returns the request token so the caller can await the result.
#[command]
pub async fn reconcile_flux_helmrelease(
    state: State<'_, AppState>,
    name: String,
    namespace: String,
) -> Result<String, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;
    let token = chrono::Utc::now().to_rfc3339();
    request_reconcile(client, &helmrelease_ar(), &namespace, &name, &token, None).await?;
    Ok(token)
}

/// Reconcile a HelmRelease's chart source first, then the HelmRelease itself
#[command]
pub async fn reconcile_flux_helmrelease_with_source(
    state: State<'_, AppState>,
    name: String,
    namespace: String,
) -> Result<String, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;
    let ar = helmrelease_ar();
    let api: Api<DynamicObject> = Api::namespaced_with(client.clone(), &namespace, &ar);
    let obj = api
        .get(&name)
        .await
        .map_err(|e| format!("Failed to get helm release: {}", e))?;
    let (kind, source_name, source_ns) =
        helmrelease_chart_source(&obj.data).ok_or("HelmRelease has no chart source")?;
    let source_ns = source_ns.unwrap_or_else(|| namespace.clone());

    let token = chrono::Utc::now().to_rfc3339();
    if kind == "HelmChart" {
        // Reconcile the chart's upstream source first, then the chart itself,
        // so the release picks up a freshly pulled chart version
        let (_, chart) = get_source(client.clone(), &kind, &source_ns, &source_name).await?;
        if let Some((upstream_kind, upstream_name, upstream_ns)) = chart
            .data
            .get("spec")
            .and_then(|s| s.get("sourceRef"))
            .and_then(|sr| parse_source_ref(sr, "HelmRepository"))
        {
            reconcile_source_and_wait(
                client.clone(),
                &upstream_kind,
                upstream_ns.as_deref().unwrap_or(&source_ns),
                &upstream_name,
                &token,
            )
            .await?;
        }
    }
    reconcile_source_and_wait(client.clone(), &kind, &source_ns, &source_name, &token).await?;
    request_reconcile(client, &ar, &namespace, &name, &token, None).await?;
    Ok(token)
}

/// Force a one-off Helm install/upgrade — recovers releases stuck in a failed state
#[command]
pub async fn force_flux_helmrelease(
    state: State<'_, AppState>,
    name: String,
    namespace: String,
) -> Result<String, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;
    let token = chrono::Utc::now().to_rfc3339();
    request_reconcile(
        client,
        &helmrelease_ar(),
        &namespace,
        &name,
        &token,
        Some(FORCE_AT),
    )
    .await?;
    Ok(token)
}

/// Reset the Helm failure/retry counter — without this, a release that
/// exhausted its retries is never touched again
#[command]
pub async fn reset_flux_helmrelease(
    state: State<'_, AppState>,
    name: String,
    namespace: String,
) -> Result<String, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;
    let token = chrono::Utc::now().to_rfc3339();
    request_reconcile(
        client,
        &helmrelease_ar(),
        &namespace,
        &name,
        &token,
        Some(RESET_AT),
    )
    .await?;
    Ok(token)
}

/// Suspend a Flux HelmRelease
#[command]
pub async fn suspend_flux_helmrelease(
    state: State<'_, AppState>,
    name: String,
    namespace: String,
) -> Result<(), String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;
    merge_patch(
        client,
        &helmrelease_ar(),
        &namespace,
        &name,
        json!({ "spec": { "suspend": true } }),
    )
    .await
    .map_err(|e| format!("Failed to suspend helm release: {}", e))
}

/// Resume a Flux HelmRelease
#[command]
pub async fn resume_flux_helmrelease(
    state: State<'_, AppState>,
    name: String,
    namespace: String,
) -> Result<(), String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;
    merge_patch(
        client,
        &helmrelease_ar(),
        &namespace,
        &name,
        json!({ "spec": { "suspend": false } }),
    )
    .await
    .map_err(|e| format!("Failed to resume helm release: {}", e))
}

/// Outcome of a reconcile request
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FluxReconcileResult {
    /// "succeeded" | "failed" | "pending"
    pub outcome: String,
    pub message: Option<String>,
}

impl FluxReconcileResult {
    fn new(outcome: &str, message: Option<String>) -> Self {
        Self {
            outcome: outcome.to_string(),
            message,
        }
    }
}

/// Poll a Kustomization/HelmRelease until the reconcile request identified by
/// `token` has been handled and the Ready condition settled (~2 min timeout,
/// then "pending")
#[command]
pub async fn wait_flux_reconcile(
    state: State<'_, AppState>,
    kind: String,
    name: String,
    namespace: String,
    token: String,
) -> Result<FluxReconcileResult, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;
    let ar = match kind.as_str() {
        "kustomization" => kustomization_ar(),
        "helmrelease" => helmrelease_ar(),
        other => return Err(format!("Unsupported Flux kind: {}", other)),
    };
    let api: Api<DynamicObject> = Api::namespaced_with(client, &namespace, &ar);
    let mut consecutive_errors = 0;
    for _ in 0..60 {
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        match api.get(&name).await {
            Ok(obj) => {
                consecutive_errors = 0;
                if let Some(result) = reconcile_outcome(&obj.data, &token) {
                    return Ok(result);
                }
            }
            // Tolerate transient API errors — only give up when they persist
            Err(e) => {
                consecutive_errors += 1;
                if consecutive_errors >= 5 {
                    return Err(format!("Failed to get {}: {}", kind, e));
                }
            }
        }
    }
    Ok(FluxReconcileResult::new("pending", None))
}

/// A request token counts as handled when the controller recorded it verbatim,
/// or recorded a newer one (a concurrent request overwrote ours — the state we
/// then observe is at least as fresh as what we asked for)
fn token_handled(handled: Option<&str>, token: &str) -> bool {
    let Some(handled) = handled else { return false };
    if handled == token {
        return true;
    }
    match (
        chrono::DateTime::parse_from_rfc3339(handled),
        chrono::DateTime::parse_from_rfc3339(token),
    ) {
        (Ok(handled), Ok(token)) => handled >= token,
        _ => false,
    }
}

/// None = keep waiting; Some = final outcome for this request token
fn reconcile_outcome(data: &serde_json::Value, token: &str) -> Option<FluxReconcileResult> {
    let status = data.get("status")?;
    // The controller records the handled token in status.lastHandledReconcileAt;
    // until it matches, the request has not been picked up yet
    let handled = status
        .get("lastHandledReconcileAt")
        .and_then(|v| v.as_str());
    if !token_handled(handled, token) {
        return None;
    }
    let stalled = find_condition(status, "Stalled");
    if condition_status(stalled) == "True" {
        return Some(FluxReconcileResult::new(
            "failed",
            condition_message(stalled),
        ));
    }
    if condition_status(find_condition(status, "Reconciling")) == "True" {
        return None;
    }
    let ready = find_condition(status, "Ready");
    match condition_status(ready) {
        "True" => Some(FluxReconcileResult::new(
            "succeeded",
            condition_message(ready),
        )),
        "False" => Some(FluxReconcileResult::new("failed", condition_message(ready))),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kustomization_source_ref_reads_kind_name_and_namespace() {
        let spec = json!({
            "sourceRef": { "kind": "OCIRepository", "name": "podinfo", "namespace": "flux-system" }
        });
        assert_eq!(
            kustomization_source_ref(&spec),
            Some((
                "OCIRepository".to_string(),
                "podinfo".to_string(),
                Some("flux-system".to_string())
            ))
        );
    }

    #[test]
    fn kustomization_source_ref_defaults_kind_and_handles_missing() {
        let spec = json!({ "sourceRef": { "name": "repo" } });
        assert_eq!(
            kustomization_source_ref(&spec),
            Some(("GitRepository".to_string(), "repo".to_string(), None))
        );
        assert_eq!(kustomization_source_ref(&json!({})), None);
    }

    #[test]
    fn helmrelease_chart_source_prefers_chart_ref() {
        let data = json!({
            "spec": {
                "chartRef": { "kind": "OCIRepository", "name": "podinfo-oci" },
                "chart": { "spec": { "sourceRef": { "kind": "HelmRepository", "name": "podinfo" } } }
            },
            "status": { "helmChart": "flux-system/flux-system-podinfo" }
        });
        assert_eq!(
            helmrelease_chart_source(&data),
            Some(("OCIRepository".to_string(), "podinfo-oci".to_string(), None))
        );
    }

    #[test]
    fn helmrelease_chart_source_uses_generated_helm_chart_for_templates() {
        // The generated HelmChart (status.helmChart) feeds the release, so a
        // chart-template HelmRelease must reconcile that chain — not the
        // HelmRepository directly
        let data = json!({
            "spec": {
                "chart": { "spec": { "sourceRef": { "kind": "HelmRepository", "name": "podinfo" } } }
            },
            "status": { "helmChart": "flux-system/flux-system-podinfo" }
        });
        assert_eq!(
            helmrelease_chart_source(&data),
            Some((
                "HelmChart".to_string(),
                "flux-system-podinfo".to_string(),
                Some("flux-system".to_string())
            ))
        );
    }

    #[test]
    fn helmrelease_chart_source_falls_back_to_template_source_ref() {
        // No generated chart recorded yet (fresh HelmRelease without status)
        let data = json!({
            "spec": {
                "chart": { "spec": { "sourceRef": { "kind": "HelmRepository", "name": "podinfo" } } }
            }
        });
        assert_eq!(
            helmrelease_chart_source(&data),
            Some(("HelmRepository".to_string(), "podinfo".to_string(), None))
        );
        assert_eq!(helmrelease_chart_source(&json!({})), None);
    }

    #[test]
    fn token_handled_accepts_newer_concurrent_tokens() {
        assert!(token_handled(
            Some("2026-07-25T10:00:00+00:00"),
            "2026-07-25T10:00:00+00:00"
        ));
        // A concurrent request overwrote ours with a newer token — ours is
        // implicitly handled, the wait must not report a false "pending"
        assert!(token_handled(
            Some("2026-07-25T10:00:05+00:00"),
            "2026-07-25T10:00:00+00:00"
        ));
        // Different timezone offsets still compare correctly
        assert!(token_handled(
            Some("2026-07-25T12:00:05+02:00"),
            "2026-07-25T10:00:00+00:00"
        ));
        assert!(!token_handled(
            Some("2026-07-25T09:59:59+00:00"),
            "2026-07-25T10:00:00+00:00"
        ));
        assert!(!token_handled(None, "2026-07-25T10:00:00+00:00"));
        assert!(!token_handled(
            Some("not-a-timestamp"),
            "2026-07-25T10:00:00+00:00"
        ));
    }

    #[test]
    fn parse_flux_kustomization_keeps_stalled_root_cause_as_message() {
        let mut obj = DynamicObject::new("apps", &kustomization_ar());
        obj.metadata.namespace = Some("flux-system".to_string());
        obj.data = json!({
            "spec": { "path": "./apps", "interval": "10m" },
            "status": {
                "conditions": [
                    { "type": "Stalled", "status": "True", "message": "retries exhausted" },
                    { "type": "Ready", "status": "False", "message": "generic failure" }
                ]
            }
        });
        let info = parse_flux_kustomization(obj).unwrap();
        assert_eq!(info.status, FluxKustomizationStatus::Failed);
        assert_eq!(info.message.as_deref(), Some("retries exhausted"));
    }

    #[test]
    fn source_ar_rejects_unknown_kinds() {
        assert!(source_ar("GitRepository", "v1").is_ok());
        assert!(source_ar("ImageRepository", "v1").is_err());
    }

    fn status_with(token: &str, conditions: serde_json::Value) -> serde_json::Value {
        json!({ "status": { "lastHandledReconcileAt": token, "conditions": conditions } })
    }

    #[test]
    fn reconcile_outcome_waits_until_token_is_handled() {
        let data = status_with("old-token", json!([{ "type": "Ready", "status": "True" }]));
        assert_eq!(reconcile_outcome(&data, "new-token"), None);
        assert_eq!(reconcile_outcome(&json!({}), "new-token"), None);
    }

    #[test]
    fn reconcile_outcome_keeps_waiting_while_reconciling() {
        let data = status_with(
            "token",
            json!([
                { "type": "Reconciling", "status": "True" },
                { "type": "Ready", "status": "Unknown" }
            ]),
        );
        assert_eq!(reconcile_outcome(&data, "token"), None);
    }

    #[test]
    fn reconcile_outcome_reports_ready_and_failed() {
        let ok = status_with("token", json!([{ "type": "Ready", "status": "True" }]));
        assert_eq!(
            reconcile_outcome(&ok, "token").unwrap().outcome,
            "succeeded"
        );

        let failed = status_with(
            "token",
            json!([{ "type": "Ready", "status": "False", "message": "health check failed" }]),
        );
        let result = reconcile_outcome(&failed, "token").unwrap();
        assert_eq!(result.outcome, "failed");
        assert_eq!(result.message.as_deref(), Some("health check failed"));
    }

    #[test]
    fn reconcile_outcome_reports_stalled_as_failed() {
        let data = status_with(
            "token",
            json!([
                { "type": "Stalled", "status": "True", "message": "retries exhausted" },
                { "type": "Ready", "status": "False", "message": "other" }
            ]),
        );
        let result = reconcile_outcome(&data, "token").unwrap();
        assert_eq!(result.outcome, "failed");
        assert_eq!(result.message.as_deref(), Some("retries exhausted"));
    }
}
