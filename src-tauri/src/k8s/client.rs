#![allow(dead_code)] // Some methods may be used in future features (e.g., Resource Detail Views, Settings)

use anyhow::{Context, Result};
use chrono::Utc;
use dirs::home_dir;
use k8s_openapi::api::core::v1::Namespace;
use kube::{
    api::ListParams,
    config::{KubeConfigOptions, Kubeconfig},
    Api, Client, Config,
};
use std::env;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;

use super::config::KubeConfig as ParsedKubeConfig;

/// Thread-safe Kubernetes client manager
pub struct KubeClientManager {
    client: Arc<RwLock<Option<Client>>>,
    current_context: Arc<RwLock<Option<String>>>,
    kubeconfig: Arc<RwLock<Option<ParsedKubeConfig>>>,
    connection_log: Arc<RwLock<Option<String>>>,
}

#[allow(dead_code)] // Some methods may be used in future features (e.g., Resource Detail Views, Settings)
impl KubeClientManager {
    fn kubeconfig_path_hint() -> Option<String> {
        if let Ok(path) = env::var("KUBECONFIG") {
            if !path.is_empty() {
                return Some(path);
            }
        }

        home_dir()
            .map(|dir| dir.join(".kube").join("config"))
            .map(|path| path.display().to_string())
    }

    async fn persist_connection_log(
        &self,
        context_name: &str,
        mut steps: Vec<String>,
        error: Option<String>,
        duration_ms: Option<u128>,
    ) {
        if let Some(duration) = duration_ms {
            steps.push(format!("Total time: {}ms", duration));
        }

        let mut log = String::new();
        log.push_str("=== Kubeli Connection Debug Log ===\n");
        log.push_str(&format!("Timestamp: {}\n", Utc::now().to_rfc3339()));
        log.push_str(&format!("Context: {}\n", context_name));
        log.push_str(&format!("App Version: {}\n", env!("CARGO_PKG_VERSION")));
        log.push_str(&format!(
            "Platform: {} ({})\n",
            std::env::consts::OS,
            std::env::consts::ARCH
        ));

        if let Some(path) = Self::kubeconfig_path_hint() {
            log.push_str(&format!("Kubeconfig Path: {}\n", path));
        } else {
            log.push_str("Kubeconfig Path: <unknown>\n");
        }

        log.push_str("\nSteps:\n");
        for step in steps {
            log.push_str(" - ");
            log.push_str(&step);
            log.push('\n');
        }

        match error {
            Some(err) => {
                log.push_str("\nResult: FAILED\n");
                log.push_str(&format!("Error: {}\n", err));
            }
            None => {
                log.push_str("\nResult: SUCCESS\n");
            }
        }

        *self.connection_log.write().await = Some(log);
    }

    pub async fn get_last_connection_log(&self) -> Option<String> {
        self.connection_log.read().await.clone()
    }

    pub fn new() -> Self {
        Self {
            client: Arc::new(RwLock::new(None)),
            current_context: Arc::new(RwLock::new(None)),
            kubeconfig: Arc::new(RwLock::new(None)),
            connection_log: Arc::new(RwLock::new(None)),
        }
    }

    /// Initialize the client from the default kubeconfig
    #[allow(dead_code)] // May be used in future features (e.g., Resource Detail Views)
    pub async fn init(&self) -> Result<()> {
        let parsed_config = ParsedKubeConfig::load().await?;
        let current_ctx = parsed_config.current_context.clone();

        // Create kube-rs client
        let config = Config::infer()
            .await
            .context("Failed to infer Kubernetes configuration")?;
        let client = Client::try_from(config).context("Failed to create Kubernetes client")?;

        // Store everything
        *self.kubeconfig.write().await = Some(parsed_config);
        *self.client.write().await = Some(client);
        *self.current_context.write().await = current_ctx;

        Ok(())
    }

