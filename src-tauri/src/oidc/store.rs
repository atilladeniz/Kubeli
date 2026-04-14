use std::collections::HashMap;
use std::sync::Mutex;

use chrono::{DateTime, Duration, Utc};

#[derive(Debug, Clone)]
pub struct OidcTokens {
    pub id_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug)]
pub struct OidcTokenStore {
    pub tokens: Mutex<HashMap<String, OidcTokens>>,
}

impl OidcTokenStore {
    pub fn cache_key(issuer: &str, client_id: &str) -> String {
        format!("{}:{}", issuer, client_id)
    }

    pub fn get_valid_token(&self, issuer: &str, client_id: &str) -> Option<String> {
        let cache_key = Self::cache_key(issuer, client_id);
        let guard = self.tokens.lock().ok()?;
        let entry = guard.get(&cache_key)?;

        if entry.expires_at <= Utc::now() + Duration::seconds(30) {
            return None;
        }

        Some(entry.id_token.clone())
    }

    pub fn store_tokens(&self, issuer: &str, client_id: &str, tokens: OidcTokens) {
        let cache_key = Self::cache_key(issuer, client_id);
        if let Ok(mut guard) = self.tokens.lock() {
            guard.insert(cache_key, tokens);
        }
    }

    pub fn clear(&self, issuer: &str, client_id: &str) {
        let cache_key = Self::cache_key(issuer, client_id);
        if let Ok(mut guard) = self.tokens.lock() {
            guard.remove(&cache_key);
        }
    }

    pub fn save_refresh_token(issuer: &str, client_id: &str, refresh_token: &str) {
        let service = keyring_service(issuer, client_id);
        let entry = keyring::Entry::new(&service, "refresh_token");
        if let Ok(entry) = entry {
            let _ = entry.set_password(refresh_token);
        }
    }

    pub fn load_refresh_token(issuer: &str, client_id: &str) -> Option<String> {
        let service = keyring_service(issuer, client_id);
        let entry = keyring::Entry::new(&service, "refresh_token").ok()?;
        entry.get_password().ok()
    }

    pub fn delete_refresh_token(issuer: &str, client_id: &str) {
        let service = keyring_service(issuer, client_id);
        if let Ok(entry) = keyring::Entry::new(&service, "refresh_token") {
            let _ = entry.delete_credential();
        }
    }
}

fn keyring_service(issuer: &str, client_id: &str) -> String {
    format!("kubeli-oidc:{}:{}", issuer, client_id)
}

impl Default for OidcTokenStore {
    fn default() -> Self {
        Self {
            tokens: Mutex::new(HashMap::new()),
        }
    }
}
