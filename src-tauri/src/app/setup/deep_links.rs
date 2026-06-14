use std::sync::Mutex;

use serde::Serialize;

/// A deep link resolved into the action it should trigger in the app.
///
/// Used both for the warm path (emitted as a Tauri event while the app runs) and
/// the cold-start path (buffered, then drained by the frontend once its handlers
/// are mounted — see [`StartupDeepLinks`]).
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum DeepLinkAction {
    Navigate { view: String },
    Connect { context: String },
    OidcCallback { code: String, state: String },
}

/// Deep links received before the frontend was ready to handle them.
///
/// On a cold start the launching URL is delivered during Tauri setup — long
/// before React mounts and registers its `navigate`/`auto-connect` listeners, and
/// Tauri does not buffer events for listeners that do not exist yet. We stash the
/// parsed action here and let the frontend pull it via `take_startup_deep_links`
/// once it is ready, so cold-start `kubeli://view/...` / `kubeli://connect/...`
/// links are not silently dropped.
#[derive(Default)]
pub struct StartupDeepLinks(pub Mutex<Vec<DeepLinkAction>>);

impl StartupDeepLinks {
    /// Drain every buffered action, leaving the buffer empty. A second call
    /// returns nothing, so cold-start links are dispatched exactly once even if
    /// the frontend retries the pull.
    pub fn drain(&self) -> Vec<DeepLinkAction> {
        self.0
            .lock()
            .map(|mut pending| std::mem::take(&mut *pending))
            .unwrap_or_default()
    }
}

#[cfg(desktop)]
pub fn setup_deep_links(app: &mut tauri::App) {
    use tauri::Manager;
    use tauri_plugin_deep_link::DeepLinkExt;

    // Cold start: on Windows/Linux the URL that launched the app is delivered as
    // a process argument (not through on_open_url), so pull it explicitly. Buffer
    // it rather than emitting now — the frontend listeners do not exist yet.
    if let Ok(Some(urls)) = app.deep_link().get_current() {
        let actions: Vec<DeepLinkAction> = urls.iter().filter_map(parse_deep_link).collect();
        if !actions.is_empty() {
            if let Some(buffer) = app.try_state::<StartupDeepLinks>() {
                if let Ok(mut pending) = buffer.0.lock() {
                    pending.extend(actions);
                }
            }
        }
    }

    let app_handle = app.handle().clone();
    app.deep_link().on_open_url(move |event| {
        // Warm path: the app is running and listeners are registered, so emit now.
        for url in event.urls() {
            if let Some(action) = parse_deep_link(&url) {
                emit_action(&app_handle, &action);
            }
        }
    });
}

/// Drain the deep links that arrived before the frontend was ready.
///
/// The frontend calls this once after its deep-link handlers are mounted and
/// dispatches the returned actions itself, so cold-start links survive the gap
/// between process launch and React being ready to listen.
#[tauri::command]
pub fn take_startup_deep_links(buffer: tauri::State<'_, StartupDeepLinks>) -> Vec<DeepLinkAction> {
    buffer.drain()
}

/// Parse a `kubeli://` deep link into the action it should trigger, or `None`
/// for an unrecognised or incomplete link.
fn parse_deep_link(url: &url::Url) -> Option<DeepLinkAction> {
    use percent_encoding::percent_decode_str;

    let host = url.host_str().unwrap_or_default();
    let path = percent_decode_str(url.path().trim_start_matches('/'))
        .decode_utf8_lossy()
        .to_string();

    match host {
        "view" if !path.is_empty() => Some(DeepLinkAction::Navigate { view: path }),
        "connect" if !path.is_empty() => Some(DeepLinkAction::Connect { context: path }),
        "oidc" if path == "callback" => {
            let query = url.query()?;
            let params: std::collections::HashMap<String, String> =
                url::form_urlencoded::parse(query.as_bytes())
                    .map(|(k, v)| (k.to_string(), v.to_string()))
                    .collect();
            let code = params.get("code").cloned().unwrap_or_default();
            if code.is_empty() {
                return None;
            }
            let state = params.get("state").cloned().unwrap_or_default();
            Some(DeepLinkAction::OidcCallback { code, state })
        }
        _ => None,
    }
}

#[cfg(desktop)]
fn emit_action(app_handle: &tauri::AppHandle, action: &DeepLinkAction) {
    use tauri::Emitter;

    match action {
        DeepLinkAction::Navigate { view } => {
            let _ = app_handle.emit("navigate", serde_json::json!({ "view": view }));
        }
        DeepLinkAction::Connect { context } => {
            let _ = app_handle.emit("auto-connect", serde_json::json!({ "context": context }));
        }
        DeepLinkAction::OidcCallback { code, state } => {
            let _ = app_handle.emit(
                "oidc-callback",
                serde_json::json!({ "code": code, "state": state }),
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{parse_deep_link, DeepLinkAction, StartupDeepLinks};
    use std::sync::Mutex;
    use url::Url;

    fn parse(raw: &str) -> Option<DeepLinkAction> {
        parse_deep_link(&Url::parse(raw).unwrap())
    }

    #[test]
    fn parses_view_link() {
        assert_eq!(
            parse("kubeli://view/pods"),
            Some(DeepLinkAction::Navigate {
                view: "pods".to_string()
            })
        );
    }

    #[test]
    fn parses_connect_link_and_decodes_percent_encoding() {
        assert_eq!(
            parse("kubeli://connect/arn%3Aaws%3Aeks%3Aus-west-2"),
            Some(DeepLinkAction::Connect {
                context: "arn:aws:eks:us-west-2".to_string()
            })
        );
    }

    #[test]
    fn parses_oidc_callback_link() {
        assert_eq!(
            parse("kubeli://oidc/callback?code=abc&state=xyz"),
            Some(DeepLinkAction::OidcCallback {
                code: "abc".to_string(),
                state: "xyz".to_string()
            })
        );
    }

    #[test]
    fn oidc_callback_without_code_is_ignored() {
        assert_eq!(parse("kubeli://oidc/callback?state=xyz"), None);
    }

    #[test]
    fn empty_path_and_unknown_host_are_ignored() {
        assert_eq!(parse("kubeli://view/"), None);
        assert_eq!(parse("kubeli://connect/"), None);
        assert_eq!(parse("kubeli://unknown/thing"), None);
    }

    #[test]
    fn drains_buffered_cold_start_links_exactly_once() {
        let buffer = StartupDeepLinks(Mutex::new(vec![
            DeepLinkAction::Navigate {
                view: "pods".to_string(),
            },
            DeepLinkAction::Connect {
                context: "prod".to_string(),
            },
        ]));

        let drained = buffer.drain();
        assert_eq!(
            drained,
            vec![
                DeepLinkAction::Navigate {
                    view: "pods".to_string()
                },
                DeepLinkAction::Connect {
                    context: "prod".to_string()
                },
            ]
        );

        // A second pull must come back empty: a frontend retry must not replay
        // cold-start links a second time.
        assert!(buffer.drain().is_empty());
    }

    #[test]
    fn draining_an_empty_buffer_yields_nothing() {
        assert!(StartupDeepLinks::default().drain().is_empty());
    }

    #[test]
    fn action_serializes_with_kind_tag() {
        let json = serde_json::to_value(DeepLinkAction::Navigate {
            view: "deployments".to_string(),
        })
        .unwrap();
        assert_eq!(json["kind"], "navigate");
        assert_eq!(json["view"], "deployments");
    }
}
