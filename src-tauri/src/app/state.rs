use crate::ai::agent_manager::AgentManager;
use crate::ai::commands::AIConfigState;
use crate::ai::session_store::create_session_store;
use crate::commands::logs::LogStreamManager;
use crate::commands::portforward::{PortForwardManager, PortForwardWatchManager};
use crate::commands::shell::ShellSessionManager;
use crate::commands::watch::WatchManager;
use crate::k8s::AppState;
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
}

pub fn initialize_ai_session_store(app: &mut tauri::App) {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data directory");
    let db_path = app_data_dir.join("ai_sessions.db");
    let session_store = create_session_store(db_path).expect("Failed to create session store");
    app.manage(session_store);
}
