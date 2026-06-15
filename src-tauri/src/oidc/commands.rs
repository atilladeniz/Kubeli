use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::State;
use tauri_plugin_opener::OpenerExt;

use super::config::OidcExecConfig;
use super::flow::{OidcFlowManager, RefreshError};
use super::store::{OidcTokenStore, OidcTokens};

pub struct OidcState {
    pub flow_manager: OidcFlowManager,
    pub token_store: OidcTokenStore,
    pub refresh_stop: std::sync::Mutex<Arc<AtomicBool>>,
    /// Serializes token refreshes so concurrent paths (interactive auth, connect,
    /// and the background refresh loop) cannot double-consume a rotating refresh
    /// token. See [`OidcState::refresh`].
    pub refresh_lock: tokio::sync::Mutex<()>,
    /// Full exec config (including TLS/CA settings) remembered from the kubeconfig
    /// at connect time, keyed by issuer+client. The interactive `oidc_start_auth`
    /// command only receives issuer/client/scopes from the frontend, so it looks
    /// the CA settings back up here rather than round-tripping them through the UI.
    pub configs: std::sync::Mutex<HashMap<String, OidcExecConfig>>,
}

impl OidcState {
    /// Signal any running refresh task to stop and install a fresh stop flag,
    /// atomically under a single lock. Returns the new flag for the task that is
    /// about to be spawned to observe. This closes the cancel-then-arm TOCTOU
    /// window that a separate cancel + read pair would leave open.
    pub fn arm_refresh(&self) -> Arc<AtomicBool> {
        let mut guard = self
            .refresh_stop
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        guard.store(true, Ordering::Relaxed);
        let fresh = Arc::new(AtomicBool::new(false));
        *guard = Arc::clone(&fresh);
        fresh
    }

    /// Signal any running refresh task to stop (used on disconnect).
    pub fn cancel_refresh(&self) {
        if let Ok(mut guard) = self.refresh_stop.lock() {
            guard.store(true, Ordering::Relaxed);
            *guard = Arc::new(AtomicBool::new(false));
        }
    }

    /// Remember the full exec config (TLS/CA settings included) detected from the
    /// kubeconfig at connect time, keyed by issuer+client.
    pub fn remember_config(&self, config: &OidcExecConfig) {
        let key = OidcTokenStore::cache_key(&config.issuer_url, &config.client_id);
        if let Ok(mut guard) = self.configs.lock() {
            guard.insert(key, config.clone());
        }
    }

    /// Recover the remembered config (with its CA/TLS settings) for an
    /// issuer+client. Falls back to a config built from the given parameters when
    /// nothing was remembered, so the interactive flow degrades to the public-CA
    /// behaviour rather than failing.
    pub fn config_for(
        &self,
        issuer_url: &str,
        client_id: &str,
        extra_scopes: Vec<String>,
    ) -> OidcExecConfig {
        let key = OidcTokenStore::cache_key(issuer_url, client_id);
        if let Ok(guard) = self.configs.lock() {
            if let Some(config) = guard.get(&key) {
                return config.clone();
            }
        }
        OidcExecConfig {
            issuer_url: issuer_url.to_string(),
            client_id: client_id.to_string(),
            extra_scopes,
            ..Default::default()
        }
    }

    /// Serialized, single-flight token refresh. Holds `refresh_lock` across the
    /// whole load -> exchange -> persist sequence so concurrent callers cannot
    /// double-consume a rotating refresh token, and re-checks the in-memory cache
    /// inside the lock so a caller that waited reuses the token another caller
    /// just obtained instead of issuing a second refresh.
    ///
    /// On a terminal failure (definitive `invalid_grant`) the stored refresh
    /// token is discarded — but only if it still equals the one this call used
    /// (compare-and-delete), so a stale-token failure never clobbers a token
    /// another path just rotated. Transient failures leave the token untouched.
    pub async fn refresh(&self, config: &OidcExecConfig) -> Result<String, RefreshError> {
        let _guard = self.refresh_lock.lock().await;

        if let Some(token) = self
            .token_store
            .get_valid_token(&config.issuer_url, &config.client_id)
        {
            return Ok(token);
        }

        let refresh_token =
            OidcTokenStore::load_refresh_token(&config.issuer_url, &config.client_id)
                .ok_or_else(|| RefreshError::Terminal("No stored refresh token".to_string()))?;

        match self
            .flow_manager
            .refresh_token(config, &refresh_token)
            .await
        {
            Ok(tokens) => {
                if let Some(ref new_rt) = tokens.refresh_token {
                    OidcTokenStore::save_refresh_token(
                        &config.issuer_url,
                        &config.client_id,
                        new_rt,
                    );
                }
                let id_token = tokens.id_token.clone();
                self.token_store
                    .store_tokens(&config.issuer_url, &config.client_id, tokens);
                Ok(id_token)
            }
            Err(RefreshError::Terminal(message)) => {
                self.token_store
                    .clear(&config.issuer_url, &config.client_id);
                OidcTokenStore::delete_refresh_token_if_matches(
                    &config.issuer_url,
                    &config.client_id,
                    &refresh_token,
                );
                Err(RefreshError::Terminal(message))
            }
            Err(transient) => Err(transient),
        }
    }
}

