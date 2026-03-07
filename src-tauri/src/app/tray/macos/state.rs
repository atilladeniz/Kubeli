use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::OnceLock;

pub static LAST_POPUP_HIDE_MS: AtomicU64 = AtomicU64::new(0);
pub static TRAY_APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();
pub static LIGHT_NS_IMAGE: AtomicUsize = AtomicUsize::new(0);
pub static DARK_NS_IMAGE: AtomicUsize = AtomicUsize::new(0);
pub static TRAY_BUTTON_PTR: AtomicUsize = AtomicUsize::new(0);
pub static ORIGINAL_HIGHLIGHT_IMP: AtomicUsize = AtomicUsize::new(0);
pub static ALLOW_TRAY_HIGHLIGHT: AtomicBool = AtomicBool::new(false);
pub static APP_QUIT_REQUESTED: AtomicBool = AtomicBool::new(false);

pub fn app_quit_requested() -> bool {
    APP_QUIT_REQUESTED.load(Ordering::Relaxed)
}

pub fn mark_app_quit_requested() {
    APP_QUIT_REQUESTED.store(true, Ordering::Relaxed);
}
