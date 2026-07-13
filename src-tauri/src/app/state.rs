use crate::ai::agent_manager::AgentManager;
use crate::ai::commands::AIConfigState;
use crate::ai::session_store::create_session_store;
use crate::app::setup::deep_links::StartupDeepLinks;
use crate::commands::logs::LogStreamManager;
use crate::commands::portforward::{PortForwardManager, PortForwardWatchManager};
use crate::commands::shell::ShellSessionManager;
use crate::commands::watch::WatchManager;
use crate::k8s::AppState;
use crate::oidc::commands::OidcState;
use std::sync::Arc;
use tauri::Manager;

pub fn register(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder
        .manage(AppState::new())
        .manage(Arc::new(WatchManager::new()))
        .manage(Arc::new(LogStreamManager::new()))
        .manage(Arc::new(ShellSessionManager::new()))
        .manage(Arc::new(PortForwardManager::new()))
        .manage(Arc::new(PortForwardWatchManager::new()))
        .manage(AIConfigState::new())
        .manage(Arc::new(AgentManager::new()))
        .manage(Arc::new(OidcState::default()))
        .manage(StartupDeepLinks::default())
}

pub fn initialize_ai_session_store(app: &mut tauri::App) {
    // Never crash the app over the AI session store: fall back to an
    // in-memory database (sessions just won't persist across restarts).
    let db_path = match app.path().app_data_dir() {
        Ok(dir) => dir.join("ai_sessions.db"),
        Err(e) => {
            tracing::error!(
                "Failed to get app data directory: {e}; using in-memory AI session store"
            );
            std::path::PathBuf::from(":memory:")
        }
    };
    let session_store = match create_session_store(db_path.clone()) {
        Ok(store) => store,
        Err(e) => {
            tracing::error!(
                "Failed to create AI session store at {:?}: {e}; using in-memory store",
                db_path
            );
            match create_session_store(std::path::PathBuf::from(":memory:")) {
                Ok(store) => store,
                Err(e) => {
                    tracing::error!("Failed to create in-memory AI session store: {e}");
                    return;
                }
            }
        }
    };
    app.manage(session_store);
}
