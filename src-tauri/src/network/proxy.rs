use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProxyConfig {
    pub proxy_type: String, // "none", "system", "http", "socks5"
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
}

impl ProxyConfig {
    /// Apply proxy settings to environment variables
    /// kube-rs uses reqwest which respects HTTP_PROXY/HTTPS_PROXY/ALL_PROXY
    pub fn apply_to_env(&self) {
        match self.proxy_type.as_str() {
            "none" => {
                // Clear proxy environment variables
                env::remove_var("HTTP_PROXY");
                env::remove_var("HTTPS_PROXY");
                env::remove_var("ALL_PROXY");
                env::remove_var("NO_PROXY");
                tracing::info!("Proxy disabled");
            }
            "system" => {
                // Don't modify - let system proxy settings take effect
                // macOS/Windows/Linux handle this via system settings
                tracing::info!("Using system proxy settings");
            }
            "http" => {
                let proxy_url = self.build_url("http");
                env::set_var("HTTP_PROXY", &proxy_url);
                env::set_var("HTTPS_PROXY", &proxy_url);
                tracing::info!("HTTP proxy configured: {}:{}", self.host, self.port);
            }
            "socks5" => {
                let proxy_url = self.build_url("socks5");
                env::set_var("ALL_PROXY", &proxy_url);
                tracing::info!("SOCKS5 proxy configured: {}:{}", self.host, self.port);
            }
            _ => {
                tracing::warn!("Unknown proxy type: {}", self.proxy_type);
            }
        }
    }

    fn build_url(&self, scheme: &str) -> String {
        if !self.username.is_empty() && !self.password.is_empty() {
            format!(
                "{}://{}:{}@{}:{}",
                scheme, self.username, self.password, self.host, self.port
            )
        } else {
            format!("{}://{}:{}", scheme, self.host, self.port)
        }
    }
}

/// Detect system proxy settings (platform-specific)
#[cfg(target_os = "macos")]
pub fn detect_system_proxy() -> Option<ProxyConfig> {
    // On macOS, we could use scutil --proxy to get system proxy settings
    // For now, we rely on environment variables
    if let Ok(proxy) = env::var("HTTPS_PROXY").or_else(|_| env::var("HTTP_PROXY")) {
        if let Some(config) = parse_proxy_url(&proxy) {
            return Some(config);
        }
    }
    None
}

#[cfg(target_os = "windows")]
pub fn detect_system_proxy() -> Option<ProxyConfig> {
    // On Windows, we could read from registry
    // HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Internet Settings
    // For now, we rely on environment variables
    if let Ok(proxy) = env::var("HTTPS_PROXY").or_else(|_| env::var("HTTP_PROXY")) {
        if let Some(config) = parse_proxy_url(&proxy) {
            return Some(config);
        }
    }
    None
}

#[cfg(target_os = "linux")]
pub fn detect_system_proxy() -> Option<ProxyConfig> {
    // On Linux, we rely on environment variables (standard approach)
    if let Ok(proxy) = env::var("HTTPS_PROXY").or_else(|_| env::var("HTTP_PROXY")) {
        if let Some(config) = parse_proxy_url(&proxy) {
            return Some(config);
        }
    }
    None
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
pub fn detect_system_proxy() -> Option<ProxyConfig> {
    None
}

/// Parse a proxy URL into ProxyConfig
fn parse_proxy_url(url: &str) -> Option<ProxyConfig> {
    let url = url::Url::parse(url).ok()?;

    let proxy_type = match url.scheme() {
        "http" | "https" => "http".to_string(),
        "socks5" | "socks5h" => "socks5".to_string(),
        _ => return None,
    };

    Some(ProxyConfig {
        proxy_type,
        host: url.host_str()?.to_string(),
        port: url.port().unwrap_or(8080),
        username: url.username().to_string(),
        password: url.password().unwrap_or("").to_string(),
    })
}
