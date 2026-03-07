use objc::{msg_send, sel, sel_impl};
use tauri::tray::{TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager};

static LAST_POPUP_HIDE_MS: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
static TRAY_APP_HANDLE: std::sync::OnceLock<tauri::AppHandle> = std::sync::OnceLock::new();
static LIGHT_NS_IMAGE: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
static DARK_NS_IMAGE: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
static TRAY_BUTTON_PTR: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
static ORIGINAL_HIGHLIGHT_IMP: std::sync::atomic::AtomicUsize =
    std::sync::atomic::AtomicUsize::new(0);
static ALLOW_TRAY_HIGHLIGHT: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);
static APP_QUIT_REQUESTED: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

pub fn app_quit_requested() -> bool {
    APP_QUIT_REQUESTED.load(std::sync::atomic::Ordering::Relaxed)
}

pub fn mark_app_quit_requested() {
    APP_QUIT_REQUESTED.store(true, std::sync::atomic::Ordering::Relaxed);
}

pub fn hide_popup(app: &tauri::AppHandle) {
    if let Some(popup) = app.get_webview_window("tray-popup") {
        let _ = popup.hide();
    }
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
pub fn focus_popup(popup: &tauri::WebviewWindow) {
    unsafe {
        let ns_win = popup.ns_window().unwrap() as cocoa::base::id;
        let _: () = msg_send![ns_win, makeKeyAndOrderFront: cocoa::base::nil];
    }
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

    if now_ms() - LAST_POPUP_HIDE_MS.load(std::sync::atomic::Ordering::Relaxed) < 500 {
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

    let popup_clone = popup.clone();
    popup.on_window_event(move |event| {
        if let tauri::WindowEvent::Focused(false) = event {
            let popup = popup_clone.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(150));
                if !popup.is_focused().unwrap_or(true) {
                    LAST_POPUP_HIDE_MS.store(now_ms(), std::sync::atomic::Ordering::Relaxed);
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
                LAST_POPUP_HIDE_MS.store(now_ms(), std::sync::atomic::Ordering::Relaxed);
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
                            LAST_POPUP_HIDE_MS
                                .store(now_ms(), std::sync::atomic::Ordering::Relaxed);
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

    let tray_icon =
        tauri::image::Image::from_bytes(include_bytes!("../../../icons/tray-icon@2x.png"))?;

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
                toggle_tray_popup(tray.app_handle(), rect);
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
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| unsafe {
            LAST_POPUP_HIDE_MS.store(now_ms(), std::sync::atomic::Ordering::Relaxed);
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

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

unsafe extern "C" fn swizzled_highlight(
    this: &objc::runtime::Object,
    sel: objc::runtime::Sel,
    flag: objc::runtime::BOOL,
) {
    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        if flag == objc::runtime::YES
            && !ALLOW_TRAY_HIGHLIGHT.load(std::sync::atomic::Ordering::Relaxed)
        {
            return;
        }
        let orig = ORIGINAL_HIGHLIGHT_IMP.load(std::sync::atomic::Ordering::Relaxed);
        if orig != 0 {
            let orig_fn: unsafe extern "C" fn(
                &objc::runtime::Object,
                objc::runtime::Sel,
                objc::runtime::BOOL,
            ) = std::mem::transmute(orig);
            unsafe { orig_fn(this, sel, flag) };
        }
    }));
}

#[allow(deprecated)]
fn set_tray_highlight(highlighted: bool) {
    let button_ptr = TRAY_BUTTON_PTR.load(std::sync::atomic::Ordering::Relaxed);
    if button_ptr != 0 {
        ALLOW_TRAY_HIGHLIGHT.store(highlighted, std::sync::atomic::Ordering::Relaxed);
        unsafe {
            let button = button_ptr as cocoa::base::id;
            let _: () = msg_send![button, highlight: highlighted];
        }
    }
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

fn update_tray_icon_via_tauri(is_dark: bool) {
    if let Some(app_handle) = TRAY_APP_HANDLE.get() {
        let bytes: &[u8] = if is_dark {
            include_bytes!("../../../icons/tray-icon-dark@2x.png")
        } else {
            include_bytes!("../../../icons/tray-icon@2x.png")
        };
        if let Ok(icon) = tauri::image::Image::from_bytes(bytes) {
            if let Some(tray) = app_handle.tray_by_id("kubeli-tray") {
                let _ = tray.set_icon(Some(icon));
                let _ = tray.set_icon_as_template(true);
            }
        }
    }
}

#[allow(deprecated)]
fn update_tray_icon_direct(is_dark: bool) {
    let image_ptr = if is_dark {
        DARK_NS_IMAGE.load(std::sync::atomic::Ordering::Relaxed)
    } else {
        LIGHT_NS_IMAGE.load(std::sync::atomic::Ordering::Relaxed)
    };
    let button_ptr = TRAY_BUTTON_PTR.load(std::sync::atomic::Ordering::Relaxed);
    if image_ptr != 0 && button_ptr != 0 {
        unsafe {
            let button = button_ptr as cocoa::base::id;
            let image = image_ptr as cocoa::base::id;
            let _: () = msg_send![button, setImage: image];
        }
    }
}

#[allow(deprecated)]
fn setup_appearance_observer(status_item_ptr: usize) {
    use cocoa::base::{id, nil};
    use objc::runtime::Class;

    unsafe {
        let icon_height: f64 = 18.0;
        let icon_width: f64 = (81.0 / 88.0) * icon_height;

        let load_ns_image = |bytes: &[u8]| -> usize {
            let data: id = msg_send![
                Class::get("NSData").unwrap(),
                dataWithBytes: bytes.as_ptr()
                length: bytes.len()
            ];
            let alloc: id = msg_send![Class::get("NSImage").unwrap(), alloc];
            let img: id = msg_send![alloc, initWithData: data];
            let size = cocoa::foundation::NSSize::new(icon_width, icon_height);
            let _: () = msg_send![img, setSize: size];
            let _: () = msg_send![img, setTemplate: objc::runtime::YES];
            let _: id = msg_send![img, retain];
            img as usize
        };

        LIGHT_NS_IMAGE.store(
            load_ns_image(include_bytes!("../../../icons/tray-icon@2x.png")),
            std::sync::atomic::Ordering::Relaxed,
        );
        DARK_NS_IMAGE.store(
            load_ns_image(include_bytes!("../../../icons/tray-icon-dark@2x.png")),
            std::sync::atomic::Ordering::Relaxed,
        );
        tracing::info!(
            "[TRAY] Pre-loaded icons: light={:#x}, dark={:#x}",
            LIGHT_NS_IMAGE.load(std::sync::atomic::Ordering::Relaxed),
            DARK_NS_IMAGE.load(std::sync::atomic::Ordering::Relaxed),
        );

        let mut found_button: id = nil;

        if status_item_ptr != 0 {
            let status_item = status_item_ptr as id;
            let button: id = msg_send![status_item, button];
            if !button.is_null() {
                found_button = button;
                TRAY_BUTTON_PTR.store(button as usize, std::sync::atomic::Ordering::Relaxed);
                if let Some(btn_class) = Class::get("NSStatusBarButton") {
                    extern "C" {
                        fn class_getInstanceMethod(
                            cls: *const objc::runtime::Class,
                            sel: objc::runtime::Sel,
                        ) -> *const std::ffi::c_void;
                        fn method_getImplementation(
                            method: *const std::ffi::c_void,
                        ) -> *const std::ffi::c_void;
                        fn method_setImplementation(
                            method: *const std::ffi::c_void,
                            imp: *const std::ffi::c_void,
                        ) -> *const std::ffi::c_void;
                    }
                    let method = class_getInstanceMethod(btn_class as *const _, sel!(highlight:));
                    if !method.is_null() {
                        let orig = method_getImplementation(method);
                        ORIGINAL_HIGHLIGHT_IMP
                            .store(orig as usize, std::sync::atomic::Ordering::Relaxed);
                        let new_imp = swizzled_highlight
                            as unsafe extern "C" fn(
                                &objc::runtime::Object,
                                objc::runtime::Sel,
                                objc::runtime::BOOL,
                            );
                        method_setImplementation(method, new_imp as *const std::ffi::c_void);
                        tracing::info!("[TRAY] Swizzled highlight: on NSStatusBarButton");
                    }
                }
                tracing::info!(
                    "[TRAY] Got NSStatusBarButton via ns_status_item(), ptr={:#x}",
                    button as usize
                );
            } else {
                tracing::warn!("[TRAY] ns_status_item().button was null");
            }
        } else {
            tracing::warn!("[TRAY] No status_item_ptr, direct icon swap unavailable");
        }

        let observe_button = if !found_button.is_null() {
            found_button
        } else {
            tracing::info!("[TRAY] Creating hidden observer for KVO fallback");
            let status_bar: id = msg_send![Class::get("NSStatusBar").unwrap(), systemStatusBar];
            let observer_item: id = msg_send![status_bar, statusItemWithLength: 0.0f64];
            let _: id = msg_send![observer_item, retain];
            msg_send![observer_item, button]
        };

        if observe_button.is_null() {
            tracing::warn!("[TRAY] Appearance observer: no button available");
            return;
        }

        let appearance: id = msg_send![observe_button, effectiveAppearance];
        let name: id = msg_send![appearance, name];
        let dark_str: id = msg_send![
            Class::get("NSString").unwrap(),
            stringWithUTF8String: c"Dark".as_ptr()
        ];
        let is_dark: bool = msg_send![name, containsString: dark_str];
        tracing::info!("[TRAY] Initial menu bar appearance: is_dark={}", is_dark);

        if !found_button.is_null() {
            let image_ptr = if is_dark {
                DARK_NS_IMAGE.load(std::sync::atomic::Ordering::Relaxed)
            } else {
                LIGHT_NS_IMAGE.load(std::sync::atomic::Ordering::Relaxed)
            };
            if image_ptr != 0 {
                let _: () = msg_send![found_button, setImage: image_ptr as id];
            }
        } else {
            update_tray_icon_via_tauri(is_dark);
        }

        let superclass = Class::get("NSObject").unwrap();
        if let Some(mut decl) =
            objc::declare::ClassDecl::new("KubeliAppearanceObserver", superclass)
        {
            extern "C" fn observe_value(
                _this: &objc::runtime::Object,
                _sel: objc::runtime::Sel,
                _key_path: cocoa::base::id,
                object: cocoa::base::id,
                _change: cocoa::base::id,
                _context: *mut std::ffi::c_void,
            ) {
                let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| unsafe {
                    let ap: cocoa::base::id = msg_send![object, effectiveAppearance];
                    let ap_name: cocoa::base::id = msg_send![ap, name];
                    let Some(ns_string_class) = objc::runtime::Class::get("NSString") else {
                        tracing::warn!("KVO observer: NSString class unavailable");
                        return;
                    };
                    let dark: cocoa::base::id =
                        msg_send![ns_string_class, stringWithUTF8String: c"Dark".as_ptr()];
                    let is_dark: bool = msg_send![ap_name, containsString: dark];
                    tracing::info!("[TRAY] KVO: appearance changed, is_dark={}", is_dark);

                    let button_ptr = TRAY_BUTTON_PTR.load(std::sync::atomic::Ordering::Relaxed);
                    if button_ptr != 0 {
                        update_tray_icon_direct(is_dark);
                    } else {
                        update_tray_icon_via_tauri(is_dark);
                    }
                }));
            }

            decl.add_method(
                sel!(observeValueForKeyPath:ofObject:change:context:),
                observe_value
                    as extern "C" fn(
                        &objc::runtime::Object,
                        objc::runtime::Sel,
                        cocoa::base::id,
                        cocoa::base::id,
                        cocoa::base::id,
                        *mut std::ffi::c_void,
                    ),
            );

            let observer_class = decl.register();
            let observer: id = msg_send![observer_class, new];
            let _: id = msg_send![observer, retain];

            #[allow(deprecated)]
            use cocoa::foundation::NSString as _;
            #[allow(deprecated)]
            let key_path = cocoa::foundation::NSString::alloc(nil).init_str("effectiveAppearance");
            let _: () = msg_send![
                observe_button,
                addObserver: observer
                forKeyPath: key_path
                options: 1u64
                context: std::ptr::null_mut::<std::ffi::c_void>()
            ];

            tracing::info!(
                "[TRAY] Per-Space appearance observer active (direct button mode: {})",
                !found_button.is_null()
            );
        } else {
            tracing::warn!("KubeliAppearanceObserver class already exists");
        }
    }
}
