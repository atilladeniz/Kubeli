use crate::app::tray::macos::popup::{now_ms, set_tray_highlight};
use crate::app::tray::macos::state::LAST_POPUP_HIDE_MS;
use objc::{msg_send, sel, sel_impl};

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
pub fn configure_popup(popup: &tauri::WebviewWindow) {
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

#[allow(deprecated)]
fn ensure_tray_panel_class() -> Option<*const objc::runtime::Class> {
    use objc::runtime::{Class, Object, Sel, BOOL, NO, YES};
    use std::sync::atomic::Ordering;

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
