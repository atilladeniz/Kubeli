use crate::k8s::AppState;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use flate2::read::GzDecoder;
use k8s_openapi::api::core::v1::Secret;
use kube::{
    api::{DynamicObject, ListParams},
    discovery::ApiResource,
    Api,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::io::Read;
use tauri::{command, State};

/// Source that manages the Helm release
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum HelmManagedBy {
    /// Native Helm CLI release (stored in secrets)
    Helm,
    /// Flux CD HelmRelease CRD
    Flux,
}

/// Helm release status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HelmReleaseStatus {
    Unknown,
    Deployed,
    Uninstalled,
    Superseded,
    Failed,
    Uninstalling,
    PendingInstall,
    PendingUpgrade,
    PendingRollback,
}

impl From<&str> for HelmReleaseStatus {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "deployed" => HelmReleaseStatus::Deployed,
            "uninstalled" => HelmReleaseStatus::Uninstalled,
            "superseded" => HelmReleaseStatus::Superseded,
            "failed" => HelmReleaseStatus::Failed,
            "uninstalling" => HelmReleaseStatus::Uninstalling,
            "pending-install" => HelmReleaseStatus::PendingInstall,
            "pending-upgrade" => HelmReleaseStatus::PendingUpgrade,
            "pending-rollback" => HelmReleaseStatus::PendingRollback,
            _ => HelmReleaseStatus::Unknown,
        }
    }
}

/// Helm release info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HelmReleaseInfo {
    pub name: String,
    pub namespace: String,
    pub revision: i32,
    pub status: HelmReleaseStatus,
    pub chart: String,
    pub chart_version: String,
    pub app_version: String,
    pub first_deployed: Option<String>,
    pub last_deployed: Option<String>,
    pub description: String,
    pub notes: Option<String>,
    /// Source managing this release (helm or flux)
    pub managed_by: HelmManagedBy,
    /// Whether the release is suspended (Flux only)
    pub suspended: bool,
}

/// Helm release history entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HelmReleaseHistoryEntry {
    pub revision: i32,
    pub status: HelmReleaseStatus,
    pub chart: String,
    pub chart_version: String,
    pub app_version: String,
    pub deployed: Option<String>,
    pub description: String,
}

/// Helm release detail (includes values and manifest)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HelmReleaseDetail {
    pub name: String,
    pub namespace: String,
    pub revision: i32,
    pub status: HelmReleaseStatus,
    pub chart: String,
    pub chart_version: String,
    pub app_version: String,
    pub first_deployed: Option<String>,
    pub last_deployed: Option<String>,
    pub description: String,
    pub notes: Option<String>,
    pub values: serde_json::Value,
    pub manifest: String,
    /// Source managing this release (helm or flux)
    pub managed_by: HelmManagedBy,
}

/// Internal Helm release structure (from secret data)
#[derive(Debug, Deserialize)]
struct HelmReleaseData {
    name: String,
    info: HelmReleaseInfoData,
    chart: HelmChartData,
    #[serde(default)]
    config: serde_json::Value,
    #[serde(default)]
    manifest: String,
    version: i32,
}

#[derive(Debug, Deserialize)]
struct HelmReleaseInfoData {
    first_deployed: Option<String>,
    last_deployed: Option<String>,
    description: Option<String>,
    status: String,
    #[serde(default)]
    notes: Option<String>,
}

#[derive(Debug, Deserialize)]
struct HelmChartData {
    metadata: HelmChartMetadataData,
}

#[derive(Debug, Deserialize)]
struct HelmChartMetadataData {
    name: String,
    version: String,
    #[serde(default, rename = "appVersion")]
    app_version: String,
}

/// Decode Helm release data from secret
/// Helm stores data as: base64 -> base64 -> gzip compressed JSON
fn decode_helm_release(data: &str) -> Result<HelmReleaseData, String> {
    // First base64 decode
    let decoded1 = BASE64
        .decode(data)
        .map_err(|e| format!("Failed to decode base64 (1st): {}", e))?;

    // Second base64 decode
    let decoded2 = BASE64
        .decode(&decoded1)
        .map_err(|e| format!("Failed to decode base64 (2nd): {}", e))?;

    // Gzip decompress
    let mut decoder = GzDecoder::new(&decoded2[..]);
    let mut decompressed = String::new();
    decoder
        .read_to_string(&mut decompressed)
        .map_err(|e| format!("Failed to decompress gzip: {}", e))?;

    // Parse JSON
    serde_json::from_str(&decompressed).map_err(|e| format!("Failed to parse JSON: {}", e))
}

