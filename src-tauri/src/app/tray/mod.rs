#[cfg(target_os = "macos")]
mod macos;

use tauri::Manager;

#[cfg(target_os = "macos")]
#[allow(dead_code)]
pub fn app_quit_requested() -> bool {
    macos::app_quit_requested()
}

#[cfg(not(target_os = "macos"))]
#[allow(dead_code)]
pub fn app_quit_requested() -> bool {
    false
}

#[allow(deprecated)]
pub fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        #[cfg(target_os = "macos")]
        macos::activate_app();
    }
}

#[tauri::command]
pub fn quit_app() {
    extern "C" {
        fn _exit(status: i32) -> !;
    }
    unsafe { _exit(0) };
}

#[tauri::command]
pub fn show_main_window_command(app: tauri::AppHandle) {
    show_main_window(&app);
    #[cfg(target_os = "macos")]
    macos::hide_popup(&app);
}

#[cfg(target_os = "macos")]
pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    macos::setup(app)
}

#[cfg(not(target_os = "macos"))]
#[allow(dead_code)]
pub fn setup(_app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}

#[cfg(target_os = "macos")]
pub fn handle_menu_event(_app: &tauri::AppHandle, event: tauri::menu::MenuEvent) {
    if event.id() == "quit" {
        macos::mark_app_quit_requested();
    }
}

#[cfg(not(target_os = "macos"))]
pub fn handle_menu_event(_app: &tauri::AppHandle, _event: tauri::menu::MenuEvent) {}

#[cfg(target_os = "macos")]
pub fn handle_window_event<R: tauri::Runtime>(
    window: &tauri::Window<R>,
    event: &tauri::WindowEvent,
) {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        if window.label() == "main" && !macos::app_quit_requested() {
            let prevent_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                api.prevent_close();
            }));
            if prevent_result.is_ok() {
                let _ = window.hide();
            } else {
                tracing::warn!(
                    "CloseRequested: prevent_close panicked, allowing close during terminate flow"
                );
            }
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub fn handle_window_event<R: tauri::Runtime>(
    _window: &tauri::Window<R>,
    _event: &tauri::WindowEvent,
) {
}

#[cfg(target_os = "macos")]
pub fn handle_run_event(app_handle: &tauri::AppHandle, event: tauri::RunEvent) {
    match event {
        tauri::RunEvent::ExitRequested { .. } => {
            macos::mark_app_quit_requested();
        }
        tauri::RunEvent::Reopen { .. } => {
            show_main_window(app_handle);
        }
        _ => {}
    }
}

#[cfg(not(target_os = "macos"))]
pub fn handle_run_event(_app_handle: &tauri::AppHandle, _event: tauri::RunEvent) {}
