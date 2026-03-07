use crate::ai::agent_manager::AgentManager;
use crate::ai::commands::AIConfigState;
use crate::ai::session_store::create_session_store;
use crate::app::commands::generate_app_handler;
use crate::app::tray;
use crate::commands::logs::LogStreamManager;
use crate::commands::portforward::{PortForwardManager, PortForwardWatchManager};
use crate::commands::shell::ShellSessionManager;
use crate::commands::watch::WatchManager;
use crate::k8s::AppState;
use std::sync::Arc;
use tauri::{Emitter, Manager};

pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_deep_link::init());
    }

    builder
        .manage(AppState::new())
        .manage(Arc::new(WatchManager::new()))
        .manage(Arc::new(LogStreamManager::new()))
        .manage(Arc::new(ShellSessionManager::new()))
        .manage(Arc::new(PortForwardManager::new()))
        .manage(Arc::new(PortForwardWatchManager::new()))
        .manage(AIConfigState::new())
        .manage(Arc::new(AgentManager::new()))
        .setup(setup_app)
        .on_menu_event(|app, event| tray::handle_menu_event(app, event))
        .invoke_handler(generate_app_handler!())
        .on_window_event(|window, event| tray::handle_window_event(window, event))
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| tray::handle_run_event(app_handle, event));
}

fn setup_app(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    initialize_ai_session_store(app);

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

fn initialize_ai_session_store(app: &mut tauri::App) {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data directory");
    let db_path = app_data_dir.join("ai_sessions.db");
    let session_store = create_session_store(db_path).expect("Failed to create session store");
    app.manage(session_store);
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
