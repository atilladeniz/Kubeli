use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProxyConfig {
    pub proxy_type: String, // "none", "system", "http", "socks5"
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
}

impl ProxyConfig {
    /// Apply proxy settings to environment variables.
    ///
    /// kube-client takes the cluster proxy from the kubeconfig `proxy-url` or,
    /// failing that, from `HTTPS_PROXY`/`https_proxy`. It never reads
    /// `ALL_PROXY`, so every proxy type has to set `HTTPS_PROXY`. Each type
    /// also overwrites or clears the variables a previous type left behind.
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
                // Don't modify: use whatever proxy variables the process
                // inherited. On macOS the system proxy lives in the network
                // settings, not the environment, so it is not picked up here.
                tracing::info!("Using system proxy settings");
            }
            "http" => {
                let proxy_url = self.build_url("http");
                env::set_var("HTTP_PROXY", &proxy_url);
                env::set_var("HTTPS_PROXY", &proxy_url);
                env::remove_var("ALL_PROXY");
                tracing::info!("HTTP proxy configured: {}:{}", self.host, self.port);
            }
            "socks5" => {
                // `socks5://`, not `socks5h://`: kube-client only accepts the
                // exact scheme "socks5" and rejects `socks5h` as unsupported.
                // DNS is still remote: hyper-util's SocksV5 connector sends the
                // hostname to the proxy unless local DNS is turned on, and kube
                // does not turn it on.
                let proxy_url = self.build_url("socks5");
                env::set_var("HTTP_PROXY", &proxy_url);
                env::set_var("HTTPS_PROXY", &proxy_url);
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

#[cfg(test)]
mod tests {
    use super::*;

    const VARS: [&str; 4] = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY"];

    fn config(proxy_type: &str, port: u16) -> ProxyConfig {
        ProxyConfig {
            proxy_type: proxy_type.to_string(),
            host: "proxy.test".to_string(),
            port,
            ..Default::default()
        }
    }

    fn current() -> [Option<String>; 3] {
        ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY"].map(|v| env::var(v).ok())
    }

    // Regression for #560. The env vars are process-global, so the whole
    // http -> socks5 -> none sequence stays in this one test function and the
    // original values are restored at the end.
    #[test]
    fn apply_to_env_switches_proxy_types_without_leftovers() {
        let saved = VARS.map(|v| env::var(v).ok());

        config("http", 8080).apply_to_env();
        let http = Some("http://proxy.test:8080".to_string());
        assert_eq!(current(), [http.clone(), http, None]);

        config("socks5", 1080).apply_to_env();
        let socks = Some("socks5://proxy.test:1080".to_string());
        assert_eq!(
            current(),
            [socks.clone(), socks.clone(), socks],
            "SOCKS5 must replace the HTTP proxy and set HTTPS_PROXY, which kube reads"
        );

        config("http", 8080).apply_to_env();
        assert_eq!(
            env::var("ALL_PROXY").ok(),
            None,
            "HTTP must clear ALL_PROXY"
        );

        config("none", 0).apply_to_env();
        assert_eq!(current(), [None, None, None]);

        for (var, value) in VARS.iter().zip(saved) {
            match value {
                Some(value) => env::set_var(var, value),
                None => env::remove_var(var),
            }
        }
    }
}
