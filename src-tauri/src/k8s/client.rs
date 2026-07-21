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
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

use super::config::KubeConfig as ParsedKubeConfig;

/// Apply timeout policy for the shared Kubernetes client.
///
/// `read_timeout` and `write_timeout` are intentionally left unset: in
/// `kube-client` they are forwarded to `hyper-timeout`, which applies them
/// per read/write on the underlying I/O. Any non-zero value tears down
/// otherwise-healthy long-lived streams (`pods.log_stream`, `pods.exec`)
/// the moment the peer goes idle for that long. See issue #292.
///
/// Per-request deadlines for non-streaming calls are layered on top with
/// `tokio::time::timeout` (see `test_connection`).
pub(crate) fn apply_shared_client_timeouts(config: &mut Config) {
    config.connect_timeout = Some(Duration::from_secs(10));
    config.read_timeout = None;
    config.write_timeout = None;
}

/// The live connection: a client and the context it was built for, stored as
/// one value under one lock. A reader can never observe a client paired with
/// another connection's context - the mismatch is unrepresentable, not merely
/// unlikely (a previous two-lock design left a window where a connect could
/// publish its context while an in-flight reader still held the old client).
/// The context is `None` only on the default-kubeconfig path (`init`), where
/// the file may name no current-context.
pub type SharedConnection = Arc<RwLock<Option<(Client, Option<String>)>>>;

/// Thread-safe Kubernetes client manager
pub struct KubeClientManager {
    connection: SharedConnection,
    kubeconfig: Arc<RwLock<Option<ParsedKubeConfig>>>,
    connection_log: Arc<RwLock<Option<String>>>,
    /// Serializes connect attempts: two racing connect_cluster calls would
    /// otherwise interleave init/test and leave client+context mismatched.
    connect_lock: Arc<tokio::sync::Mutex<()>>,
}

