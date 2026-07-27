//! Live end-to-end test of the native OIDC flow against the local Dex dev
//! stack. Ignored by default — run via `make oidc-e2e` (needs the Dex
//! container from `make oidc-dev`; the minikube profile is NOT required).
//!
//! Dex's login page is a plain HTML form, so the test drives the exact flow a
//! user clicks through — without a browser:
//!
//! 1. `start_auth` builds the real authorization URL (PKCE + state + nonce).
//! 2. The test follows Dex's redirects and POSTs the dev credentials at the
//!    local connector's form, capturing the `kubeli://oidc/callback` redirect.
//! 3. `exchange_code` runs the production code exchange incl. PKCE verifier
//!    and nonce validation, yielding id + refresh tokens.
//! 4. The cached id_token is replaced with an expired one (what a long-running
//!    log stream sees when its token dies mid-stream) and the refresh token is
//!    stored in the OS keyring — then a kube client built the production way
//!    (`build_client`) sends a request. The injector must refresh against the
//!    real Dex and stamp a fresh Bearer token, with no client rebuild.
//!
//! The only parts left untested are the OS browser hand-off and the
//! `kubeli://` deep-link registration, which need the packaged app.

use std::sync::Arc;

use chrono::{Duration, Utc};
use http::header::LOCATION;
use openidconnect::reqwest;

use super::commands::OidcState;
use super::config::OidcExecConfig;
use super::store::{OidcTokenStore, OidcTokens};
use crate::k8s::client::build_client;

const DEX_LOGIN: &str = "dev@kubeli.test";
const DEX_PASSWORD: &str = "password";
const CALLBACK_PREFIX: &str = "kubeli://oidc/callback";

fn issuer_url() -> String {
    std::env::var("KUBELI_OIDC_E2E_ISSUER")
        .unwrap_or_else(|_| "https://host.minikube.internal:5556/dex".to_string())
}

fn ca_path() -> String {
    std::env::var("KUBELI_OIDC_E2E_CA").unwrap_or_else(|_| {
        concat!(env!("CARGO_MANIFEST_DIR"), "/../.dev/oidc/certs/ca.crt").into()
    })
}

fn dev_stack_config() -> OidcExecConfig {
    OidcExecConfig {
        command: "kubectl".to_string(),
        issuer_url: issuer_url(),
        client_id: "kubeli".to_string(),
        // Mirrors the scopes scripts/oidc-dev.sh writes into the kubeconfig;
        // offline_access makes Dex issue the refresh token step 4 depends on.
        extra_scopes: vec!["email".to_string(), "offline_access".to_string()],
        certificate_authority: Some(ca_path()),
        ..Default::default()
    }
}

fn dex_http_client() -> reqwest::Client {
    let pem = std::fs::read(ca_path())
        .expect("dev CA not found — run `make oidc-dev` first (the Dex container is enough)");
    let mut builder = reqwest::ClientBuilder::new()
        // Redirects are followed manually so the kubeli:// callback (which
        // reqwest cannot follow) can be captured from the Location header.
        .redirect(reqwest::redirect::Policy::none());
    for cert in reqwest::Certificate::from_pem_bundle(&pem).expect("valid dev CA bundle") {
        builder = builder.add_root_certificate(cert);
    }
    builder.build().expect("build Dex test client")
}

/// Walk Dex's redirect/form chain like a browser: GET until a page (the local
/// connector's login form) answers 200, POST the credentials there once, then
/// keep following redirects until Dex hands back the `kubeli://` callback.
async fn drive_dex_login(auth_url: &str) -> (String, String) {
    let client = dex_http_client();
    let mut url = url::Url::parse(auth_url).expect("valid auth URL");
    let mut post_credentials = false;

    for _ in 0..10 {
        let response = if post_credentials {
            post_credentials = false;
            client
                .post(url.clone())
                .form(&[("login", DEX_LOGIN), ("password", DEX_PASSWORD)])
                .send()
                .await
                .expect("POST Dex login form")
        } else {
            client.get(url.clone()).send().await.expect("GET Dex page")
        };

        if response.status().is_redirection() {
            let location = response
                .headers()
                .get(LOCATION)
                .and_then(|value| value.to_str().ok())
                .expect("redirect carries a Location header")
                .to_string();

            if location.starts_with(CALLBACK_PREFIX) {
                let callback = url::Url::parse(&location).expect("valid callback URL");
                let mut code = None;
                let mut state = None;
                for (key, value) in callback.query_pairs() {
                    match key.as_ref() {
                        "code" => code = Some(value.into_owned()),
                        "state" => state = Some(value.into_owned()),
                        _ => {}
                    }
                }
                return (
                    code.expect("callback carries a code"),
                    state.expect("callback carries a state"),
                );
            }

            url = response
                .url()
                .join(&location)
                .expect("resolvable redirect Location");
        } else if response.status().is_success() {
            // Reached the login form — submit the dev credentials next.
            assert!(
                url.path().contains("/auth/"),
                "unexpected 200 outside the login form at {url}"
            );
            post_credentials = true;
        } else {
            panic!("unexpected Dex response {} at {url}", response.status());
        }
    }
    panic!("Dex login did not reach the kubeli:// callback within 10 steps");
}