/// Get the latest revision number for a release from a list of secrets
fn get_latest_revision(secrets: &[Secret], release_name: &str) -> i32 {
    let prefix = format!("sh.helm.release.v1.{}.v", release_name);
    secrets
        .iter()
        .filter_map(|s| {
            let name = s.metadata.name.as_ref()?;
            if name.starts_with(&prefix) {
                name.strip_prefix(&prefix)?.parse::<i32>().ok()
            } else {
                None
            }
        })
        .max()
        .unwrap_or(0)
}

/// List all Helm releases across all namespaces or in a specific namespace
#[command]
pub async fn list_helm_releases(
    state: State<'_, AppState>,
    namespace: Option<String>,
) -> Result<Vec<HelmReleaseInfo>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let mut releases: BTreeMap<(String, String), HelmReleaseInfo> = BTreeMap::new();

    // List params to filter Helm secrets
    let lp = ListParams::default().labels("owner=helm");

    let secrets: Vec<Secret> = if let Some(ref ns) = namespace {
        let api: Api<Secret> = Api::namespaced(client, ns);
        api.list(&lp).await.map_err(|e| e.to_string())?.items
    } else {
        let api: Api<Secret> = Api::all(client);
        api.list(&lp).await.map_err(|e| e.to_string())?.items
    };

    // Group secrets by release name and namespace
    let mut release_secrets: BTreeMap<(String, String), Vec<Secret>> = BTreeMap::new();
    for secret in &secrets {
        let ns = secret.metadata.namespace.clone().unwrap_or_default();
        let name = secret.metadata.name.clone().unwrap_or_default();

        // Extract release name from secret name (sh.helm.release.v1.<name>.v<revision>)
        if let Some(release_name) = name
            .strip_prefix("sh.helm.release.v1.")
            .and_then(|s| s.rsplit_once(".v"))
            .map(|(name, _)| name.to_string())
        {
            release_secrets
                .entry((ns, release_name))
                .or_default()
                .push(secret.clone());
        }
    }

    // Process each release (get latest revision)
    for ((ns, release_name), release_secrets_list) in release_secrets {
        let latest_rev = get_latest_revision(&release_secrets_list, &release_name);
        let secret_name = format!("sh.helm.release.v1.{}.v{}", release_name, latest_rev);

        if let Some(secret) = release_secrets_list
            .iter()
            .find(|s| s.metadata.name.as_ref() == Some(&secret_name))
        {
            if let Some(data) = secret.data.as_ref().and_then(|d| d.get("release")) {
                let data_str = String::from_utf8_lossy(&data.0);
                if let Ok(release_data) = decode_helm_release(&data_str) {
                    let info = HelmReleaseInfo {
                        name: release_data.name.clone(),
                        namespace: ns.clone(),
                        revision: release_data.version,
                        status: HelmReleaseStatus::from(release_data.info.status.as_str()),
                        chart: release_data.chart.metadata.name.clone(),
                        chart_version: release_data.chart.metadata.version.clone(),
                        app_version: release_data.chart.metadata.app_version.clone(),
                        first_deployed: release_data.info.first_deployed.clone(),
                        last_deployed: release_data.info.last_deployed.clone(),
                        description: release_data.info.description.clone().unwrap_or_default(),
                        notes: release_data.info.notes.clone(),
                        managed_by: HelmManagedBy::Helm,
                        suspended: false, // Native Helm releases can't be suspended
                    };
                    releases.insert((ns, release_name), info);
                }
            }
        }
    }

    // Also fetch Flux HelmRelease CRDs and merge them
    let flux_releases =
        list_flux_helm_releases_internal(state.k8s.get_client().await.ok(), namespace.clone())
            .await;
    for flux_release in flux_releases {
        // Only add if not already present (native Helm takes precedence)
        let key = (flux_release.namespace.clone(), flux_release.name.clone());
        releases.entry(key).or_insert(flux_release);
    }

    Ok(releases.into_values().collect())
}

