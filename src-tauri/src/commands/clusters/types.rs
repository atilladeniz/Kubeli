use serde::{Deserialize, Serialize};

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

/// Namespace resolution result with source indicator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NamespaceResult {
    pub namespaces: Vec<String>,
    /// "auto" = discovered from API, "configured" = from cluster settings, "none" = empty
    pub source: String,
}
