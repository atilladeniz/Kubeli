mod appearance;
mod native;
mod popup;
mod state;

use self::appearance::setup_appearance_observer;
use self::popup::install_popup_event_handlers;
use self::state::TRAY_APP_HANDLE;
use tauri::tray::{TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

pub fn app_quit_requested() -> bool {
    self::state::app_quit_requested()
}

pub fn mark_app_quit_requested() {
    self::state::mark_app_quit_requested();
}

pub fn hide_popup(app: &tauri::AppHandle) {
    self::popup::hide_popup(app);
}

#[allow(deprecated)]
pub fn activate_app() {
    self::native::activate_app();
}

#[allow(deprecated)]
pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use objc::{msg_send, sel, sel_impl};
    use tauri::webview::WebviewWindowBuilder;

    let popup = if let Some(window) = app.get_webview_window("tray-popup") {
        window
    } else {
        tracing::warn!("tray-popup not in config, creating programmatically");
        WebviewWindowBuilder::new(app, "tray-popup", tauri::WebviewUrl::App("/".into()))
            .title("")
            .inner_size(360.0, 480.0)
            .resizable(false)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .visible(false)
            .skip_taskbar(true)
            .focused(true)
            .build()?
    };

    self::native::configure_popup(&popup);

    let _ = popup.set_position(tauri::PhysicalPosition::new(-9999, -9999));
    let _ = popup.hide();
    unsafe {
        let ns_win = popup.ns_window().unwrap() as cocoa::base::id;
        let _: () = msg_send![ns_win, orderOut: cocoa::base::nil];
    }

    install_popup_event_handlers(&popup);

    let tray_icon =
        tauri::image::Image::from_bytes(include_bytes!("../../../../icons/tray-icon@2x.png"))?;

    let tray = TrayIconBuilder::with_id("kubeli-tray")
        .icon(tray_icon)
        .icon_as_template(true)
        .tooltip("Kubeli")
        .on_tray_icon_event(|tray: &TrayIcon, event: TrayIconEvent| {
            if let TrayIconEvent::Click {
                button_state: tauri::tray::MouseButtonState::Up,
                rect,
                ..
            } = event
            {
                self::popup::toggle_tray_popup(tray.app_handle(), rect);
            }
        })
        .build(app)?;

    let _ = TRAY_APP_HANDLE.set(app.handle().clone());

    let status_item_ptr = tray
        .with_inner_tray_icon(|inner| {
            if let Some(item) = inner.ns_status_item() {
                let raw: usize = unsafe { std::mem::transmute_copy(&item) };
                std::mem::forget(item);
                raw
            } else {
                0usize
            }
        })
        .unwrap_or(0);

    tracing::info!(
        "[TRAY] NSStatusItem ptr from ns_status_item(): {:#x}",
        status_item_ptr
    );
    setup_appearance_observer(status_item_ptr);

    Ok(())
}
