#![allow(deprecated)]

use super::state::{ALLOW_TRAY_HIGHLIGHT, LAST_POPUP_HIDE_MS, TRAY_BUTTON_PTR};
use objc::{msg_send, sel, sel_impl};
use std::sync::atomic::Ordering;
use tauri::{Emitter, Manager};

pub fn hide_popup(app: &tauri::AppHandle) {
    if let Some(popup) = app.get_webview_window("tray-popup") {
        let _ = popup.hide();
    }
}

#[allow(deprecated)]
pub fn focus_popup(popup: &tauri::WebviewWindow) {
    unsafe {
        let ns_win = popup.ns_window().unwrap() as cocoa::base::id;
        let _: () = msg_send![ns_win, makeKeyAndOrderFront: cocoa::base::nil];
    }
}

#[allow(deprecated)]
pub fn set_tray_highlight(highlighted: bool) {
    let button_ptr = TRAY_BUTTON_PTR.load(Ordering::Relaxed);
    if button_ptr != 0 {
        ALLOW_TRAY_HIGHLIGHT.store(highlighted, Ordering::Relaxed);
        unsafe {
            let button = button_ptr as cocoa::base::id;
            let _: () = msg_send![button, highlight: highlighted];
        }
    }
}

pub fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[allow(deprecated)]
pub fn toggle_tray_popup(app: &tauri::AppHandle, rect: tauri::Rect) {
    let Some(popup) = app.get_webview_window("tray-popup") else {
        tracing::error!("tray-popup window not found");
        return;
    };

    if popup.is_visible().unwrap_or(false) {
        let _ = popup.hide();
        set_tray_highlight(false);
        return;
    }

    if now_ms() - LAST_POPUP_HIDE_MS.load(Ordering::Relaxed) < 500 {
        set_tray_highlight(false);
        return;
    }

    let popup_width = 360.0_f64;
    let popup_height = 480.0_f64;
    let margin = 8.0_f64;

    let (icon_x, icon_y) = match rect.position {
        tauri::Position::Physical(position) => (position.x as f64, position.y as f64),
        tauri::Position::Logical(position) => (position.x, position.y),
    };
    let (_icon_w, icon_h) = match rect.size {
        tauri::Size::Physical(size) => (size.width as f64, size.height as f64),
        tauri::Size::Logical(size) => (size.width, size.height),
    };

    let mut x = icon_x;
    let y = icon_y + icon_h + margin;

    if let Some(monitor) = popup.current_monitor().ok().flatten() {
        let mon_pos = monitor.position();
        let mon_size = monitor.size();
        let scale = monitor.scale_factor();
        let mon_left = mon_pos.x as f64;
        let mon_right = mon_left + mon_size.width as f64;

        if x + popup_width * scale > mon_right - margin {
            x = mon_right - popup_width * scale - margin;
        }
        if x < mon_left + margin {
            x = mon_left + margin;
        }

        let mon_top = mon_pos.y as f64;
        let mon_bottom = mon_top + mon_size.height as f64;
        let final_y = if y + popup_height * scale > mon_bottom - margin {
            icon_y - popup_height * scale - margin
        } else {
            y
        };

        tracing::info!("showing tray popup at physical ({}, {})", x, final_y);
        let _ = popup.set_position(tauri::PhysicalPosition::new(x as i32, final_y as i32));
    } else {
        tracing::info!(
            "showing tray popup at physical ({}, {}) (no monitor info)",
            x,
            y
        );
        let _ = popup.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
    }

    let _ = popup.eval("if(window.__applyThemeNoTransition)window.__applyThemeNoTransition()");
    let _ = popup.show();
    let _ = popup.emit("tray-popup-shown", ());
    set_tray_highlight(true);
    focus_popup(&popup);
}

pub fn install_popup_event_handlers(popup: &tauri::WebviewWindow) {
    let popup_clone = popup.clone();
    popup.on_window_event(move |event| {
        if let tauri::WindowEvent::Focused(false) = event {
            let popup = popup_clone.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(150));
                if !popup.is_focused().unwrap_or(true) {
                    LAST_POPUP_HIDE_MS.store(now_ms(), Ordering::Relaxed);
                    let _ = popup.hide();
                    set_tray_highlight(false);
                }
            });
        }
    });

    let popup_for_monitor = popup.clone();
    let handler = block::ConcreteBlock::new(move |_event: cocoa::base::id| {
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            if popup_for_monitor.is_visible().unwrap_or(false) {
                LAST_POPUP_HIDE_MS.store(now_ms(), Ordering::Relaxed);
                let _ = popup_for_monitor.hide();
                set_tray_highlight(false);
            }
        }));
    });
    let handler = handler.copy();

    unsafe {
        let mask: u64 = (1 << 1) | (1 << 3);
        let _: cocoa::base::id = msg_send![
            objc::runtime::Class::get("NSEvent").unwrap(),
            addGlobalMonitorForEventsMatchingMask: mask
            handler: &*handler
        ];
    }
    std::mem::forget(handler);

    let popup_for_local = popup.clone();
    let popup_ns_ptr = popup.ns_window().unwrap() as usize;

    let local_handler =
        block::ConcreteBlock::new(move |event: cocoa::base::id| -> cocoa::base::id {
            let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                if popup_for_local.is_visible().unwrap_or(false) {
                    unsafe {
                        let event_window: cocoa::base::id = msg_send![event, window];
                        if !event_window.is_null() && (event_window as usize) != popup_ns_ptr {
                            LAST_POPUP_HIDE_MS.store(now_ms(), Ordering::Relaxed);
                            let _ = popup_for_local.hide();
                            set_tray_highlight(false);
                        }
                    }
                }
            }));
            event
        });
    let local_handler = local_handler.copy();

    unsafe {
        let mask: u64 = (1 << 1) | (1 << 3);
        let _: cocoa::base::id = msg_send![
            objc::runtime::Class::get("NSEvent").unwrap(),
            addLocalMonitorForEventsMatchingMask: mask
            handler: &*local_handler
        ];
    }
    std::mem::forget(local_handler);
}
