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

/// Information about a Kubernetes context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextInfo {
    pub name: String,
    pub cluster: String,
    pub user: String,
    pub namespace: Option<String>,
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

    #[test]
    fn test_parse_kubeconfig() {
        // nosemgrep: rust-no-unwrap
        let config = KubeConfig::parse(SAMPLE_KUBECONFIG, PathBuf::from("/test")).unwrap();

        assert_eq!(config.current_context, Some("minikube".to_string()));
        assert_eq!(config.contexts.len(), 2);
        assert_eq!(config.clusters.len(), 2);
        assert_eq!(config.users.len(), 2);
    }

    #[test]
    fn test_get_current_context() {
        // nosemgrep: rust-no-unwrap
        let config = KubeConfig::parse(SAMPLE_KUBECONFIG, PathBuf::from("/test")).unwrap();

        // nosemgrep: rust-no-unwrap
        let ctx = config.get_current_context().unwrap();
        assert_eq!(ctx.name, "minikube");
        assert_eq!(ctx.cluster, "minikube");
        assert_eq!(ctx.namespace, Some("default".to_string()));
    }

    #[test]
    fn test_auth_types() {
        // nosemgrep: rust-no-unwrap
        let config = KubeConfig::parse(SAMPLE_KUBECONFIG, PathBuf::from("/test")).unwrap();

        // nosemgrep: rust-no-unwrap
        let minikube_user = config.users.iter().find(|u| u.name == "minikube").unwrap();
        assert!(matches!(
            minikube_user.auth_type,
            AuthType::ClientCertificate
        ));

        // nosemgrep: rust-no-unwrap
        let admin_user = config.users.iter().find(|u| u.name == "admin").unwrap();
        assert!(matches!(admin_user.auth_type, AuthType::Token));
    }
}
