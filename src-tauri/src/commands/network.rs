use crate::network::proxy::ProxyConfig;

/// Set the proxy configuration
/// This applies the proxy settings to environment variables that reqwest/kube-rs will use
#[tauri::command]
pub fn set_proxy_config(
    proxy_type: String,
    host: String,
    port: u16,
    username: String,
    password: String,
) -> Result<(), String> {
    let config = ProxyConfig {
        proxy_type,
        host,
        port,
        username,
        password,
    };

    config.apply_to_env();
    Ok(())
}

/// Get the current proxy configuration from environment
#[tauri::command]
pub fn get_proxy_config() -> ProxyConfig {
    crate::network::proxy::detect_system_proxy().unwrap_or_default()
}