#[allow(dead_code)] // Some methods may be used in future features (e.g., Resource Detail Views, Settings)
impl KubeClientManager {
    fn kubeconfig_path_hint(source_file: Option<&str>) -> Option<String> {
        if let Some(source) = source_file {
            return Some(source.to_string());
        }

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
        source_file: Option<&str>,
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

        if let Some(path) = Self::kubeconfig_path_hint(source_file) {
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

    pub fn connection_handle(&self) -> SharedConnection {
        Arc::clone(&self.connection)
    }

    pub fn new() -> Self {
        Self {
            connection: Arc::new(RwLock::new(None)),
            kubeconfig: Arc::new(RwLock::new(None)),
            connection_log: Arc::new(RwLock::new(None)),
            connect_lock: Arc::new(tokio::sync::Mutex::new(())),
        }
    }

    /// Take the connect lock for the duration of a connect attempt. Owned
    /// guard so the caller can hold it across the whole command.
    pub async fn begin_connect(&self) -> tokio::sync::OwnedMutexGuard<()> {
        Arc::clone(&self.connect_lock).lock_owned().await
    }

    /// Drop the active connection. Called when a connect attempt fails so
    /// the stored client/context never point at a cluster that did not pass
    /// the connection test (the UI treats a failed connect as disconnected).
    pub async fn clear_connection(&self) {
        *self.connection.write().await = None;
    }

    /// Initialize the client from the default kubeconfig.
    ///
    /// Used by the MCP server (`mcp::server::McpServerState::connect_to_cluster`)
    /// where there is no UI to pick a specific context.
    pub async fn init(&self) -> Result<()> {
        // Honor KUBECONFIG like `Config::infer()` below does: a setup where
        // only the env var points at kubeconfigs has no ~/.kube/config, so
        // loading just the default path would fail the whole init.
        let parsed_config = match env::var("KUBECONFIG") {
            Ok(env_val) if !env_val.is_empty() => {
                let files: Vec<std::path::PathBuf> = env::split_paths(&env_val).collect();
                ParsedKubeConfig::load_and_merge(&files, true).await?
            }
            _ => ParsedKubeConfig::load().await?,
        };
        let current_ctx = parsed_config.current_context.clone();

        let mut config = Config::infer()
            .await
            .context("Failed to infer Kubernetes configuration")?;
        apply_shared_client_timeouts(&mut config);
        let client = Client::try_from(config).context("Failed to create Kubernetes client")?;

        *self.kubeconfig.write().await = Some(parsed_config);
        *self.connection.write().await = Some((client, current_ctx));

        Ok(())
    }

    /// Initialize from a specific context using a pre-loaded kubeconfig
    pub async fn init_with_context(
        &self,
        context_name: &str,
        kubeconfig: Kubeconfig,
        source_file: Option<&str>,
    ) -> Result<()> {
        tracing::info!("Attempting to connect to context: {}", context_name);
        let attempt_start = Instant::now();
        let mut steps = vec![format!(
            "Starting connection attempt for '{}'",
            context_name
        )];

        steps.push("Kubeconfig loaded from configured sources".into());

        let context_entry = match kubeconfig.contexts.iter().find(|c| c.name == context_name) {
            Some(ctx) => ctx,
            None => {
                let err_msg = format!("Context '{}' not found in kubeconfig", context_name);
                tracing::error!("{}", err_msg);
                steps.push(err_msg.clone());
                self.persist_connection_log(
                    context_name,
                    source_file,
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
            kubeconfig,
            &KubeConfigOptions {
                context: Some(context_name.to_string()),
                cluster: None,
                user: None,
            },
        )
        .await
        {
            Ok(mut config) => {
                apply_shared_client_timeouts(&mut config);
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
                    source_file,
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
                    source_file,
                    steps,
                    Some(err_msg.clone()),
                    Some(attempt_start.elapsed().as_millis()),
                )
                .await;
                return Err(anyhow::anyhow!(err_msg));
            }
        };

        *self.connection.write().await = Some((client, Some(context_name.to_string())));

        steps.push("Client stored in manager and ready for use".into());

        self.persist_connection_log(
            context_name,
            source_file,
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
    pub async fn switch_context(
        &self,
        context_name: &str,
        kubeconfig: Kubeconfig,
        source_file: Option<&str>,
    ) -> Result<()> {
        self.init_with_context(context_name, kubeconfig, source_file)
            .await
    }

    /// Get the current client
    pub async fn get_client(&self) -> Result<Client> {
        self.connection
            .read()
            .await
            .as_ref()
            .map(|(client, _)| client.clone())
            .ok_or_else(|| anyhow::anyhow!("Kubernetes client not initialized"))
    }

    /// Get the current context name
    pub async fn get_current_context(&self) -> Option<String> {
        self.connection
            .read()
            .await
            .as_ref()
            .and_then(|(_, context)| context.clone())
    }

    /// Get the client and the context it belongs to as one snapshot.
    ///
    /// The pair lives in one lock slot (see `SharedConnection`), so a client
    /// tagged with another cluster's context is unrepresentable - a port
    /// forward started from this snapshot tunnels to the cluster it is
    /// recorded as owned by, and every cluster_context filter stays truthful.
    pub async fn get_connection(&self) -> Result<(Client, String)> {
        let guard = self.connection.read().await;
        let (client, context) = guard
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Kubernetes client not initialized"))?;
        let context = context
            .clone()
            .ok_or_else(|| anyhow::anyhow!("No cluster context is connected"))?;
        Ok((client.clone(), context))
    }

    /// Get the parsed kubeconfig
    #[allow(dead_code)] // May be used in future features (e.g., Resource Detail Views, Settings)
    pub async fn get_kubeconfig(&self) -> Option<ParsedKubeConfig> {
        self.kubeconfig.read().await.clone()
    }

    /// Check if client is connected
    pub async fn is_connected(&self) -> bool {
        self.connection.read().await.is_some()
    }

    /// Test connection to cluster using the /version endpoint.
    /// This works even on RBAC-restricted clusters where namespace listing is forbidden,
    /// because GET /version is accessible to all users via the system:public-info-viewer ClusterRole.
    pub async fn test_connection(&self) -> Result<bool> {
        let client = self.get_client().await?;

        // Tight timeout for connection test — user shouldn't wait long
        match tokio::time::timeout(Duration::from_secs(10), client.apiserver_version()).await {
            Ok(Ok(_)) => Ok(true),
            Ok(Err(kube::Error::Api(ref status))) if status.code == 403 => {
                // Unusual for /version, but server IS reachable
                tracing::info!("Connection test: /version returned 403, but server is reachable");
                Ok(true)
            }
            Ok(Err(e)) => {
                tracing::warn!("Connection test failed: {}", e);
                Ok(false)
            }
            Err(_) => {
                tracing::warn!("Connection test timed out after 10s");
                Ok(false)
            }
        }
    }

    /// List all namespaces (metadata only - names are all we need) with a
    /// hard timeout so a hanging API server cannot stall the caller.
    pub async fn list_namespaces(&self) -> Result<Vec<String>> {
        let client = self.get_client().await?;
        let namespaces: Api<Namespace> = Api::all(client);

        // Page through results (500/page) so huge clusters neither truncate
        // nor produce one giant response.
        let mut names = Vec::new();
        let mut continue_token: Option<String> = None;
        loop {
            let mut params = ListParams::default().limit(500).timeout(10);
            if let Some(token) = &continue_token {
                params = params.continue_token(token);
            }
            let list =
                tokio::time::timeout(Duration::from_secs(15), namespaces.list_metadata(&params))
                    .await
                    .context("Timed out listing namespaces")?
                    .context("Failed to list namespaces")?;

            continue_token = list.metadata.continue_.clone().filter(|t| !t.is_empty());
            names.extend(list.items.into_iter().filter_map(|ns| ns.metadata.name));
            if continue_token.is_none() {
                break;
            }
        }
        Ok(names)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_path_hint_prefers_source_file() {
        let hint = KubeClientManager::kubeconfig_path_hint(Some("/custom/path/cluster.yaml"));
        assert_eq!(hint, Some("/custom/path/cluster.yaml".to_string()));
    }

    #[test]
    fn test_path_hint_falls_back_without_source() {
        let hint = KubeClientManager::kubeconfig_path_hint(None);
        // Should return something (KUBECONFIG env or ~/.kube/config)
        assert!(hint.is_some(), "must return a default path");
    }

    /// Regression test for issue #292: log streams and exec sessions were
    /// being killed after ~30s of inactivity because `read_timeout` was set
    /// on the shared client and `hyper-timeout` applies it per-read.
    #[test]
    fn shared_client_has_no_read_timeout() {
        let mut config = Config::new("https://example.com".parse().unwrap());
        apply_shared_client_timeouts(&mut config);

        assert_eq!(
            config.connect_timeout,
            Some(Duration::from_secs(10)),
            "connect_timeout should stay tight for fast feedback on bad clusters"
        );
        assert!(
            config.read_timeout.is_none(),
            "read_timeout must be unset so idle log/exec streams are not torn down (issue #292)"
        );
        assert!(
            config.write_timeout.is_none(),
            "write_timeout must be unset so idle exec sessions are not torn down (issue #292)"
        );
    }

    fn test_kubeconfig(server: &str) -> Kubeconfig {
        let yaml = format!(
            r#"
apiVersion: v1
kind: Config
current-context: test-ctx
contexts:
  - name: test-ctx
    context:
      cluster: test-cluster
      user: test-user
clusters:
  - name: test-cluster
    cluster:
      server: {server}
users:
  - name: test-user
    user:
      token: dummy-token
"#
        );
        serde_yaml::from_str(&yaml).expect("valid test kubeconfig")
    }

    #[tokio::test]
    async fn init_with_unknown_context_fails_and_leaves_state_untouched() {
        let manager = KubeClientManager::new();
        let result = manager
            .init_with_context(
                "does-not-exist",
                test_kubeconfig("https://127.0.0.1:1"),
                None,
            )
            .await;
        assert!(result.is_err());
        assert!(!manager.is_connected().await);
        assert!(manager.get_current_context().await.is_none());
    }

    #[tokio::test]
    async fn failed_connection_test_can_be_cleared() {
        // Client creation needs a rustls provider (installed at app startup)
        let _ = rustls::crypto::ring::default_provider().install_default();
        let manager = KubeClientManager::new();
        // init succeeds (no I/O yet) even though nothing listens on port 1
        manager
            .init_with_context("test-ctx", test_kubeconfig("https://127.0.0.1:1"), None)
            .await
            .expect("client creation is offline");
        assert!(manager.is_connected().await);

        // the connection test must fail fast against a closed port
        let ok = manager.test_connection().await.unwrap_or(false);
        assert!(!ok, "closed port must not pass the connection test");

        // connect_cluster clears on failure - state no longer claims a
        // connection that never passed its test
        manager.clear_connection().await;
        assert!(!manager.is_connected().await);
        assert!(manager.get_current_context().await.is_none());
    }

    #[tokio::test]
    async fn connect_lock_serializes_concurrent_attempts() {
        let manager = Arc::new(KubeClientManager::new());
        let guard = manager.begin_connect().await;
        let m2 = Arc::clone(&manager);
        let second = tokio::spawn(async move {
            let _g = m2.begin_connect().await;
        });
        // second attempt must be blocked while the first guard is held
        tokio::time::sleep(Duration::from_millis(50)).await;
        assert!(!second.is_finished());
        drop(guard);
        tokio::time::timeout(Duration::from_secs(1), second)
            .await
            .expect("second connect proceeds after the first releases the lock")
            .unwrap();
    }

    fn test_kubeconfig_two_contexts() -> Kubeconfig {
        // Each context pins a different default namespace, which the built
        // client carries - so a client paired with the wrong context is
        // detectable through Client::default_namespace().
        let yaml = r#"
apiVersion: v1
kind: Config
current-context: ctx-a
contexts:
  - name: ctx-a
    context:
      cluster: test-cluster
      user: test-user
      namespace: ns-a
  - name: ctx-b
    context:
      cluster: test-cluster
      user: test-user
      namespace: ns-b
clusters:
  - name: test-cluster
    cluster:
      server: https://127.0.0.1:1
users:
  - name: test-user
    user:
      token: dummy-token
"#;
        serde_yaml::from_str(yaml).expect("valid test kubeconfig")
    }

    // Regression: client and context used to live in two separate locks. A
    // connect could publish its context while an in-flight reader still held
    // the old client, handing out cluster A's client tagged as cluster B - a
    // port forward would tunnel to A while being recorded as owned by B. The
    // pair now lives in one lock slot; this test races real connects against
    // readers and asserts every observed snapshot is self-consistent.
    #[tokio::test]
    async fn get_connection_never_pairs_client_with_a_foreign_context() {
        let _ = rustls::crypto::ring::default_provider().install_default();
        let manager = Arc::new(KubeClientManager::new());

        // Nothing connected: no pair to hand out.
        assert!(manager.get_connection().await.is_err());

        let kubeconfig = test_kubeconfig_two_contexts();
        manager
            .init_with_context("ctx-a", kubeconfig.clone(), None)
            .await
            .expect("client creation is offline");

        let writer = {
            let manager = Arc::clone(&manager);
            let kubeconfig = kubeconfig.clone();
            tokio::spawn(async move {
                for i in 0..50 {
                    let ctx = if i % 2 == 0 { "ctx-b" } else { "ctx-a" };
                    manager
                        .init_with_context(ctx, kubeconfig.clone(), None)
                        .await
                        .expect("client creation is offline");
                }
            })
        };

        for _ in 0..200 {
            let (client, context) = manager
                .get_connection()
                .await
                .expect("stays connected throughout");
            let expected_ns = match context.as_str() {
                "ctx-a" => "ns-a",
                "ctx-b" => "ns-b",
                other => panic!("unknown context {other}"),
            };
            assert_eq!(
                client.default_namespace(),
                expected_ns,
                "client from one cluster was paired with another cluster's context"
            );
            tokio::task::yield_now().await;
        }
        writer.await.unwrap();

        // And clearing leaves nothing behind.
        manager.clear_connection().await;
        assert!(manager.get_connection().await.is_err());
        assert!(manager.get_current_context().await.is_none());
    }
}
