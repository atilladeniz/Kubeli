use crate::app::{plugins, setup, state, tray};

pub fn run() {
    state::register(plugins::configure(tauri::Builder::default()))
        .setup(setup::configure)
        .on_menu_event(tray::handle_menu_event)
        .invoke_handler(crate::app::command_registry::handler())
        .on_window_event(tray::handle_window_event)
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(tray::handle_run_event);
}
