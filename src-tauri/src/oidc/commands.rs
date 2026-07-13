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
        let mut guard = self
            .refresh_stop
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        guard.store(true, Ordering::Relaxed);
        *guard = Arc::new(AtomicBool::new(false));
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

        // Keyring access is blocking OS IPC; keep it off the async runtime
        // (same pattern as SessionStore::with_conn).
        let refresh_token = {
            let issuer = config.issuer_url.clone();
            let client_id = config.client_id.clone();
            tauri::async_runtime::spawn_blocking(move || {
                OidcTokenStore::load_refresh_token(&issuer, &client_id)
            })
            .await
            .map_err(|e| RefreshError::Transient(format!("Keyring task failed: {e}")))?
            .ok_or_else(|| RefreshError::Terminal("No stored refresh token".to_string()))?
        };

        match self
            .flow_manager
            .refresh_token(config, &refresh_token)
            .await
        {
            Ok(tokens) => {
                if let Some(ref new_rt) = tokens.refresh_token {
                    let issuer = config.issuer_url.clone();
                    let client_id = config.client_id.clone();
                    let new_rt = new_rt.clone();
                    let _ = tauri::async_runtime::spawn_blocking(move || {
                        OidcTokenStore::save_refresh_token(&issuer, &client_id, &new_rt);
                    })
                    .await;
                }
                let id_token = tokens.id_token.clone();
                self.token_store
                    .store_tokens(&config.issuer_url, &config.client_id, tokens);
                Ok(id_token)
            }
            Err(RefreshError::Terminal(message)) => {
                self.token_store
                    .clear(&config.issuer_url, &config.client_id);
                let issuer = config.issuer_url.clone();
                let client_id = config.client_id.clone();
                let _ = tauri::async_runtime::spawn_blocking(move || {
                    OidcTokenStore::delete_refresh_token_if_matches(
                        &issuer,
                        &client_id,
                        &refresh_token,
                    );
                })
                .await;
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
    // exchange_code consumes the pending flow and hands back the config it was
    // started with, so we don't have to read it out of the pending state first.
    let (tokens, config) = oidc_state.flow_manager.exchange_code(&code, &state).await?;
    persist_tokens(
        &app,
        &oidc_state,
        &config.issuer_url,
        &config.client_id,
        &tokens,
    )
    .await;

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

async fn persist_tokens(
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
        // Keyring access is blocking OS IPC; keep it off the async runtime.
        let issuer = issuer.to_string();
        let client_id = client_id.to_string();
        let refresh_token = refresh_token.clone();
        let _ = tauri::async_runtime::spawn_blocking(move || {
            OidcTokenStore::save_refresh_token(&issuer, &client_id, &refresh_token);
        })
        .await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancel_refresh_recovers_from_poisoned_mutex() {
        let state = OidcState::default();
        let flag = state.arm_refresh();

        // Poison refresh_stop by panicking while holding the lock.
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _guard = state.refresh_stop.lock().unwrap();
            panic!("poison the refresh_stop mutex");
        }));
        assert!(
            state.refresh_stop.lock().is_err(),
            "mutex should be poisoned"
        );

        // Regression: cancel_refresh used `if let Ok(...)`, silently doing
        // nothing on poison — the running refresh task was never signalled.
        state.cancel_refresh();
        assert!(flag.load(Ordering::Relaxed), "stop flag must be signalled");
    }
}