/// Fetch Flux HelmRelease CRDs and convert them to HelmReleaseInfo
async fn list_flux_helm_releases_internal(
    client: Option<kube::Client>,
    namespace: Option<String>,
) -> Vec<HelmReleaseInfo> {
    let Some(client) = client else {
        return Vec::new();
    };

    // Define the Flux HelmRelease API resource
    // Flux v2 uses helm.toolkit.fluxcd.io/v2 (or v2beta1/v2beta2 for older versions)
    let ar = ApiResource {
        group: "helm.toolkit.fluxcd.io".to_string(),
        version: "v2".to_string(),
        api_version: "helm.toolkit.fluxcd.io/v2".to_string(),
        kind: "HelmRelease".to_string(),
        plural: "helmreleases".to_string(),
    };

    let lp = ListParams::default();

    let result: Result<Vec<DynamicObject>, _> = if let Some(ref ns) = namespace {
        let api: Api<DynamicObject> = Api::namespaced_with(client.clone(), ns, &ar);
        api.list(&lp).await.map(|list| list.items)
    } else {
        let api: Api<DynamicObject> = Api::all_with(client.clone(), &ar);
        api.list(&lp).await.map(|list| list.items)
    };

    // If v2 fails, try v2beta2 (older Flux versions)
    let items = match result {
        Ok(items) => items,
        Err(_) => {
            let ar_beta = ApiResource {
                group: "helm.toolkit.fluxcd.io".to_string(),
                version: "v2beta2".to_string(),
                api_version: "helm.toolkit.fluxcd.io/v2beta2".to_string(),
                kind: "HelmRelease".to_string(),
                plural: "helmreleases".to_string(),
            };
            let result_beta: Result<Vec<DynamicObject>, _> = if let Some(ref ns) = namespace {
                let api: Api<DynamicObject> = Api::namespaced_with(client.clone(), ns, &ar_beta);
                api.list(&lp).await.map(|list| list.items)
            } else {
                let api: Api<DynamicObject> = Api::all_with(client.clone(), &ar_beta);
                api.list(&lp).await.map(|list| list.items)
            };
            result_beta.unwrap_or_default()
        }
    };

    items
        .into_iter()
        .filter_map(|obj| parse_flux_helm_release(obj))
        .collect()
}

