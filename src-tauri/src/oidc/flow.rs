use std::sync::Mutex;

use base64::engine::general_purpose::{URL_SAFE, URL_SAFE_NO_PAD};
use base64::Engine;
use chrono::{DateTime, Utc};
use openidconnect::core::{
    CoreAuthenticationFlow, CoreClient, CoreIdToken, CoreProviderMetadata, CoreTokenResponse,
};
use openidconnect::reqwest;
use openidconnect::{
    AuthorizationCode, ClientId, CsrfToken, IssuerUrl, Nonce, OAuth2TokenResponse,
    PkceCodeChallenge, PkceCodeVerifier, RedirectUrl, RefreshToken, Scope,
};

use super::config::OidcExecConfig;
use super::store::OidcTokens;

/// Classification of a refresh failure so callers can react correctly:
/// a `Terminal` error means the refresh token is dead and must be discarded,
/// while a `Transient` error (network, IdP 5xx, discovery) should be retried
/// WITHOUT discarding the still-valid refresh token.
#[derive(Debug)]
pub enum RefreshError {
    Terminal(String),
    Transient(String),
}

impl std::fmt::Display for RefreshError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RefreshError::Terminal(m) | RefreshError::Transient(m) => write!(f, "{}", m),
        }
    }
}

#[derive(Debug)]
pub struct PendingAuth {
    pub pkce_verifier: PkceCodeVerifier,
    pub csrf_state: String,
    pub nonce: Nonce,
    pub config: OidcExecConfig,
}

#[derive(Debug)]
pub struct OidcFlowManager {
    pub pending: Mutex<Option<PendingAuth>>,
}

impl OidcFlowManager {
    pub async fn start_auth(&self, config: &OidcExecConfig) -> Result<String, String> {
        let provider_metadata = discover_provider(&config.issuer_url).await?;
        let redirect_uri = RedirectUrl::new("kubeli://oidc/callback".to_string())
            .map_err(|e| format!("Invalid OIDC redirect URL: {}", e))?;
        let client = CoreClient::from_provider_metadata(
            provider_metadata,
            ClientId::new(config.client_id.clone()),
            None,
        )
        .set_redirect_uri(redirect_uri);

        let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();
        let mut auth_request = client
            .authorize_url(
                CoreAuthenticationFlow::AuthorizationCode,
                CsrfToken::new_random,
                Nonce::new_random,
            )
            .set_pkce_challenge(pkce_challenge)
            .add_scope(Scope::new("openid".to_string()));

        for scope in &config.extra_scopes {
            auth_request = auth_request.add_scope(Scope::new(scope.clone()));
        }

        let (auth_url, csrf_state, nonce): (url::Url, CsrfToken, Nonce) = auth_request.url();

        let pending_auth = PendingAuth {
            pkce_verifier,
            csrf_state: csrf_state.secret().to_string(),
            nonce,
            config: config.clone(),
        };

        let mut pending_guard = self
            .pending
            .lock()
            .map_err(|_| "Failed to lock pending auth state".to_string())?;
        *pending_guard = Some(pending_auth);

        Ok(auth_url.to_string())
    }

    pub async fn exchange_code(&self, code: &str, state: &str) -> Result<OidcTokens, String> {
        let pending_auth = {
            let mut pending_guard = self
                .pending
                .lock()
                .map_err(|_| "Failed to lock pending auth state".to_string())?;
            pending_guard
                .take()
                .ok_or_else(|| "No pending OIDC authentication flow".to_string())?
        };

        if pending_auth.csrf_state != state {
            let mut pending_guard = self
                .pending
                .lock()
                .map_err(|_| "Failed to lock pending auth state".to_string())?;
            *pending_guard = Some(pending_auth);
            return Err("Invalid OIDC state parameter".to_string());
        }

        let provider_metadata = discover_provider(&pending_auth.config.issuer_url).await?;
        let redirect_uri = RedirectUrl::new("kubeli://oidc/callback".to_string())
            .map_err(|e| format!("Invalid OIDC redirect URL: {}", e))?;
        let client = CoreClient::from_provider_metadata(
            provider_metadata,
            ClientId::new(pending_auth.config.client_id.clone()),
            None,
        )
        .set_redirect_uri(redirect_uri);

        let code_token_request = client
            .exchange_code(AuthorizationCode::new(code.to_string()))
            .map_err(|e| format!("Failed to create OIDC code exchange request: {}", e))?;

        let http_client = build_http_client()?;
        let token_response: CoreTokenResponse = code_token_request
            .set_pkce_verifier(pending_auth.pkce_verifier)
            .request_async(&http_client)
            .await
            .map_err(|e| format!("Failed to exchange OIDC authorization code: {}", e))?;

        let id_token_obj: &CoreIdToken = token_response
            .extra_fields()
            .id_token()
            .ok_or_else(|| "OIDC provider did not return an id_token".to_string())?;

        let id_token_verifier = client.id_token_verifier();
        id_token_obj
            .claims(&id_token_verifier, &pending_auth.nonce)
            .map_err(|e| format!("Failed to validate id_token claims: {}", e))?;

        let id_token = id_token_obj.to_string();

        let expires_at = parse_jwt_expiry(&id_token)?;
        let refresh_token = token_response
            .refresh_token()
            .map(|token: &RefreshToken| token.secret().to_string());

        Ok(OidcTokens {
            id_token,
            refresh_token,
            expires_at,
        })
    }

