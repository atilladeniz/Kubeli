mod appearance;
mod popup;
mod state;

use self::appearance::setup_appearance_observer;
use self::popup::install_popup_event_handlers;
use self::state::TRAY_APP_HANDLE;
use objc::{msg_send, sel, sel_impl};
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
    unsafe {
        if let Some(ns_application) = objc::runtime::Class::get("NSApplication") {
            let ns_app: cocoa::base::id = msg_send![ns_application, sharedApplication];
            let _: () = msg_send![ns_app, activateIgnoringOtherApps: objc::runtime::YES];
        } else {
            tracing::warn!("NSApplication class not available during show_main_window");
        }
    }
}

#[allow(deprecated)]
pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
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

    configure_macos_popup(&popup);

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

#[allow(deprecated)]
fn ensure_tray_panel_class() -> Option<*const objc::runtime::Class> {
    use self::popup::now_ms;
    use objc::runtime::{Class, Object, Sel, BOOL, NO, YES};

    if let Some(existing) = Class::get("KubeliTrayPanel") {
        return Some(existing as *const _);
    }

    let superclass = Class::get("NSPanel")?;
    let mut decl = objc::declare::ClassDecl::new("KubeliTrayPanel", superclass)?;

    extern "C" fn can_become_key_window(_: &Object, _: Sel) -> BOOL {
        YES
    }

    extern "C" fn can_become_main_window(_: &Object, _: Sel) -> BOOL {
        NO
    }

    extern "C" fn is_nonactivating_panel(_: &Object, _: Sel) -> BOOL {
        YES
    }

    #[allow(deprecated)]
    extern "C" fn cancel_operation(this: &Object, _: Sel, _sender: cocoa::base::id) {
        use crate::app::tray::macos::popup::set_tray_highlight;
        use crate::app::tray::macos::state::LAST_POPUP_HIDE_MS;
        use std::sync::atomic::Ordering;

        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| unsafe {
            LAST_POPUP_HIDE_MS.store(now_ms(), Ordering::Relaxed);
            let _: () = msg_send![this, orderOut: cocoa::base::nil];
            set_tray_highlight(false);
        }));
    }

    unsafe {
        decl.add_method(
            sel!(canBecomeKeyWindow),
            can_become_key_window as extern "C" fn(&Object, Sel) -> BOOL,
        );
        decl.add_method(
            sel!(canBecomeMainWindow),
            can_become_main_window as extern "C" fn(&Object, Sel) -> BOOL,
        );
        decl.add_method(
            sel!(_isNonactivatingPanel),
            is_nonactivating_panel as extern "C" fn(&Object, Sel) -> BOOL,
        );
        decl.add_method(
            sel!(cancelOperation:),
            cancel_operation as extern "C" fn(&Object, Sel, cocoa::base::id),
        );
    }

    let registered = decl.register();
    Some(registered as *const _)
}

#[allow(deprecated)]
fn configure_macos_popup(popup: &tauri::WebviewWindow) {
    use cocoa::appkit::{NSWindow, NSWindowCollectionBehavior};
    use cocoa::base::id;

    extern "C" {
        fn object_setClass(
            obj: *mut objc::runtime::Object,
            cls: *const objc::runtime::Class,
        ) -> *const objc::runtime::Class;
    }

    unsafe {
        let ns_win = popup.ns_window().unwrap() as id;

        if let Some(panel_class) = ensure_tray_panel_class() {
            object_setClass(ns_win as *mut _, panel_class);
            tracing::info!("Tray popup: ISA-swizzled NSWindow -> KubeliTrayPanel");
        } else {
            tracing::warn!("KubeliTrayPanel class not available, popup may not behave correctly");
        }

        let nonactivating_mask = 1u64 << 7;
        let mask: u64 = msg_send![ns_win, styleMask];
        let _: () = msg_send![ns_win, setStyleMask: mask | nonactivating_mask];

        let responds_set_prevents_activation: objc::runtime::BOOL =
            msg_send![ns_win, respondsToSelector: sel!(_setPreventsActivation:)];
        if responds_set_prevents_activation == objc::runtime::YES {
            let _: () = msg_send![ns_win, _setPreventsActivation: objc::runtime::YES];
        }

        let _: () = msg_send![ns_win, setFloatingPanel: objc::runtime::YES];
        let _: () = msg_send![ns_win, setWorksWhenModal: objc::runtime::YES];
        let _: () = msg_send![ns_win, setBecomesKeyOnlyIfNeeded: objc::runtime::NO];

        ns_win.setLevel_(101);
        ns_win.setCollectionBehavior_(
            NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
                | NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary
                | NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary
                | NSWindowCollectionBehavior::NSWindowCollectionBehaviorIgnoresCycle,
        );
    }
}