/// Parse a Flux HelmRelease DynamicObject into HelmReleaseInfo
fn parse_flux_helm_release(obj: DynamicObject) -> Option<HelmReleaseInfo> {
    let name = obj.metadata.name.clone()?;
    let namespace = obj.metadata.namespace.clone().unwrap_or_default();
    let created_at = obj
        .metadata
        .creation_timestamp
        .as_ref()
        .map(|t| t.0.to_string());

    // Extract chart info from spec.chart.spec
    let spec = obj.data.get("spec")?;
    let chart_spec = spec.get("chart")?.get("spec")?;
    let chart_name = chart_spec
        .get("chart")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();
    let chart_version = chart_spec
        .get("version")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let suspended = spec
        .get("suspend")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    // Extract status
    let status = obj.data.get("status");
    let (helm_status, last_deployed, description) = if let Some(status) = status {
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

        let message = ready_condition
            .and_then(|c| c.get("message"))
            .and_then(|m| m.as_str())
            .unwrap_or("")
            .to_string();

        let last_applied = status
            .get("lastAppliedRevision")
            .and_then(|v| v.as_str())
            .or_else(|| status.get("lastAttemptedRevision").and_then(|v| v.as_str()));

        let last_reconcile = ready_condition
            .and_then(|c| c.get("lastTransitionTime"))
            .and_then(|t| t.as_str())
            .map(|s| s.to_string());

        let helm_status = if is_ready {
            HelmReleaseStatus::Deployed
        } else if message.to_lowercase().contains("failed") {
            HelmReleaseStatus::Failed
        } else if message.to_lowercase().contains("pending") {
            HelmReleaseStatus::PendingInstall
        } else {
            HelmReleaseStatus::Unknown
        };

        (
            helm_status,
            last_reconcile.or(last_applied.map(|s| s.to_string())),
            message,
        )
    } else {
        (HelmReleaseStatus::Unknown, None, String::new())
    };

    // Get revision from status.lastAttemptedRevision or default to 1
    let revision = status
        .and_then(|s| s.get("lastAttemptedRevision"))
        .and_then(|v| v.as_str())
        .and_then(|s| s.split('@').next())
        .and_then(|s| s.parse::<i32>().ok())
        .unwrap_or(1);

    // Try to get appVersion from status.history[0].appVersion (most recent release)
    let app_version = status
        .and_then(|s| s.get("history"))
        .and_then(|h| h.as_array())
        .and_then(|arr| arr.first())
        .and_then(|entry| entry.get("appVersion"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    Some(HelmReleaseInfo {
        name,
        namespace,
        revision,
        status: helm_status,
        chart: chart_name,
        chart_version,
        app_version,
        first_deployed: created_at.clone(),
        last_deployed,
        description,
        notes: None,
        managed_by: HelmManagedBy::Flux,
        suspended,
    })
}

/// Get detailed information about a specific Helm release
#[command]
pub async fn get_helm_release(
    state: State<'_, AppState>,
    name: String,
    namespace: String,
    revision: Option<i32>,
) -> Result<HelmReleaseDetail, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let api: Api<Secret> = Api::namespaced(client.clone(), &namespace);
    let lp = ListParams::default().labels("owner=helm");

    let secrets: Vec<Secret> = api.list(&lp).await.map_err(|e| e.to_string())?.items;

    // Get the requested revision or the latest
    let rev = revision.unwrap_or_else(|| get_latest_revision(&secrets, &name));
    let secret_name = format!("sh.helm.release.v1.{}.v{}", name, rev);

    let secret = api.get(&secret_name).await.map_err(|e| e.to_string())?;

    let data = secret
        .data
        .as_ref()
        .and_then(|d| d.get("release"))
        .ok_or("Release data not found")?;

    let data_str = String::from_utf8_lossy(&data.0);
    let release_data = decode_helm_release(&data_str)?;

    Ok(HelmReleaseDetail {
        name: release_data.name,
        namespace,
        revision: release_data.version,
        status: HelmReleaseStatus::from(release_data.info.status.as_str()),
        chart: release_data.chart.metadata.name,
        chart_version: release_data.chart.metadata.version,
        app_version: release_data.chart.metadata.app_version,
        first_deployed: release_data.info.first_deployed,
        last_deployed: release_data.info.last_deployed,
        description: release_data.info.description.unwrap_or_default(),
        notes: release_data.info.notes,
        values: release_data.config,
        manifest: release_data.manifest,
        managed_by: HelmManagedBy::Helm,
    })
}

/// Get release history (all revisions)
#[command]
pub async fn get_helm_release_history(
    state: State<'_, AppState>,
    name: String,
    namespace: String,
) -> Result<Vec<HelmReleaseHistoryEntry>, String> {
    let client = state.k8s.get_client().await.map_err(|e| e.to_string())?;

    let api: Api<Secret> = Api::namespaced(client, &namespace);
    let lp = ListParams::default().labels("owner=helm");

    let secrets: Vec<Secret> = api.list(&lp).await.map_err(|e| e.to_string())?.items;

    let prefix = format!("sh.helm.release.v1.{}.v", name);
    let mut history: Vec<HelmReleaseHistoryEntry> = Vec::new();

    for secret in secrets {
        let secret_name = secret.metadata.name.clone().unwrap_or_default();
        if !secret_name.starts_with(&prefix) {
            continue;
        }

        if let Some(data) = secret.data.as_ref().and_then(|d| d.get("release")) {
            let data_str = String::from_utf8_lossy(&data.0);
            if let Ok(release_data) = decode_helm_release(&data_str) {
                history.push(HelmReleaseHistoryEntry {
                    revision: release_data.version,
                    status: HelmReleaseStatus::from(release_data.info.status.as_str()),
                    chart: release_data.chart.metadata.name,
                    chart_version: release_data.chart.metadata.version,
                    app_version: release_data.chart.metadata.app_version,
                    deployed: release_data.info.last_deployed,
                    description: release_data.info.description.unwrap_or_default(),
                });
            }
        }
    }

    // Sort by revision descending
    history.sort_by(|a, b| b.revision.cmp(&a.revision));

    Ok(history)
}

/// Get values for a specific release revision
#[command]
pub async fn get_helm_release_values(
    state: State<'_, AppState>,
    name: String,
    namespace: String,
    revision: Option<i32>,
) -> Result<serde_json::Value, String> {
    let detail = get_helm_release(state, name, namespace, revision).await?;
    Ok(detail.values)
}

/// Get manifest for a specific release revision
#[command]
pub async fn get_helm_release_manifest(
    state: State<'_, AppState>,
    name: String,
    namespace: String,
    revision: Option<i32>,
) -> Result<String, String> {
    let detail = get_helm_release(state, name, namespace, revision).await?;
    Ok(detail.manifest)
}