    pub async fn refresh_token(
        &self,
        config: &OidcExecConfig,
        refresh_token: &str,
    ) -> Result<OidcTokens, RefreshError> {
        let provider_metadata = discover_provider(&config.issuer_url)
            .await
            .map_err(RefreshError::Transient)?;
        let redirect_uri = RedirectUrl::new("kubeli://oidc/callback".to_string())
            .map_err(|e| RefreshError::Transient(format!("Invalid OIDC redirect URL: {}", e)))?;
        let client = CoreClient::from_provider_metadata(
            provider_metadata,
            ClientId::new(config.client_id.clone()),
            None,
        )
        .set_redirect_uri(redirect_uri);

        let refresh_token_value = RefreshToken::new(refresh_token.to_string());
        let refresh_token_request = client
            .exchange_refresh_token(&refresh_token_value)
            .map_err(|e| {
                RefreshError::Transient(format!("Failed to create OIDC refresh request: {}", e))
            })?;

        let http_client = build_http_client().map_err(RefreshError::Transient)?;
        let token_response: CoreTokenResponse =
            match refresh_token_request.request_async(&http_client).await {
                Ok(response) => response,
                Err(e) => {
                    // Only `invalid_grant` means the refresh token itself is dead
                    // and must be discarded. Network errors, IdP 5xx, parse errors
                    // etc. are transient and must NOT cause us to delete a still
                    // valid refresh token (a network error's message never contains
                    // the OAuth2 `invalid_grant` error code).
                    let message = format!("Failed to refresh OIDC token: {}", e);
                    return Err(if message.contains("invalid_grant") {
                        RefreshError::Terminal(message)
                    } else {
                        RefreshError::Transient(message)
                    });
                }
            };

        let id_token_obj = token_response.extra_fields().id_token().ok_or_else(|| {
            RefreshError::Transient(
                "OIDC provider did not return an id_token on refresh".to_string(),
            )
        })?;

        // Refreshed tokens may omit the nonce claim (Keycloak does this per OIDC spec).
        // Signature + audience + issuer are still validated by the K8s API server on each request.
        let id_token = id_token_obj.to_string();
        let expires_at = parse_jwt_expiry(&id_token).map_err(RefreshError::Transient)?;
        let next_refresh_token = token_response
            .refresh_token()
            .map(|token: &RefreshToken| token.secret().to_string())
            .or_else(|| Some(refresh_token.to_string()));

        Ok(OidcTokens {
            id_token,
            refresh_token: next_refresh_token,
            expires_at,
        })
    }
}

impl Default for OidcFlowManager {
    fn default() -> Self {
        Self {
            pending: Mutex::new(None),
        }
    }
}

fn build_http_client() -> Result<reqwest::Client, String> {
    reqwest::ClientBuilder::new()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| format!("Failed to create OIDC HTTP client: {}", e))
}

async fn discover_provider(issuer_url: &str) -> Result<CoreProviderMetadata, String> {
    let issuer = IssuerUrl::new(issuer_url.to_string())
        .map_err(|e| format!("Invalid OIDC issuer URL: {}", e))?;

    let http_client = build_http_client()?;
    CoreProviderMetadata::discover_async(issuer, &http_client)
        .await
        .map_err(|e| format!("Failed OIDC discovery for issuer {}: {}", issuer_url, e))
}

fn parse_jwt_expiry(jwt: &str) -> Result<DateTime<Utc>, String> {
    let mut segments = jwt.split('.');
    let _header = segments
        .next()
        .ok_or_else(|| "Malformed id_token: missing header segment".to_string())?;
    let payload = segments
        .next()
        .ok_or_else(|| "Malformed id_token: missing payload segment".to_string())?;

    let payload_bytes = URL_SAFE_NO_PAD
        .decode(payload)
        .or_else(|_| URL_SAFE.decode(payload))
        .map_err(|e| format!("Failed to decode id_token payload: {}", e))?;

    let payload_json: serde_json::Value = serde_json::from_slice(&payload_bytes)
        .map_err(|e| format!("Failed to parse id_token payload: {}", e))?;

    let exp = payload_json
        .get("exp")
        .and_then(|value| value.as_i64())
        .ok_or_else(|| "id_token payload is missing numeric exp claim".to_string())?;

    DateTime::<Utc>::from_timestamp(exp, 0)
        .ok_or_else(|| "id_token exp claim is out of valid range".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn jwt_with_payload(payload_json: &str) -> String {
        let header = URL_SAFE_NO_PAD.encode(b"{\"alg\":\"none\"}");
        let payload = URL_SAFE_NO_PAD.encode(payload_json.as_bytes());
        format!("{header}.{payload}.signature")
    }

    #[test]
    fn parses_exp_from_valid_token() {
        let token = jwt_with_payload("{\"exp\":1700000000,\"sub\":\"user\"}");
        let exp = parse_jwt_expiry(&token).expect("should parse exp");
        assert_eq!(exp.timestamp(), 1700000000);
    }

    #[test]
    fn rejects_token_without_exp_claim() {
        let token = jwt_with_payload("{\"sub\":\"user\"}");
        assert!(parse_jwt_expiry(&token).is_err());
    }

    #[test]
    fn rejects_token_with_too_few_segments() {
        assert!(parse_jwt_expiry("only-header").is_err());
    }

    #[test]
    fn rejects_non_json_payload() {
        let token = jwt_with_payload("this is not json");
        assert!(parse_jwt_expiry(&token).is_err());
    }

    #[test]
    fn refresh_error_display_shows_message() {
        assert_eq!(RefreshError::Terminal("boom".into()).to_string(), "boom");
        assert_eq!(RefreshError::Transient("blip".into()).to_string(), "blip");
    }
}
