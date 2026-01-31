#![allow(dead_code)] // Some methods may be used in future features (e.g., Resource Detail Views)

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Represents a parsed kubeconfig file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KubeConfig {
    pub path: PathBuf,
    pub contexts: Vec<ContextInfo>,
    pub clusters: Vec<ClusterInfo>,
    pub users: Vec<UserInfo>,
    pub current_context: Option<String>,
}

/// Type of kubeconfig source
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum KubeconfigSourceType {
    File,
    Folder,
}

/// A configured kubeconfig source (file or folder)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KubeconfigSource {
    pub path: String,
    pub source_type: KubeconfigSourceType,
}

/// Metadata about a kubeconfig source for UI display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KubeconfigSourceInfo {
    pub path: String,
    pub source_type: KubeconfigSourceType,
    pub file_count: usize,
    pub context_count: usize,
    pub valid: bool,
    pub error: Option<String>,
    /// Whether this is the default kubeconfig source (~/.kube/config)
    pub is_default: bool,
}

/// Settings for kubeconfig source management
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KubeconfigSourcesConfig {
    pub sources: Vec<KubeconfigSource>,
    pub merge_mode: bool,
}

/// Information about a Kubernetes context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextInfo {
    pub name: String,
    pub cluster: String,
    pub user: String,
    pub namespace: Option<String>,
    /// Which kubeconfig file this context came from
    #[serde(default)]
    pub source_file: Option<String>,
}

/// Information about a Kubernetes cluster
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterInfo {
    pub name: String,
    pub server: String,
    pub certificate_authority: Option<String>,
    pub certificate_authority_data: Option<String>,
    pub insecure_skip_tls_verify: bool,
}

/// Information about a Kubernetes user/auth
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub name: String,
    pub auth_type: AuthType,
}

/// Authentication type for a user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuthType {
    ClientCertificate,
    Token,
    ExecPlugin,
    Oidc,
    Unknown,
}

#[allow(dead_code)] // Some methods may be used in future features (e.g., Resource Detail Views)
impl KubeConfig {
    /// Returns the default kubeconfig path (~/.kube/config)
    pub fn default_path() -> PathBuf {
        dirs::home_dir()
            .map(|h| h.join(".kube").join("config"))
            .unwrap_or_else(|| PathBuf::from("~/.kube/config"))
    }

    /// Check whether a given path is the default kubeconfig source
    pub fn is_default_source(path: &str) -> bool {
        let default = Self::default_path();
        default.as_path() == path
    }

    /// Load kubeconfig from default path
    pub async fn load() -> Result<Self> {
        Self::load_from(Self::default_path()).await
    }

    /// Load kubeconfig from a specific path
    pub async fn load_from(path: PathBuf) -> Result<Self> {
        let content = tokio::fs::read_to_string(&path)
            .await
            .with_context(|| format!("Failed to read kubeconfig from {:?}", path))?;

        Self::parse(&content, path)
    }

    /// Parse kubeconfig from string content
    pub fn parse(content: &str, path: PathBuf) -> Result<Self> {
        let config: serde_yaml::Value =
            serde_yaml::from_str(content).context("Failed to parse kubeconfig YAML")?;

        let current_context = config
            .get("current-context")
            .and_then(|v| v.as_str())
            .map(String::from);

        let contexts = Self::parse_contexts(&config);
        let clusters = Self::parse_clusters(&config);
        let users = Self::parse_users(&config);

        Ok(Self {
            path,
            contexts,
            clusters,
            users,
            current_context,
        })
    }

    fn parse_contexts(config: &serde_yaml::Value) -> Vec<ContextInfo> {
        Self::parse_contexts_with_source(config, None)
    }

