#[cfg(desktop)]
pub fn setup_deep_links(app: &mut tauri::App) {
    use percent_encoding::percent_decode_str;
    use tauri::Emitter;
    use tauri_plugin_deep_link::DeepLinkExt;

    let app_handle = app.handle().clone();
    app.deep_link().on_open_url(move |event| {
        let urls = event.urls();
        if let Some(url) = urls.first() {
            let host = url.host_str().unwrap_or_default();
            let path = percent_decode_str(url.path().trim_start_matches('/'))
                .decode_utf8_lossy()
                .to_string();
            match host {
                "view" if !path.is_empty() => {
                    let _ = app_handle.emit("navigate", serde_json::json!({ "view": path }));
                }
                "connect" if !path.is_empty() => {
                    let _ = app_handle.emit("auto-connect", serde_json::json!({ "context": path }));
                }
                "oidc" if path == "callback" => {
                    if let Some(query) = url.query() {
                        let params: std::collections::HashMap<String, String> =
                            url::form_urlencoded::parse(query.as_bytes())
                                .map(|(k, v)| (k.to_string(), v.to_string()))
                                .collect();
                        let code = params.get("code").cloned().unwrap_or_default();
                        let state = params.get("state").cloned().unwrap_or_default();
                        if !code.is_empty() {
                            let _ = app_handle.emit(
                                "oidc-callback",
                                serde_json::json!({ "code": code, "state": state }),
                            );
                        }
                    }
                }
                _ => {}
            }
        }
    });
}
