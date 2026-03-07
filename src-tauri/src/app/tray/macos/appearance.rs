use super::state::{
    ALLOW_TRAY_HIGHLIGHT, DARK_NS_IMAGE, LIGHT_NS_IMAGE, ORIGINAL_HIGHLIGHT_IMP, TRAY_APP_HANDLE,
    TRAY_BUTTON_PTR,
};
use objc::{msg_send, sel, sel_impl};
use std::sync::atomic::Ordering;

pub unsafe extern "C" fn swizzled_highlight(
    this: &objc::runtime::Object,
    sel: objc::runtime::Sel,
    flag: objc::runtime::BOOL,
) {
    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        if flag == objc::runtime::YES && !ALLOW_TRAY_HIGHLIGHT.load(Ordering::Relaxed) {
            return;
        }
        let orig = ORIGINAL_HIGHLIGHT_IMP.load(Ordering::Relaxed);
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

fn update_tray_icon_via_tauri(is_dark: bool) {
    if let Some(app_handle) = TRAY_APP_HANDLE.get() {
        let bytes: &[u8] = if is_dark {
            include_bytes!("../../../../icons/tray-icon-dark@2x.png")
        } else {
            include_bytes!("../../../../icons/tray-icon@2x.png")
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
        DARK_NS_IMAGE.load(Ordering::Relaxed)
    } else {
        LIGHT_NS_IMAGE.load(Ordering::Relaxed)
    };
    let button_ptr = TRAY_BUTTON_PTR.load(Ordering::Relaxed);
    if image_ptr != 0 && button_ptr != 0 {
        unsafe {
            let button = button_ptr as cocoa::base::id;
            let image = image_ptr as cocoa::base::id;
            let _: () = msg_send![button, setImage: image];
        }
    }
}

#[allow(deprecated)]
pub fn setup_appearance_observer(status_item_ptr: usize) {
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
            load_ns_image(include_bytes!("../../../../icons/tray-icon@2x.png")),
            Ordering::Relaxed,
        );
        DARK_NS_IMAGE.store(
            load_ns_image(include_bytes!("../../../../icons/tray-icon-dark@2x.png")),
            Ordering::Relaxed,
        );
        tracing::info!(
            "[TRAY] Pre-loaded icons: light={:#x}, dark={:#x}",
            LIGHT_NS_IMAGE.load(Ordering::Relaxed),
            DARK_NS_IMAGE.load(Ordering::Relaxed),
        );

        let mut found_button: id = nil;

        if status_item_ptr != 0 {
            let status_item = status_item_ptr as id;
            let button: id = msg_send![status_item, button];
            if !button.is_null() {
                found_button = button;
                TRAY_BUTTON_PTR.store(button as usize, Ordering::Relaxed);
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
                        ORIGINAL_HIGHLIGHT_IMP.store(orig as usize, Ordering::Relaxed);
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
                DARK_NS_IMAGE.load(Ordering::Relaxed)
            } else {
                LIGHT_NS_IMAGE.load(Ordering::Relaxed)
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

                    let button_ptr = TRAY_BUTTON_PTR.load(Ordering::Relaxed);
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