/// One-shot HTTP server standing in for the Kubernetes API: returns the raw
/// bytes of the request it received, so the Authorization header can be
/// asserted on the wire.
async fn capture_one_request() -> (std::net::SocketAddr, tokio::task::JoinHandle<String>) {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind mock API server");
    let address = listener.local_addr().expect("mock API server address");
    let server = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.expect("accept request");
        let mut request = vec![0; 8192];
        let n = stream.read(&mut request).await.expect("read request");
        stream
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok")
            .await
            .expect("write response");
        String::from_utf8_lossy(&request[..n]).to_string()
    });
    (address, server)
}

#[tokio::test(flavor = "multi_thread")]
#[ignore = "needs the local Dex dev stack — run via `make oidc-e2e`"]
async fn full_native_flow_and_mid_stream_refresh_against_real_dex() {
    let _ = rustls::crypto::ring::default_provider().install_default();
    let config = dev_stack_config();
    let state = Arc::new(OidcState::default());
    state.remember_config(&config);

    // 1+2: interactive flow, minus the browser.
    let auth_url = state
        .flow_manager
        .start_auth(&config)
        .await
        .expect("start_auth against live Dex");
    let (code, callback_state) = drive_dex_login(&auth_url).await;

    // 3: production code exchange (PKCE verifier + nonce validation included).
    let (tokens, _) = state
        .flow_manager
        .exchange_code(&code, &callback_state)
        .await
        .expect("exchange_code against live Dex");
    assert!(
        tokens.expires_at > Utc::now(),
        "fresh id_token must be valid"
    );
    let refresh_token = tokens
        .refresh_token
        .clone()
        .expect("offline_access scope must yield a refresh token");

    // 4: simulate the token expiring mid-stream. Deleting the keyring entry
    // first keeps this run's test binary the owner of the item it reads back.
    {
        let (issuer, client_id) = (config.issuer_url.clone(), config.client_id.clone());
        tokio::task::spawn_blocking(move || {
            OidcTokenStore::delete_refresh_token(&issuer, &client_id);
            OidcTokenStore::save_refresh_token(&issuer, &client_id, &refresh_token);
        })
        .await
        .expect("seed keyring");
    }
    state.token_store.store_tokens(
        &config.issuer_url,
        &config.client_id,
        OidcTokens {
            id_token: "expired-mid-stream".to_string(),
            refresh_token: None,
            expires_at: Utc::now() - Duration::minutes(5),
        },
    );

    let (address, server) = capture_one_request().await;
    let kube_config = kube::Config::new(format!("http://{address}").parse().unwrap());
    let client = build_client(kube_config, Some((Arc::clone(&state), config.clone())))
        .expect("build production OIDC client");
    let body = client
        .request_text(
            http::Request::get("/api/v1/namespaces")
                .body(Vec::new())
                .unwrap(),
        )
        .await
        .expect("request must succeed after a live token refresh");
    assert_eq!(body, "ok");

    // The wire must carry a freshly refreshed JWT, not the expired seed.
    let raw_request = server.await.expect("mock API server completes");
    let bearer = raw_request
        .lines()
        .find_map(|line| {
            line.to_lowercase()
                .starts_with("authorization: bearer ")
                .then(|| line["authorization: bearer ".len()..].trim().to_string())
        })
        .expect("request must carry an Authorization header");
    assert_ne!(
        bearer, "expired-mid-stream",
        "expired token must not be sent"
    );
    assert_eq!(
        bearer.split('.').count(),
        3,
        "refreshed token must be a real JWT"
    );
    assert_eq!(
        state
            .token_store
            .get_valid_token(&config.issuer_url, &config.client_id),
        Some(bearer),
        "the injected token must be the one the refresh cached"
    );

    // Cleanup: drop the test's keyring entry.
    let (issuer, client_id) = (config.issuer_url.clone(), config.client_id.clone());
    let _ = tokio::task::spawn_blocking(move || {
        OidcTokenStore::delete_refresh_token(&issuer, &client_id);
    })
    .await;
}
