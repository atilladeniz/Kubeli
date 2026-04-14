use std::sync::Arc;
use tauri::State;
use tauri_plugin_opener::OpenerExt;

use super::config::OidcExecConfig;
use super::flow::OidcFlowManager;
use super::store::{OidcTokenStore, OidcTokens};

pub struct OidcState {
    pub flow_manager: OidcFlowManager,
    pub token_store: OidcTokenStore,
}

impl Default for OidcState {
    fn default() -> Self {
        Self {
            flow_manager: OidcFlowManager::default(),
            token_store: OidcTokenStore::default(),
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

    let config = OidcExecConfig {
        issuer_url: issuer_url.clone(),
        client_id: client_id.clone(),
        extra_scopes,
    };

    if let Some(refresh_token) = load_refresh_token(&app, &issuer_url, &client_id) {
        if let Ok(tokens) = oidc_state
            .flow_manager
            .refresh_token(&config, &refresh_token)
            .await
        {
            persist_tokens(&app, &oidc_state, &issuer_url, &client_id, &tokens);
            return Ok(OidcAuthResult {
                status: "authenticated".to_string(),
                auth_url: None,
                token: Some(tokens.id_token),
            });
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

fn load_refresh_token(_app: &tauri::AppHandle, issuer: &str, client_id: &str) -> Option<String> {
    OidcTokenStore::load_refresh_token(issuer, client_id)
}
