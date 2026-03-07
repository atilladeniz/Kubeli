#[cfg(target_os = "macos")]
mod macos;

use std::path::{Path, PathBuf};
use std::process::Command;
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
pub fn restart_app() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        macos::mark_app_quit_requested();
    }

    let current_exe =
        std::env::current_exe().map_err(|error| format!("Failed to resolve app path: {error}"))?;

    restart_process(&current_exe)
}

#[tauri::command]
pub fn show_main_window_command(app: tauri::AppHandle) {
    show_main_window(&app);
    #[cfg(target_os = "macos")]
    macos::hide_popup(&app);
}

fn restart_process(current_exe: &Path) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let mut command = if let Some(app_bundle) = macos_app_bundle_path(current_exe) {
            let mut command = Command::new("/usr/bin/open");
            command.arg("-n").arg(app_bundle);
            command
        } else {
            Command::new(current_exe)
        };

        command
            .spawn()
            .map_err(|error| format!("Failed to relaunch app: {error}"))?;

        extern "C" {
            fn _exit(status: i32) -> !;
        }

        unsafe { _exit(0) };
    }

    #[cfg(not(target_os = "macos"))]
    {
        Command::new(current_exe)
            .spawn()
            .map_err(|error| format!("Failed to relaunch app: {error}"))?;
        std::process::exit(0);
    }
}

#[cfg(target_os = "macos")]
fn macos_app_bundle_path(current_exe: &Path) -> Option<PathBuf> {
    let contents_dir = current_exe.parent()?.parent()?;
    if contents_dir.file_name()? != "Contents" {
        return None;
    }

    let app_bundle = contents_dir.parent()?;
    (app_bundle.extension()? == "app").then(|| app_bundle.to_path_buf())
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

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::macos_app_bundle_path;
    use std::path::Path;

    #[test]
    fn finds_app_bundle_from_macos_executable_path() {
        let exe = Path::new("/Applications/Kubeli.app/Contents/MacOS/kubeli");
        assert_eq!(
            macos_app_bundle_path(exe).as_deref(),
            Some(Path::new("/Applications/Kubeli.app"))
        );
    }

    #[test]
    fn ignores_non_bundle_paths() {
        let exe = Path::new("/Users/atilla/Github/Kubeli/src-tauri/target/release/kubeli");
        assert!(macos_app_bundle_path(exe).is_none());
    }
}
