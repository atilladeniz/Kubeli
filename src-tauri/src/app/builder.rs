use crate::app::commands::generate_app_handler;
use crate::app::{plugins, setup, state, tray};

pub fn run() {
    state::register(plugins::configure(tauri::Builder::default()))
        .setup(setup::configure)
        .on_menu_event(|app, event| tray::handle_menu_event(app, event))
        .invoke_handler(generate_app_handler!())
        .on_window_event(|window, event| tray::handle_window_event(window, event))
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| tray::handle_run_event(app_handle, event));
}