    fn parse_contexts_with_source(
        config: &serde_yaml::Value,
        source_file: Option<&str>,
    ) -> Vec<ContextInfo> {
        config
            .get("contexts")
            .and_then(|v| v.as_sequence())
            .map(|seq| {
                seq.iter()
                    .filter_map(|ctx| {
                        let name = ctx.get("name")?.as_str()?.to_string();
                        let context = ctx.get("context")?;
                        let cluster = context.get("cluster")?.as_str()?.to_string();
                        let user = context.get("user")?.as_str()?.to_string();
                        let namespace = context
                            .get("namespace")
                            .and_then(|v| v.as_str())
                            .map(String::from);

                        Some(ContextInfo {
                            name,
                            cluster,
                            user,
                            namespace,
                            source_file: source_file.map(String::from),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default()
    }

    fn parse_clusters(config: &serde_yaml::Value) -> Vec<ClusterInfo> {
        config
            .get("clusters")
            .and_then(|v| v.as_sequence())
            .map(|seq| {
                seq.iter()
                    .filter_map(|c| {
                        let name = c.get("name")?.as_str()?.to_string();
                        let cluster = c.get("cluster")?;
                        let server = cluster.get("server")?.as_str()?.to_string();
                        let certificate_authority = cluster
                            .get("certificate-authority")
                            .and_then(|v| v.as_str())
                            .map(String::from);
                        let certificate_authority_data = cluster
                            .get("certificate-authority-data")
                            .and_then(|v| v.as_str())
                            .map(String::from);
                        let insecure_skip_tls_verify = cluster
                            .get("insecure-skip-tls-verify")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false);

                        Some(ClusterInfo {
                            name,
                            server,
                            certificate_authority,
                            certificate_authority_data,
                            insecure_skip_tls_verify,
                        })
                    })
                    .collect()
            })
            .unwrap_or_default()
    }

    fn parse_users(config: &serde_yaml::Value) -> Vec<UserInfo> {
        config
            .get("users")
            .and_then(|v| v.as_sequence())
            .map(|seq| {
                seq.iter()
                    .filter_map(|u| {
                        let name = u.get("name")?.as_str()?.to_string();
                        let user = u.get("user")?;

                        let auth_type = if user.get("client-certificate").is_some()
                            || user.get("client-certificate-data").is_some()
                        {
                            AuthType::ClientCertificate
                        } else if user.get("token").is_some() {
                            AuthType::Token
                        } else if user.get("exec").is_some() {
                            AuthType::ExecPlugin
                        } else if user.get("auth-provider").is_some() {
                            AuthType::Oidc
                        } else {
                            AuthType::Unknown
                        };

                        Some(UserInfo { name, auth_type })
                    })
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Get context info by name
    #[allow(dead_code)] // May be used in future features (e.g., Resource Detail Views)
    pub fn get_context(&self, name: &str) -> Option<&ContextInfo> {
        self.contexts.iter().find(|c| c.name == name)
    }

    /// Get cluster info by name
    pub fn get_cluster(&self, name: &str) -> Option<&ClusterInfo> {
        self.clusters.iter().find(|c| c.name == name)
    }

    /// Get current context info
    #[allow(dead_code)] // May be used in future features (e.g., Resource Detail Views)
    pub fn get_current_context(&self) -> Option<&ContextInfo> {
        self.current_context
            .as_ref()
            .and_then(|name| self.get_context(name))
    }

    /// Check if kubeconfig file exists
    pub async fn exists() -> bool {
        tokio::fs::metadata(Self::default_path()).await.is_ok()
    }

    /// Load kubeconfigs from multiple sources and merge them
    pub async fn load_from_sources(sources: &[KubeconfigSource], merge_mode: bool) -> Result<Self> {
        let mut all_files: Vec<PathBuf> = Vec::new();

        for source in sources {
            let path = PathBuf::from(&source.path);
            match source.source_type {
                KubeconfigSourceType::File => {
                    if path.exists() {
                        all_files.push(path);
                    }
                }
                KubeconfigSourceType::Folder => {
                    if let Ok(entries) = Self::scan_folder(&path).await {
                        all_files.extend(entries);
                    }
                }
            }
        }

        // Also respect KUBECONFIG env var (platform-aware separator)
        if let Ok(env_val) = std::env::var("KUBECONFIG") {
            for path in std::env::split_paths(&env_val) {
                if path.exists() && !all_files.iter().any(|f| f == &path) {
                    all_files.push(path);
                }
            }
        }

        if all_files.is_empty() {
            // Fallback to default
            return Self::load().await;
        }

        Self::load_and_merge(&all_files, merge_mode).await
    }

    /// Scan a folder for kubeconfig files (*.yaml, *.yml, config)
    pub async fn scan_folder(folder: &PathBuf) -> Result<Vec<PathBuf>> {
        let mut files = Vec::new();
        let mut entries = tokio::fs::read_dir(folder)
            .await
            .with_context(|| format!("Failed to read directory {:?}", folder))?;

        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            if path.is_file() {
                let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                if ext == "yaml" || ext == "yml" || name == "config" {
                    files.push(path);
                }
            }
        }

        files.sort();
        Ok(files)
    }

    /// Load multiple kubeconfig files and merge into one KubeConfig
    #[cfg_attr(test, allow(dead_code))]
    pub(crate) async fn load_and_merge(files: &[PathBuf], merge_mode: bool) -> Result<Self> {
        let mut all_contexts: Vec<ContextInfo> = Vec::new();
        let mut all_clusters: Vec<ClusterInfo> = Vec::new();
        let mut all_users: Vec<UserInfo> = Vec::new();
        let mut current_context: Option<String> = None;
        let mut seen_context_names: std::collections::HashSet<String> =
            std::collections::HashSet::new();
        // Track which cluster/user names exist per source file (for non-merge filtering)
        let mut clusters_by_source: std::collections::HashMap<String, Vec<String>> =
            std::collections::HashMap::new();
        let mut users_by_source: std::collections::HashMap<String, Vec<String>> =
            std::collections::HashMap::new();

        for file in files {
            let content = match tokio::fs::read_to_string(file).await {
                Ok(c) => c,
                Err(e) => {
                    tracing::warn!("Skipping kubeconfig {:?}: {}", file, e);
                    continue;
                }
            };

            let config: serde_yaml::Value = match serde_yaml::from_str(&content) {
                Ok(c) => c,
                Err(e) => {
                    tracing::warn!("Skipping invalid kubeconfig {:?}: {}", file, e);
                    continue;
                }
            };

            let source_str = file.display().to_string();

            // Take current-context from first file that has one
            if current_context.is_none() {
                current_context = config
                    .get("current-context")
                    .and_then(|v| v.as_str())
                    .map(String::from);
            }

            let contexts = Self::parse_contexts_with_source(&config, Some(&source_str));
            for ctx in contexts {
                if seen_context_names.contains(&ctx.name) {
                    // Skip duplicate context names (first source wins)
                    continue;
                }
                seen_context_names.insert(ctx.name.clone());
                all_contexts.push(ctx);
            }

            let clusters = Self::parse_clusters(&config);
            let mut file_cluster_names = Vec::new();
            for cluster in clusters {
                file_cluster_names.push(cluster.name.clone());
                if !all_clusters.iter().any(|c| c.name == cluster.name) {
                    all_clusters.push(cluster);
                }
            }
            clusters_by_source.insert(source_str.clone(), file_cluster_names);

            let users = Self::parse_users(&config);
            let mut file_user_names = Vec::new();
            for user in users {
                file_user_names.push(user.name.clone());
                if !all_users.iter().any(|u| u.name == user.name) {
                    all_users.push(user);
                }
            }
            users_by_source.insert(source_str.clone(), file_user_names);
        }

        if !merge_mode {
            // In non-merge mode, each context must have its cluster and user
            // defined in the same source file. Filter out cross-file references.
            all_contexts.retain(|ctx| {
                let source = match &ctx.source_file {
                    Some(s) => s,
                    None => return true,
                };
                let file_clusters = clusters_by_source.get(source);
                let file_users = users_by_source.get(source);
                let cluster_ok = ctx.cluster.is_empty()
                    || file_clusters.is_some_and(|names| names.contains(&ctx.cluster));
                let user_ok = ctx.user.is_empty()
                    || file_users.is_some_and(|names| names.contains(&ctx.user));
                cluster_ok && user_ok
            });
        }

        Ok(Self {
            path: files.first().cloned().unwrap_or_default(),
            contexts: all_contexts,
            clusters: all_clusters,
            users: all_users,
            current_context,
        })
    }

    /// Validate a path as a valid kubeconfig file or folder
    pub async fn validate_path(path: &str) -> Result<KubeconfigSourceInfo> {
        let pb = PathBuf::from(path);
        let is_default = Self::is_default_source(path);

        if pb.is_dir() {
            let files = Self::scan_folder(&pb).await.unwrap_or_default();
            let mut total_contexts = 0;
            for file in &files {
                if let Ok(cfg) = Self::load_from(file.clone()).await {
                    total_contexts += cfg.contexts.len();
                }
            }
            Ok(KubeconfigSourceInfo {
                path: path.to_string(),
                source_type: KubeconfigSourceType::Folder,
                file_count: files.len(),
                context_count: total_contexts,
                valid: !files.is_empty(),
                error: if files.is_empty() {
                    Some("No kubeconfig files found in folder".to_string())
                } else {
                    None
                },
                is_default,
            })
        } else if pb.is_file() {
            match Self::load_from(pb).await {
                Ok(cfg) => Ok(KubeconfigSourceInfo {
                    path: path.to_string(),
                    source_type: KubeconfigSourceType::File,
                    file_count: 1,
                    context_count: cfg.contexts.len(),
                    valid: true,
                    error: None,
                    is_default,
                }),
                Err(e) => Ok(KubeconfigSourceInfo {
                    path: path.to_string(),
                    source_type: KubeconfigSourceType::File,
                    file_count: 1,
                    context_count: 0,
                    valid: false,
                    error: Some(format!("Invalid kubeconfig: {}", e)),
                    is_default,
                }),
            }
        } else {
            Ok(KubeconfigSourceInfo {
                path: path.to_string(),
                source_type: KubeconfigSourceType::File,
                file_count: 0,
                context_count: 0,
                valid: false,
                error: Some("Path does not exist".to_string()),
                is_default,
            })
        }
    }

    /// Get default sources config (for first launch / migration)
    pub fn default_sources_config() -> KubeconfigSourcesConfig {
        KubeconfigSourcesConfig {
            sources: vec![KubeconfigSource {
                path: Self::default_path().display().to_string(),
                source_type: KubeconfigSourceType::File,
            }],
            merge_mode: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_KUBECONFIG: &str = r#"
apiVersion: v1
kind: Config
current-context: minikube
clusters:
- name: minikube
  cluster:
    server: https://127.0.0.1:8443
    certificate-authority: /home/user/.minikube/ca.crt
- name: production
  cluster:
    server: https://k8s.example.com:6443
    certificate-authority-data: LS0tLS1CRUdJTi...
contexts:
- name: minikube
  context:
    cluster: minikube
    user: minikube
    namespace: default
- name: production
  context:
    cluster: production
    user: admin
users:
- name: minikube
  user:
    client-certificate: /home/user/.minikube/profiles/minikube/client.crt
    client-key: /home/user/.minikube/profiles/minikube/client.key
- name: admin
  user:
    token: eyJhbGciOiJSUzI1NiIs...
"#;

    const SAMPLE_KUBECONFIG_EXTENDED: &str = r#"
apiVersion: v1
kind: Config
current-context: exec-context
clusters:
- name: exec-cluster
  cluster:
    server: https://127.0.0.1:6443
contexts:
- name: exec-context
  context:
    cluster: exec-cluster
    user: exec-user
- name: oidc-context
  context:
    cluster: exec-cluster
    user: oidc-user
users:
- name: exec-user
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1beta1
      command: aws
      args: ["eks", "get-token", "--cluster-name", "demo"]
- name: oidc-user
  user:
    auth-provider:
      name: oidc
      config:
        id-token: fake
"#;

    #[test]
    fn test_parse_kubeconfig() {
        let config = KubeConfig::parse(SAMPLE_KUBECONFIG, PathBuf::from("/test")).unwrap();

        assert_eq!(config.current_context, Some("minikube".to_string()));
        assert_eq!(config.contexts.len(), 2);
        assert_eq!(config.clusters.len(), 2);
        assert_eq!(config.users.len(), 2);
    }

    #[test]
    fn test_get_current_context() {
        let config = KubeConfig::parse(SAMPLE_KUBECONFIG, PathBuf::from("/test")).unwrap();
        let ctx = config.get_current_context().unwrap();
        assert_eq!(ctx.name, "minikube");
        assert_eq!(ctx.cluster, "minikube");
        assert_eq!(ctx.namespace, Some("default".to_string()));
    }

    #[test]
    fn test_auth_types() {
        let config = KubeConfig::parse(SAMPLE_KUBECONFIG, PathBuf::from("/test")).unwrap();
        let minikube_user = config.users.iter().find(|u| u.name == "minikube").unwrap();
        assert!(matches!(
            minikube_user.auth_type,
            AuthType::ClientCertificate
        ));
        let admin_user = config.users.iter().find(|u| u.name == "admin").unwrap();
        assert!(matches!(admin_user.auth_type, AuthType::Token));
    }

    #[test]
    fn test_auth_types_exec_and_oidc() {
        let config = KubeConfig::parse(SAMPLE_KUBECONFIG_EXTENDED, PathBuf::from("/test")).unwrap();
        let exec_user = config.users.iter().find(|u| u.name == "exec-user").unwrap();
        assert!(matches!(exec_user.auth_type, AuthType::ExecPlugin));
        let oidc_user = config.users.iter().find(|u| u.name == "oidc-user").unwrap();
        assert!(matches!(oidc_user.auth_type, AuthType::Oidc));
    }

    // --- Kubeconfig sources tests ---

    #[test]
    fn test_is_default_source() {
        let default_path = KubeConfig::default_path().display().to_string();
        assert!(KubeConfig::is_default_source(&default_path));
        assert!(!KubeConfig::is_default_source("/some/other/path"));
        assert!(!KubeConfig::is_default_source(""));
    }

    #[test]
    fn test_default_sources_config() {
        let config = KubeConfig::default_sources_config();
        assert_eq!(config.sources.len(), 1);
        assert!(!config.merge_mode);
        assert!(matches!(
            config.sources[0].source_type,
            KubeconfigSourceType::File
        ));
        assert!(KubeConfig::is_default_source(&config.sources[0].path));
    }

    #[test]
    fn test_parse_contexts_with_source_tracking() {
        let config: serde_yaml::Value = serde_yaml::from_str(SAMPLE_KUBECONFIG).unwrap();
        let contexts = KubeConfig::parse_contexts_with_source(&config, Some("/my/kubeconfig.yaml"));
        assert_eq!(contexts.len(), 2);
        for ctx in &contexts {
            assert_eq!(ctx.source_file.as_deref(), Some("/my/kubeconfig.yaml"));
        }
    }

    #[test]
    fn test_parse_contexts_without_source_tracking() {
        let config: serde_yaml::Value = serde_yaml::from_str(SAMPLE_KUBECONFIG).unwrap();
        let contexts = KubeConfig::parse_contexts_with_source(&config, None);
        assert_eq!(contexts.len(), 2);
        for ctx in &contexts {
            assert!(ctx.source_file.is_none());
        }
    }

    // Sample kubeconfigs for merge testing — contexts-only file
    const CONTEXTS_ONLY: &str = r#"
apiVersion: v1
kind: Config
contexts:
- name: ctx-a
  context:
    cluster: cluster-a
    user: user-a
"#;

    // Clusters-only file
    const CLUSTERS_ONLY: &str = r#"
apiVersion: v1
kind: Config
clusters:
- name: cluster-a
  cluster:
    server: https://10.0.0.1:6443
"#;

    // Users-only file
    const USERS_ONLY: &str = r#"
apiVersion: v1
kind: Config
users:
- name: user-a
  user:
    token: test-token
"#;

    // Complete file (context + cluster + user all present)
    const COMPLETE_FILE: &str = r#"
apiVersion: v1
kind: Config
current-context: complete-ctx
contexts:
- name: complete-ctx
  context:
    cluster: complete-cluster
    user: complete-user
clusters:
- name: complete-cluster
  cluster:
    server: https://complete.example.com:6443
users:
- name: complete-user
  user:
    token: complete-token
"#;

    /// Helper: write content to a temp file and return its path
    fn write_temp_kubeconfig(dir: &std::path::Path, name: &str, content: &str) -> PathBuf {
        let path = dir.join(name);
        std::fs::write(&path, content).unwrap();
        path
    }

    #[tokio::test]
    async fn test_load_and_merge_with_merge_mode() {
        let dir = tempfile::tempdir().unwrap();
        let f1 = write_temp_kubeconfig(dir.path(), "contexts.yaml", CONTEXTS_ONLY);
        let f2 = write_temp_kubeconfig(dir.path(), "clusters.yaml", CLUSTERS_ONLY);
        let f3 = write_temp_kubeconfig(dir.path(), "users.yaml", USERS_ONLY);

        let result = KubeConfig::load_and_merge(&[f1, f2, f3], true)
            .await
            .unwrap();
        // Merge mode: context should be kept even though cluster/user are in other files
        assert_eq!(result.contexts.len(), 1);
        assert_eq!(result.contexts[0].name, "ctx-a");
        assert_eq!(result.clusters.len(), 1);
        assert_eq!(result.users.len(), 1);
    }

    #[tokio::test]
    async fn test_load_and_merge_without_merge_mode_filters_cross_file() {
        let dir = tempfile::tempdir().unwrap();
        let f1 = write_temp_kubeconfig(dir.path(), "contexts.yaml", CONTEXTS_ONLY);
        let f2 = write_temp_kubeconfig(dir.path(), "clusters.yaml", CLUSTERS_ONLY);
        let f3 = write_temp_kubeconfig(dir.path(), "users.yaml", USERS_ONLY);

        let result = KubeConfig::load_and_merge(&[f1, f2, f3], false)
            .await
            .unwrap();
        // Non-merge mode: ctx-a references cluster-a and user-a from different files → filtered
        assert_eq!(result.contexts.len(), 0);
    }

    #[tokio::test]
    async fn test_load_and_merge_complete_file_kept_in_non_merge() {
        let dir = tempfile::tempdir().unwrap();
        let f1 = write_temp_kubeconfig(dir.path(), "complete.yaml", COMPLETE_FILE);

        let result = KubeConfig::load_and_merge(&[f1], false).await.unwrap();
        // Complete file has context + cluster + user in same file → kept
        assert_eq!(result.contexts.len(), 1);
        assert_eq!(result.contexts[0].name, "complete-ctx");
    }

    #[tokio::test]
    async fn test_load_and_merge_duplicate_contexts_first_wins() {
        let dir = tempfile::tempdir().unwrap();
        let f1 = write_temp_kubeconfig(dir.path(), "first.yaml", COMPLETE_FILE);
        // Second file has same context name but different cluster
        let second = r#"
apiVersion: v1
kind: Config
contexts:
- name: complete-ctx
  context:
    cluster: other-cluster
    user: other-user
clusters:
- name: other-cluster
  cluster:
    server: https://other.example.com:6443
users:
- name: other-user
  user:
    token: other-token
"#;
        let f2 = write_temp_kubeconfig(dir.path(), "second.yaml", second);

        let result = KubeConfig::load_and_merge(&[f1, f2], true).await.unwrap();
        assert_eq!(result.contexts.len(), 1);
        assert_eq!(result.contexts[0].cluster, "complete-cluster"); // first wins
    }

    #[tokio::test]
    async fn test_load_and_merge_current_context_from_first_file() {
        let dir = tempfile::tempdir().unwrap();
        let f1 = write_temp_kubeconfig(dir.path(), "complete.yaml", COMPLETE_FILE);
        let f2 = write_temp_kubeconfig(dir.path(), "sample.yaml", SAMPLE_KUBECONFIG);

        let result = KubeConfig::load_and_merge(&[f1, f2], true).await.unwrap();
        assert_eq!(result.current_context, Some("complete-ctx".to_string()));
    }

    #[tokio::test]
    async fn test_load_and_merge_skips_invalid_files() {
        let dir = tempfile::tempdir().unwrap();
        let f1 = write_temp_kubeconfig(dir.path(), "bad.yaml", "not: valid: yaml: [[[");
        let f2 = write_temp_kubeconfig(dir.path(), "good.yaml", COMPLETE_FILE);

        let result = KubeConfig::load_and_merge(&[f1, f2], true).await.unwrap();
        assert_eq!(result.contexts.len(), 1);
        assert_eq!(result.contexts[0].name, "complete-ctx");
    }

    #[tokio::test]
    async fn test_scan_folder() {
        let dir = tempfile::tempdir().unwrap();
        write_temp_kubeconfig(dir.path(), "a.yaml", COMPLETE_FILE);
        write_temp_kubeconfig(dir.path(), "b.yml", SAMPLE_KUBECONFIG);
        write_temp_kubeconfig(dir.path(), "config", CONTEXTS_ONLY);
        write_temp_kubeconfig(dir.path(), "readme.txt", "not a kubeconfig");

        let files = KubeConfig::scan_folder(&dir.path().to_path_buf())
            .await
            .unwrap();
        assert_eq!(files.len(), 3); // a.yaml, b.yml, config — not readme.txt
    }

    #[tokio::test]
    async fn test_validate_path_valid_file() {
        let dir = tempfile::tempdir().unwrap();
        let f = write_temp_kubeconfig(dir.path(), "valid.yaml", SAMPLE_KUBECONFIG);

        let info = KubeConfig::validate_path(f.to_str().unwrap())
            .await
            .unwrap();
        assert!(info.valid);
        assert_eq!(info.file_count, 1);
        assert_eq!(info.context_count, 2);
        assert!(matches!(info.source_type, KubeconfigSourceType::File));
        assert!(!info.is_default);
    }

    #[tokio::test]
    async fn test_validate_path_valid_folder() {
        let dir = tempfile::tempdir().unwrap();
        write_temp_kubeconfig(dir.path(), "a.yaml", COMPLETE_FILE);
        write_temp_kubeconfig(dir.path(), "b.yaml", SAMPLE_KUBECONFIG);

        let info = KubeConfig::validate_path(dir.path().to_str().unwrap())
            .await
            .unwrap();
        assert!(info.valid);
        assert_eq!(info.file_count, 2);
        assert_eq!(info.context_count, 3); // 1 from complete + 2 from sample
        assert!(matches!(info.source_type, KubeconfigSourceType::Folder));
    }

    #[tokio::test]
    async fn test_validate_path_nonexistent() {
        let info = KubeConfig::validate_path("/nonexistent/path/kubeconfig")
            .await
            .unwrap();
        assert!(!info.valid);
        assert_eq!(info.file_count, 0);
        assert!(info.error.is_some());
    }

    #[tokio::test]
    async fn test_validate_path_invalid_yaml() {
        let dir = tempfile::tempdir().unwrap();
        // Valid YAML but missing required kubeconfig fields (no contexts)
        let f = write_temp_kubeconfig(dir.path(), "empty.yaml", "apiVersion: v1\nkind: Config\n");

        let info = KubeConfig::validate_path(f.to_str().unwrap())
            .await
            .unwrap();
        assert!(info.valid); // parses fine, just 0 contexts
        assert_eq!(info.context_count, 0);
    }
}
