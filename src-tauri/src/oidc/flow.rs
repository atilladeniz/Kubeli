use std::sync::Mutex;

use base64::engine::general_purpose::{STANDARD, URL_SAFE, URL_SAFE_NO_PAD};
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
        let provider_metadata = discover_provider(config).await?;
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

        let provider_metadata = discover_provider(&pending_auth.config).await?;
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

        let http_client = build_http_client(&pending_auth.config)?;
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
        let provider_metadata = discover_provider(config)
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

        let http_client = build_http_client(config).map_err(RefreshError::Transient)?;
        let token_response: CoreTokenResponse =
            match refresh_token_request.request_async(&http_client).await {
                Ok(response) => response,
                Err(e) => return Err(classify_refresh_error(e)),
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

fn build_http_client(config: &OidcExecConfig) -> Result<reqwest::Client, String> {
    let mut builder = reqwest::ClientBuilder::new().redirect(reqwest::redirect::Policy::none());

    // The bundled root store only trusts public CAs, so an IdP behind a private
    // CA (corporate Keycloak/Dex, or the local test rig) needs its CA added
    // explicitly — mirroring kubelogin's --certificate-authority(-data) /
    // --insecure-skip-tls-verify.
    if config.insecure_skip_tls_verify {
        builder = builder.danger_accept_invalid_certs(true);
    } else if let Some(pem) = resolve_ca_pem(config)? {
        for cert in reqwest::Certificate::from_pem_bundle(&pem)
            .map_err(|e| format!("Invalid OIDC certificate authority: {}", e))?
        {
            builder = builder.add_root_certificate(cert);
        }
    }

    builder
        .build()
        .map_err(|e| format!("Failed to create OIDC HTTP client: {}", e))
}

/// Resolve the configured CA bundle to PEM bytes: inline base64 data takes
/// precedence over a file path; returns `None` when neither is set.
fn resolve_ca_pem(config: &OidcExecConfig) -> Result<Option<Vec<u8>>, String> {
    if let Some(data) = &config.certificate_authority_data {
        let pem = STANDARD
            .decode(data.trim())
            .map_err(|e| format!("Invalid --certificate-authority-data (base64): {}", e))?;
        return Ok(Some(pem));
    }
    if let Some(path) = &config.certificate_authority {
        let pem = std::fs::read(path)
            .map_err(|e| format!("Failed to read OIDC CA file '{}': {}", path, e))?;
        return Ok(Some(pem));
    }
    Ok(None)
}

async fn discover_provider(config: &OidcExecConfig) -> Result<CoreProviderMetadata, String> {
    let issuer = IssuerUrl::new(config.issuer_url.clone())
        .map_err(|e| format!("Invalid OIDC issuer URL: {}", e))?;

    let http_client = build_http_client(config)?;
    CoreProviderMetadata::discover_async(issuer, &http_client)
        .await
        .map_err(|e| {
            format!(
                "Failed OIDC discovery for issuer {}: {}",
                config.issuer_url, e
            )
        })
}

/// Classify a token-refresh error. Only a server response carrying the
/// `invalid_grant` OAuth2 error code means the refresh token is dead and must be
/// discarded; transport errors, parse errors, and other server error codes are
/// transient and must NOT cause us to drop a still-valid refresh token. We match
/// the structured `ServerResponse` variant and inspect only the error response
/// (which carries the code) rather than substring-matching the whole formatted
/// error chain.
fn classify_refresh_error<RE, T>(error: openidconnect::RequestTokenError<RE, T>) -> RefreshError
where
    RE: std::error::Error + 'static,
    T: openidconnect::ErrorResponse + std::fmt::Display,
{
    let message = format!("Failed to refresh OIDC token: {}", error);
    let is_invalid_grant = matches!(
        &error,
        openidconnect::RequestTokenError::ServerResponse(resp)
            if resp.to_string().contains("invalid_grant")
    );
    if is_invalid_grant {
        RefreshError::Terminal(message)
    } else {
        RefreshError::Transient(message)
    }
}

fn parse_jwt_expiry(jwt: &str) -> Result<DateTime<Utc>, String> {
    // A compact-serialization JWT/JWS has exactly three dot-separated segments
    // (header.payload.signature). Reject anything else so a malformed token like
    // "header.payload" can't slip through with a parseable exp.
    let segments: Vec<&str> = jwt.split('.').collect();
    if segments.len() != 3 {
        return Err(format!(
            "Malformed id_token: expected 3 JWT segments, got {}",
            segments.len()
        ));
    }
    let payload = segments[1];

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
    fn rejects_tokens_without_exactly_three_segments() {
        // 1 segment, 2 segments (no signature) and 4 segments must all be rejected.
        assert!(parse_jwt_expiry("only-header").is_err());
        let header = URL_SAFE_NO_PAD.encode(b"{\"alg\":\"none\"}");
        let payload = URL_SAFE_NO_PAD.encode(b"{\"exp\":1700000000}");
        assert!(parse_jwt_expiry(&format!("{header}.{payload}")).is_err());
        assert!(parse_jwt_expiry(&format!("{header}.{payload}.sig.extra")).is_err());
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
