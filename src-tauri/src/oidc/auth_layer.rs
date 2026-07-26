//! Per-request OIDC bearer token injection.
//!
//! The alternative — baking the token into the kube `Client` at construction —
//! means every in-flight stream keeps the token it captured at spawn time. A
//! refresh then has to rebuild the client and restart everything reading from
//! it, and anything not restarted (log streams, shells) dies once the old token
//! expires. Reading the token per request makes a refresh invisible to streams
//! that are already running.
//!
//! Implemented as an `AsyncPredicate`, the same shape kube-rs uses for its own
//! `RefreshableToken`: the token lookup is async, so the request has to be
//! transformed before it reaches the inner service rather than inside `call`.

use std::sync::Arc;

use http::{header::AUTHORIZATION, HeaderValue, Request};
use tower::BoxError;

use crate::oidc::commands::OidcState;
use crate::oidc::config::OidcExecConfig;

/// Stamps the current OIDC token onto each outgoing request.
#[derive(Clone)]
pub struct OidcTokenInjector {
    state: Arc<OidcState>,
    config: Arc<OidcExecConfig>,
}

impl OidcTokenInjector {
    pub fn new(state: Arc<OidcState>, config: OidcExecConfig) -> Self {
        Self {
            state,
            config: Arc::new(config),
        }
    }

    /// Returns a currently valid token, refreshing once if the cached one expired.
    async fn token(&self) -> Option<String> {
        if let Some(token) = self
            .state
            .token_store
            .get_valid_token(&self.config.issuer_url, &self.config.client_id)
        {
            return Some(token);
        }

        // refresh() is single-flight behind refresh_lock and re-checks the cache
        // inside it, so concurrent requests coalesce into one token exchange.
        match self.state.refresh(&self.config).await {
            Ok(token) => Some(token),
            Err(e) => {
                tracing::warn!("OIDC token refresh failed during request: {}", e);
                None
            }
        }
    }
}

impl<B> tower::filter::AsyncPredicate<Request<B>> for OidcTokenInjector
where
    B: Send + 'static,
{
    type Future = std::pin::Pin<
        Box<dyn std::future::Future<Output = Result<Request<B>, BoxError>> + Send + 'static>,
    >;
    type Request = Request<B>;

    fn check(&mut self, mut request: Request<B>) -> Self::Future {
        let injector = self.clone();
        Box::pin(async move {
            // A missing token is deliberately not an error: the request goes out
            // unauthenticated and the API server answers 401, which the existing
            // error handling already classifies as an auth problem. Failing here
            // would instead surface as an opaque transport error.
            if let Some(token) = injector.token().await {
                if let Ok(mut value) = HeaderValue::try_from(format!("Bearer {}", token)) {
                    value.set_sensitive(true);
                    request.headers_mut().insert(AUTHORIZATION, value);
                }
            }
            Ok(request)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::oidc::store::OidcTokens;
    use chrono::{Duration, Utc};
    use tower::filter::AsyncPredicate;

    fn test_config() -> OidcExecConfig {
        OidcExecConfig {
            command: "kubectl".to_string(),
            plugin_binary: None,
            issuer_url: "https://idp.test".to_string(),
            client_id: "kubeli".to_string(),
            extra_scopes: vec![],
            certificate_authority: None,
            certificate_authority_data: None,
            insecure_skip_tls_verify: false,
        }
    }

    fn state_with_token(token: &str, valid_for: Duration) -> Arc<OidcState> {
        let state = Arc::new(OidcState::default());
        let config = test_config();
        state.token_store.store_tokens(
            &config.issuer_url,
            &config.client_id,
            OidcTokens {
                id_token: token.to_string(),
                refresh_token: None,
                expires_at: Utc::now() + valid_for,
            },
        );
        state
    }

    async fn header_for(state: Arc<OidcState>) -> Option<String> {
        let mut injector = OidcTokenInjector::new(state, test_config());
        let request = Request::builder()
            .uri("https://cluster.test/api/v1/pods")
            .body(String::new())
            .unwrap();

        let stamped = injector
            .check(request)
            .await
            .expect("predicate never fails");
        stamped
            .headers()
            .get(AUTHORIZATION)
            .map(|v| v.to_str().unwrap().to_string())
    }

    #[tokio::test]
    async fn stamps_the_current_token_on_the_request() {
        let header = header_for(state_with_token("tok-1", Duration::hours(1))).await;
        assert_eq!(header.as_deref(), Some("Bearer tok-1"));
    }

    // The point of the layer: a request made after a refresh picks up the new
    // token from the same injector, with no client rebuild in between.
    #[tokio::test]
    async fn a_later_request_sees_a_refreshed_token() {
        let state = state_with_token("tok-old", Duration::hours(1));
        let config = test_config();
        let mut injector = OidcTokenInjector::new(Arc::clone(&state), config.clone());

        let first = injector
            .check(
                Request::builder()
                    .uri("https://c/")
                    .body(String::new())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(first.headers()[AUTHORIZATION], "Bearer tok-old");

        // Simulate the background refresh replacing the cached token
        state.token_store.store_tokens(
            &config.issuer_url,
            &config.client_id,
            OidcTokens {
                id_token: "tok-new".to_string(),
                refresh_token: None,
                expires_at: Utc::now() + Duration::hours(1),
            },
        );

        let second = injector
            .check(
                Request::builder()
                    .uri("https://c/")
                    .body(String::new())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(second.headers()[AUTHORIZATION], "Bearer tok-new");
    }

    // No token means no header — the API server answers 401, which the existing
    // error classification already reports as an auth problem. Failing inside
    // the predicate would surface as an opaque transport error instead.
    #[tokio::test]
    async fn passes_the_request_through_when_no_token_is_available() {
        let state = Arc::new(OidcState::default());
        let header = header_for(state).await;
        assert!(header.is_none());
    }

    // get_valid_token treats anything within 30s of expiry as already gone, so
    // the layer falls through to refresh rather than sending a dying token.
    #[tokio::test]
    async fn treats_a_nearly_expired_token_as_absent() {
        let header = header_for(state_with_token("tok-stale", Duration::seconds(5))).await;
        assert!(
            header.is_none(),
            "expected refresh attempt, got {:?}",
            header
        );
    }

    #[tokio::test]
    async fn marks_the_authorization_header_sensitive() {
        let mut injector =
            OidcTokenInjector::new(state_with_token("tok-1", Duration::hours(1)), test_config());
        let stamped = injector
            .check(
                Request::builder()
                    .uri("https://c/")
                    .body(String::new())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert!(
            stamped.headers()[AUTHORIZATION].is_sensitive(),
            "token must be redacted from tracing output"
        );
    }
}
