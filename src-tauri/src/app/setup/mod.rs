mod deep_links;
mod menu;

use crate::app::state;

pub fn configure(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    state::initialize_ai_session_store(app);

    #[cfg(target_os = "macos")]
    {
        if let Err(error) = crate::app::tray::setup(app) {
            tracing::error!("Failed to setup tray icon: {}", error);
        }
    }

    #[cfg(target_os = "macos")]
    menu::setup_macos_menu(app)?;

    #[cfg(desktop)]
    deep_links::setup_deep_links(app);

    Ok(())
}