    /// Initialize from a specific context
    pub async fn init_with_context(&self, context_name: &str) -> Result<()> {
        tracing::info!("Attempting to connect to context: {}", context_name);
        let attempt_start = Instant::now();
        let mut steps = vec![format!(
            "Starting connection attempt for '{}'",
            context_name
        )];

        let kubeconfig = match Kubeconfig::read() {
            Ok(cfg) => {
                steps.push("Kubeconfig file loaded".into());
                cfg
            }
            Err(e) => {
                let err_msg = format!("Failed to read kubeconfig file: {}", e);
                tracing::error!("{}", err_msg);
                steps.push(err_msg.clone());
                self.persist_connection_log(
                    context_name,
                    steps,
                    Some(err_msg.clone()),
                    Some(attempt_start.elapsed().as_millis()),
                )
                .await;
                return Err(anyhow::anyhow!(err_msg));
            }
        };

        let context_entry = match kubeconfig.contexts.iter().find(|c| c.name == context_name) {
            Some(ctx) => ctx,
            None => {
                let err_msg = format!("Context '{}' not found in kubeconfig", context_name);
                tracing::error!("{}", err_msg);
                steps.push(err_msg.clone());
                self.persist_connection_log(
                    context_name,
                    steps,
                    Some(err_msg.clone()),
                    Some(attempt_start.elapsed().as_millis()),
                )
                .await;
                return Err(anyhow::anyhow!(err_msg));
            }
        };

        let mut uses_exec_auth = false;
        if let Some(ctx_details) = context_entry.context.as_ref() {
            steps.push(format!("Cluster reference: {}", ctx_details.cluster));

            if let Some(ns) = ctx_details.namespace.as_ref() {
                steps.push(format!("Default namespace: {}", ns));
            }

            if let Some(user_name) = ctx_details.user.as_ref() {
                steps.push(format!("Auth user: {}", user_name));
                if let Some(user) = kubeconfig.auth_infos.iter().find(|u| u.name == *user_name) {
                    if user
                        .auth_info
                        .as_ref()
                        .and_then(|a| a.exec.as_ref())
                        .is_some()
                    {
                        uses_exec_auth = true;
                        steps.push(
                            "Detected exec-based authentication (e.g., Azure CLI + kubelogin)"
                                .into(),
                        );
                    } else if user
                        .auth_info
                        .as_ref()
                        .and_then(|a| a.client_certificate_data.as_ref())
                        .is_some()
                    {
                        steps.push("Detected client certificate authentication".into());
                    } else if user
                        .auth_info
                        .as_ref()
                        .and_then(|a| a.token.as_ref())
                        .is_some()
                    {
                        steps.push("Detected token-based authentication".into());
                    }
                }
            }
        }

        steps.push("Creating kube-rs config from kubeconfig context".into());
        let config = match Config::from_custom_kubeconfig(
            kubeconfig.clone(),
            &KubeConfigOptions {
                context: Some(context_name.to_string()),
                cluster: None,
                user: None,
            },
        )
        .await
        {
            Ok(config) => {
                steps.push("kube-rs config created successfully".into());
                config
            }
            Err(e) => {
                tracing::error!("Failed to create config from kubeconfig: {}", e);
                let err_msg = format!("Failed to create config: {}. Check if authentication is valid (e.g., run 'az login' for Azure clusters)", e);
                steps.push(format!("Config creation failed: {}", e));
                if uses_exec_auth {
                    steps.push(
                        "Hint: exec auth requires Azure CLI login and active PIM role".into(),
                    );
                }
                self.persist_connection_log(
                    context_name,
                    steps,
                    Some(err_msg.clone()),
                    Some(attempt_start.elapsed().as_millis()),
                )
                .await;
                return Err(anyhow::anyhow!(err_msg));
            }
        };

        tracing::debug!(
            "Config created for context {}, attempting to create Kubernetes client",
            context_name
        );

        let client = match Client::try_from(config) {
            Ok(client) => {
                steps.push("Kubernetes client created successfully".into());
                client
            }
            Err(e) => {
                tracing::error!("Failed to create Kubernetes client: {}", e);
                let err_msg = format!("Failed to create Kubernetes client: {}", e);
                steps.push(err_msg.clone());
                self.persist_connection_log(
                    context_name,
                    steps,
                    Some(err_msg.clone()),
                    Some(attempt_start.elapsed().as_millis()),
                )
                .await;
                return Err(anyhow::anyhow!(err_msg));
            }
        };

        let parsed_config = match ParsedKubeConfig::load().await {
            Ok(cfg) => {
                steps.push("Parsed kubeconfig cache loaded".into());
                cfg
            }
            Err(e) => {
                let err_msg = format!("Failed to load parsed kubeconfig: {}", e);
                tracing::error!("{}", err_msg);
                steps.push(err_msg.clone());
                self.persist_connection_log(
                    context_name,
                    steps,
                    Some(err_msg.clone()),
                    Some(attempt_start.elapsed().as_millis()),
                )
                .await;
                return Err(e);
            }
        };

        *self.kubeconfig.write().await = Some(parsed_config);
        *self.client.write().await = Some(client);
        *self.current_context.write().await = Some(context_name.to_string());

        steps.push("Client stored in manager and ready for use".into());

        self.persist_connection_log(
            context_name,
            steps,
            None,
            Some(attempt_start.elapsed().as_millis()),
        )
        .await;

        tracing::info!(
            "Successfully initialized client for context: {}",
            context_name
        );
        Ok(())
    }

    /// Switch to a different context
    #[allow(dead_code)] // May be used in future features (e.g., Resource Detail Views)
    pub async fn switch_context(&self, context_name: &str) -> Result<()> {
        self.init_with_context(context_name).await
    }

    /// Get the current client
    pub async fn get_client(&self) -> Result<Client> {
        self.client
            .read()
            .await
            .clone()
            .ok_or_else(|| anyhow::anyhow!("Kubernetes client not initialized"))
    }

    /// Get the current context name
    pub async fn get_current_context(&self) -> Option<String> {
        self.current_context.read().await.clone()
    }

    /// Get the parsed kubeconfig
    #[allow(dead_code)] // May be used in future features (e.g., Resource Detail Views, Settings)
    pub async fn get_kubeconfig(&self) -> Option<ParsedKubeConfig> {
        self.kubeconfig.read().await.clone()
    }

    /// Check if client is connected
    pub async fn is_connected(&self) -> bool {
        self.client.read().await.is_some()
    }

    /// Test connection to cluster
    pub async fn test_connection(&self) -> Result<bool> {
        let client = self.get_client().await?;
        let namespaces: Api<Namespace> = Api::all(client);

        // Try to list namespaces as a connection test
        match namespaces.list(&ListParams::default().limit(1)).await {
            Ok(_) => Ok(true),
            Err(e) => {
                tracing::warn!("Connection test failed: {}", e);
                Ok(false)
            }
        }
    }

    /// List all namespaces
    pub async fn list_namespaces(&self) -> Result<Vec<String>> {
        let client = self.get_client().await?;
        let namespaces: Api<Namespace> = Api::all(client);

        let list = namespaces
            .list(&ListParams::default())
            .await
            .context("Failed to list namespaces")?;

        Ok(list
            .items
            .into_iter()
            .filter_map(|ns| ns.metadata.name)
            .collect())
    }
}

impl Default for KubeClientManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Global client manager state
pub struct AppState {
    pub k8s: KubeClientManager,
}

impl std::fmt::Debug for AppState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AppState")
            .field("k8s", &"KubeClientManager")
            .finish()
    }
}

impl AppState {
    pub fn new() -> Self {
        Self {
            k8s: KubeClientManager::new(),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
