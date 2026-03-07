use crate::app::state;
use crate::app::tray;
use tauri::Emitter;

pub fn configure(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    state::initialize_ai_session_store(app);

    #[cfg(target_os = "macos")]
    if let Err(error) = tray::setup(app) {
        tracing::error!("Failed to setup tray icon: {}", error);
    }

    #[cfg(target_os = "macos")]
    setup_macos_menu(app)?;

    #[cfg(all(desktop, debug_assertions))]
    setup_deep_links(app);

    Ok(())
}

#[cfg(target_os = "macos")]
fn setup_macos_menu(app: &mut tauri::App) -> tauri::Result<()> {
    use chrono::{Datelike, Utc};
    use tauri::menu::{AboutMetadataBuilder, MenuBuilder, SubmenuBuilder};

    let about_metadata = AboutMetadataBuilder::new()
        .name(Some("Kubeli"))
        .version(Some("0.1.0"))
        .copyright(Some(&format!("© {} Kubeli", Utc::now().year())))
        .comments(Some(
            "Modern Kubernetes Management Desktop Application.\n\nThank you for using Kubeli!",
        ))
        .build();

    let app_submenu = SubmenuBuilder::new(app, "Kubeli")
        .about(Some(about_metadata))
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let window_submenu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .separator()
        .close_window()
        .build()?;

    let menu = MenuBuilder::new(app)
        .item(&app_submenu)
        .item(&edit_submenu)
        .item(&window_submenu)
        .build()?;

    app.set_menu(menu)?;
    Ok(())
}

#[cfg(all(desktop, debug_assertions))]
fn setup_deep_links(app: &mut tauri::App) {
    use percent_encoding::percent_decode_str;
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
                _ => {}
            }
        }
    });
}