impl Default for OidcState {
    fn default() -> Self {
        Self {
            flow_manager: OidcFlowManager::default(),
            token_store: OidcTokenStore::default(),
            refresh_stop: std::sync::Mutex::new(Arc::new(AtomicBool::new(false))),
            refresh_lock: tokio::sync::Mutex::new(()),
            configs: std::sync::Mutex::new(HashMap::new()),
        }
    }
}

#[derive(serde::Serialize)]
pub struct OidcAuthResult {
    pub status: String,
    pub auth_url: Option<String>,
    pub token: Option<String>,
}

#[tauri::command]
pub async fn oidc_start_auth(
    app: tauri::AppHandle,
    oidc_state: State<'_, Arc<OidcState>>,
    issuer_url: String,
    client_id: String,
    extra_scopes: Vec<String>,
) -> Result<OidcAuthResult, String> {
    if let Some(token) = oidc_state
        .token_store
        .get_valid_token(&issuer_url, &client_id)
    {
        return Ok(OidcAuthResult {
            status: "authenticated".to_string(),
            auth_url: None,
            token: Some(token),
        });
    }

    // Recover the CA/TLS settings the frontend does not carry (remembered at
    // connect time), falling back to issuer/client/scopes only.
    let config = oidc_state.config_for(&issuer_url, &client_id, extra_scopes);

    // Try a cached/refreshed token before opening the browser. refresh()
    // serializes with the background refresh loop and only discards the stored
    // token on a definitive invalid_grant, so a transient failure here simply
    // falls through to interactive auth without destroying a good token.
    match oidc_state.refresh(&config).await {
        Ok(token) => {
            return Ok(OidcAuthResult {
                status: "authenticated".to_string(),
                auth_url: None,
                token: Some(token),
            });
        }
        Err(e) => {
            tracing::debug!("OIDC refresh before interactive auth failed: {}", e);
        }
    }

    let auth_url = oidc_state.flow_manager.start_auth(&config).await?;
    app.opener()
        .open_url(&auth_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    Ok(OidcAuthResult {
        status: "auth_pending".to_string(),
        auth_url: Some(auth_url),
        token: None,
    })
}

#[tauri::command]
pub async fn oidc_handle_callback(
    app: tauri::AppHandle,
    oidc_state: State<'_, Arc<OidcState>>,
    code: String,
    state: String,
) -> Result<OidcAuthResult, String> {
    let (issuer_url, client_id) = {
        let guard = oidc_state
            .flow_manager
            .pending
            .lock()
            .map_err(|_| "Failed to lock pending auth state".to_string())?;
        let pending = guard
            .as_ref()
            .ok_or_else(|| "No pending OIDC authentication flow".to_string())?;
        (
            pending.config.issuer_url.clone(),
            pending.config.client_id.clone(),
        )
    };

    let tokens = oidc_state.flow_manager.exchange_code(&code, &state).await?;
    persist_tokens(&app, &oidc_state, &issuer_url, &client_id, &tokens);

    Ok(OidcAuthResult {
        status: "authenticated".to_string(),
        auth_url: None,
        token: Some(tokens.id_token),
    })
}

#[tauri::command]
pub fn oidc_get_token_status(
    oidc_state: State<'_, Arc<OidcState>>,
    issuer_url: String,
    client_id: String,
) -> OidcAuthResult {
    match oidc_state
        .token_store
        .get_valid_token(&issuer_url, &client_id)
    {
        Some(token) => OidcAuthResult {
            status: "authenticated".to_string(),
            auth_url: None,
            token: Some(token),
        },
        None => OidcAuthResult {
            status: "unauthenticated".to_string(),
            auth_url: None,
            token: None,
        },
    }
}

fn persist_tokens(
    _app: &tauri::AppHandle,
    oidc_state: &OidcState,
    issuer: &str,
    client_id: &str,
    tokens: &OidcTokens,
) {
    oidc_state
        .token_store
        .store_tokens(issuer, client_id, tokens.clone());

    if let Some(ref refresh_token) = tokens.refresh_token {
        OidcTokenStore::save_refresh_token(issuer, client_id, refresh_token);
    }
}
