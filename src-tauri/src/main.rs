// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// objc 0.2 macros use cfg(feature = "cargo-clippy") internally
#![allow(unexpected_cfgs)]

mod ai;
mod commands;
mod error;
mod k8s;
mod mcp;
mod network;

use ai::agent_manager::AgentManager;
use ai::commands::AIConfigState;
use ai::session_store::create_session_store;
use clap::Parser;
use commands::logs::LogStreamManager;
use commands::portforward::{PortForwardManager, PortForwardWatchManager};
use commands::shell::ShellSessionManager;
use commands::watch::WatchManager;
use k8s::AppState;
use std::env;
use std::sync::Arc;

/// Kubeli - Modern Kubernetes Management Desktop Application
#[derive(Parser, Debug)]
#[command(name = "kubeli")]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Run as MCP (Model Context Protocol) server for IDE integration
    #[arg(long)]
    mcp: bool,
}
#[cfg(target_os = "macos")]
use objc::{msg_send, sel, sel_impl};
#[cfg(target_os = "macos")]
use tauri::menu::{AboutMetadataBuilder, MenuBuilder, SubmenuBuilder};
use tauri::tray::{TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::webview::WebviewWindowBuilder;
#[allow(unused_imports)]
use tauri::{Emitter, Manager};

fn extend_path_with_common_cli_dirs() {
    use std::path::PathBuf;

    let mut paths: Vec<PathBuf> =
        env::split_paths(&env::var_os("PATH").unwrap_or_default()).collect();

    #[cfg(target_os = "macos")]
    const EXTRA_PATHS: &[&str] = &["/opt/homebrew/bin", "/usr/local/bin"];
    #[cfg(target_os = "linux")]
    const EXTRA_PATHS: &[&str] = &["/usr/local/bin"];
    #[cfg(target_os = "windows")]
    const EXTRA_PATHS: &[&str] = &[];

    let mut updated = false;
    for dir in EXTRA_PATHS {
        let candidate = PathBuf::from(dir);
        if candidate.exists() && !paths.iter().any(|p| p == &candidate) {
            paths.push(candidate);
            updated = true;
        }
    }

    if updated {
        if let Ok(joined) = env::join_paths(paths.clone()) {
            env::set_var("PATH", &joined);
            tracing::info!("Extended PATH with common CLI directories to support exec auth");
        }
    }
}

/// Timestamp (ms since UNIX epoch) of the last auto-hide by event monitors.
/// Used to debounce: if the popup was just hidden by a click that also triggered
/// the tray icon event, we don't reopen it.
static LAST_POPUP_HIDE_MS: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// App handle for the Tauri API fallback path.
#[cfg(target_os = "macos")]
static TRAY_APP_HANDLE: std::sync::OnceLock<tauri::AppHandle> = std::sync::OnceLock::new();

/// Pre-loaded NSImage pointers (retained, template=YES) for instant icon swaps.
#[cfg(target_os = "macos")]
static LIGHT_NS_IMAGE: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
#[cfg(target_os = "macos")]
static DARK_NS_IMAGE: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
/// Pointer to Kubeli's NSStatusBarButton for direct `setImage:` calls.
#[cfg(target_os = "macos")]
static TRAY_BUTTON_PTR: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
/// Original `highlight:` IMP before swizzle, stored as usize.
#[cfg(target_os = "macos")]
static ORIGINAL_HIGHLIGHT_IMP: std::sync::atomic::AtomicUsize =
    std::sync::atomic::AtomicUsize::new(0);
/// Gate for the swizzled `highlight:` — only allows highlight when popup is open.
#[cfg(target_os = "macos")]
static ALLOW_TRAY_HIGHLIGHT: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

/// Ensure a custom NSPanel subclass exists that can become key.
/// Some borderless/non-activating panel setups report `canBecomeKeyWindow = NO`,
/// which blocks keyboard input in embedded webviews.
#[cfg(target_os = "macos")]
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

    // Private selector used by AppKit for nonactivating panel behavior.
    extern "C" fn is_nonactivating_panel(_: &Object, _: Sel) -> BOOL {
        YES
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

/// Swizzled replacement for `[NSStatusBarButton highlight:]`.
/// Suppresses the automatic mouseDown highlight — only allows highlight
/// when `ALLOW_TRAY_HIGHLIGHT` is true (i.e., popup is open).
/// Un-highlight (flag=NO) always passes through.
#[cfg(target_os = "macos")]
unsafe extern "C" fn swizzled_highlight(
    this: &objc::runtime::Object,
    sel: objc::runtime::Sel,
    flag: objc::runtime::BOOL,
) {
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
        orig_fn(this, sel, flag);
    }
}

/// Set the tray button's highlight state. Opens the swizzle gate before calling
/// `highlight:` so our swizzled method allows it through.
#[cfg(target_os = "macos")]
#[allow(deprecated)] // cocoa 0.26 types deprecated in favor of objc2
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
fn toggle_tray_popup(app: &tauri::AppHandle, rect: tauri::Rect) {
    let Some(popup) = app.get_webview_window("tray-popup") else {
        tracing::error!("tray-popup window not found");
        return;
    };

    if popup.is_visible().unwrap_or(false) {
        let _ = popup.hide();
        #[cfg(target_os = "macos")]
        set_tray_highlight(false);
        return;
    }

    // Debounce: if popup was auto-hidden within the last 500ms (by global/local
    // event monitor from the same click that triggered this tray event), treat
    // as toggle-off and don't reopen.
    if now_ms() - LAST_POPUP_HIDE_MS.load(std::sync::atomic::Ordering::Relaxed) < 500 {
        #[cfg(target_os = "macos")]
        set_tray_highlight(false);
        return;
    }

    let popup_width = 360.0_f64;
    let popup_height = 480.0_f64;
    let margin = 8.0_f64;

    // Use the physical icon position from the tray event
    let (icon_x, icon_y) = match rect.position {
        tauri::Position::Physical(p) => (p.x as f64, p.y as f64),
        tauri::Position::Logical(p) => (p.x, p.y),
    };
    let (_icon_w, icon_h) = match rect.size {
        tauri::Size::Physical(s) => (s.width as f64, s.height as f64),
        tauri::Size::Logical(s) => (s.width, s.height),
    };

    // Left-align popup with the tray icon (like native macOS menu bar popups)
    let mut x = icon_x;
    let y = icon_y + icon_h + margin;

    // Clamp to screen bounds so the popup doesn't get cut off at edges
    if let Some(monitor) = popup.current_monitor().ok().flatten() {
        let mon_pos = monitor.position();
        let mon_size = monitor.size();
        let scale = monitor.scale_factor();
        let mon_left = mon_pos.x as f64;
        let mon_right = mon_left + mon_size.width as f64;

        // Ensure popup doesn't extend past the right edge
        if x + popup_width * scale > mon_right - margin {
            x = mon_right - popup_width * scale - margin;
        }
        // Ensure popup doesn't extend past the left edge
        if x < mon_left + margin {
            x = mon_left + margin;
        }

        // If popup would go below screen, show above tray icon instead
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

    let _ = popup.show();
    // Re-assert highlight after show — macOS resets isHighlighted on mouseUp,
    // so the mouseDown highlight alone isn't enough. Both are needed:
    // mouseDown prevents the flicker, this re-asserts after macOS resets it.
    #[cfg(target_os = "macos")]
    set_tray_highlight(true);
    // On macOS, use makeKeyAndOrderFront: directly instead of Tauri's set_focus().
    // Tauri's set_focus() calls [NSApp activateIgnoringOtherApps:YES] which activates
    // the whole app, causing a space switch away from the fullscreen app.
    // For our NSPanel with NonactivatingPanelMask, makeKeyAndOrderFront: makes the
    // panel key (for keyboard input) without activating the app.
    #[cfg(target_os = "macos")]
    unsafe {
        #[allow(deprecated)]
        let ns_win = popup.ns_window().unwrap() as cocoa::base::id;
        let _: () = msg_send![ns_win, makeKeyAndOrderFront: cocoa::base::nil];
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = popup.set_focus();
    }
}

#[allow(deprecated)]
fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        // On macOS, explicitly activate the app since the tray popup uses
        // NonactivatingPanelMask, so the app may not be active
        #[cfg(target_os = "macos")]
        unsafe {
            let ns_app: cocoa::base::id = msg_send![
                objc::runtime::Class::get("NSApplication").unwrap(),
                sharedApplication
            ];
            let _: () = msg_send![ns_app, activateIgnoringOtherApps: objc::runtime::YES];
        }
    }
}

#[tauri::command]
fn show_main_window_command(app: tauri::AppHandle) {
    show_main_window(&app);
    // Also hide the tray popup
    if let Some(popup) = app.get_webview_window("tray-popup") {
        let _ = popup.hide();
    }
}

/// Configure the tray popup as a proper macOS NSPanel.
/// ISA-swizzles the NSWindow to NSPanel, sets NonactivatingPanelMask so the popup
/// doesn't steal app activation, and configures collection behavior for all Spaces +
/// fullscreen overlay. This fixes:
/// - Click-outside dismiss (including desktop clicks)
/// - Popup appearing above fullscreen apps
/// - Popup visible on all Spaces
#[cfg(target_os = "macos")]
#[allow(deprecated)]
fn configure_macos_popup(popup: &tauri::WebviewWindow) {
    #[allow(deprecated)]
    use cocoa::appkit::{NSWindow, NSWindowCollectionBehavior};
    #[allow(deprecated)]
    use cocoa::base::id;

    extern "C" {
        fn object_setClass(
            obj: *mut objc::runtime::Object,
            cls: *const objc::runtime::Class,
        ) -> *const objc::runtime::Class;
    }

    unsafe {
        #[allow(deprecated)]
        let ns_win = popup.ns_window().unwrap() as id;

        // ISA swizzle: convert NSWindow → custom NSPanel subclass.
        // We force `canBecomeKeyWindow = YES` to ensure text inputs in the webview
        // receive keyboard events while keeping non-activating popup behavior.
        if let Some(panel_class) = ensure_tray_panel_class() {
            object_setClass(ns_win as *mut _, panel_class);
            tracing::info!("Tray popup: ISA-swizzled NSWindow → KubeliTrayPanel");
        } else {
            tracing::warn!("KubeliTrayPanel class not available, popup may not behave correctly");
        }

        // Add NSNonactivatingPanelMask (1 << 7) — panel doesn't activate its owning app.
        // This means clicking the popup won't make "Kubeli" the active app,
        // so clicking outside (even on the desktop) properly dismisses it.
        let nonactivating_mask = 1u64 << 7;
        let mask: u64 = msg_send![ns_win, styleMask];
        let _: () = msg_send![ns_win, setStyleMask: mask | nonactivating_mask];

        // Tauri creates the window as NSWindow first; we then swizzle it to NSPanel and
        // apply NSNonactivatingPanelMask post-init. In that flow, AppKit can leave the
        // window-server "prevents activation" tag stale, which makes the panel appear key
        // but drop keyboard input. Force-sync the tag so text inputs (e.g. tray search)
        // receive keystrokes reliably.
        let responds_set_prevents_activation: objc::runtime::BOOL =
            msg_send![ns_win, respondsToSelector: sel!(_setPreventsActivation:)];
        if responds_set_prevents_activation == objc::runtime::YES {
            let _: () = msg_send![ns_win, _setPreventsActivation: objc::runtime::YES];
        }

        // NSPanel-specific properties
        let _: () = msg_send![ns_win, setFloatingPanel: objc::runtime::YES];
        let _: () = msg_send![ns_win, setWorksWhenModal: objc::runtime::YES];
        let _: () = msg_send![ns_win, setBecomesKeyOnlyIfNeeded: objc::runtime::NO];

        // NSPopUpMenuWindowLevel (101) — above menu bar, like native popups
        #[allow(deprecated)]
        ns_win.setLevel_(101);

        // Show on all Spaces and above fullscreen apps
        #[allow(deprecated)]
        ns_win.setCollectionBehavior_(
            NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
                | NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary
                | NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary
                | NSWindowCollectionBehavior::NSWindowCollectionBehaviorIgnoresCycle,
        );
    }
}

/// Fallback: update tray icon through Tauri API when button not found.
#[cfg(target_os = "macos")]
fn update_tray_icon_via_tauri(is_dark: bool) {
    if let Some(app_handle) = TRAY_APP_HANDLE.get() {
        let bytes: &[u8] = if is_dark {
            include_bytes!("../icons/tray-icon-dark@2x.png")
        } else {
            include_bytes!("../icons/tray-icon@2x.png")
        };
        if let Ok(icon) = tauri::image::Image::from_bytes(bytes) {
            if let Some(tray) = app_handle.tray_by_id("kubeli-tray") {
                let _ = tray.set_icon(Some(icon));
                let _ = tray.set_icon_as_template(true);
            }
        }
    }
}

/// Update the tray icon on the button directly using pre-loaded NSImages.
/// Single `setImage:` call — atomic, no blink.
#[cfg(target_os = "macos")]
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

/// Set up per-Space menu bar appearance detection with direct icon swapping.
///
/// Uses `ns_status_item()` (Tauri ≥2.8) to get the native NSStatusBarButton,
/// then KVO on `effectiveAppearance` triggers instant `setImage:` calls with
/// pre-loaded template NSImages — single atomic operation, no blink.
#[cfg(target_os = "macos")]
#[allow(deprecated)]
fn setup_appearance_observer(status_item_ptr: usize) {
    use cocoa::base::{id, nil};
    use objc::runtime::Class;

    unsafe {
        // ── Pre-load both icon variants as retained template NSImages ──────
        // Menu bar icon height is 22pt on macOS. Scale width proportionally.
        let icon_height: f64 = 18.0;
        let icon_width: f64 = (81.0 / 88.0) * icon_height; // match aspect ratio

        let load_ns_image = |bytes: &[u8]| -> usize {
            let data: id = msg_send![
                Class::get("NSData").unwrap(),
                dataWithBytes: bytes.as_ptr()
                length: bytes.len()
            ];
            let alloc: id = msg_send![Class::get("NSImage").unwrap(), alloc];
            let img: id = msg_send![alloc, initWithData: data];
            // Set point size for @2x image — without this, macOS uses pixel dimensions
            let size = cocoa::foundation::NSSize::new(icon_width, icon_height);
            let _: () = msg_send![img, setSize: size];
            let _: () = msg_send![img, setTemplate: objc::runtime::YES];
            let _: id = msg_send![img, retain];
            img as usize
        };

        LIGHT_NS_IMAGE.store(
            load_ns_image(include_bytes!("../icons/tray-icon@2x.png")),
            std::sync::atomic::Ordering::Relaxed,
        );
        DARK_NS_IMAGE.store(
            load_ns_image(include_bytes!("../icons/tray-icon-dark@2x.png")),
            std::sync::atomic::Ordering::Relaxed,
        );
        tracing::info!(
            "[TRAY] Pre-loaded icons: light={:#x}, dark={:#x}",
            LIGHT_NS_IMAGE.load(std::sync::atomic::Ordering::Relaxed),
            DARK_NS_IMAGE.load(std::sync::atomic::Ordering::Relaxed),
        );

        // ── Get NSStatusBarButton via ns_status_item() ─────────────────────
        let mut found_button: id = nil;

        if status_item_ptr != 0 {
            let status_item = status_item_ptr as id;
            let button: id = msg_send![status_item, button];
            if !button.is_null() {
                found_button = button;
                TRAY_BUTTON_PTR.store(button as usize, std::sync::atomic::Ordering::Relaxed);
                // Swizzle highlight: on NSStatusBarButton to suppress automatic
                // mouseDown highlight. We gate it via ALLOW_TRAY_HIGHLIGHT so only
                // our explicit set_tray_highlight(true) calls get through.
                if let Some(btn_class) = Class::get("NSStatusBarButton") {
                    extern "C" {
                        fn class_getInstanceMethod(
                            cls: *const objc::runtime::Class,
                            sel: objc::runtime::Sel,
                        ) -> *const std::ffi::c_void;
                        fn method_getImplementation(
                            m: *const std::ffi::c_void,
                        ) -> *const std::ffi::c_void;
                        fn method_setImplementation(
                            m: *const std::ffi::c_void,
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

        // ── KVO observe target: real button or hidden fallback ─────────────
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

        // ── Detect initial appearance ──────────────────────────────────────
        let appearance: id = msg_send![observe_button, effectiveAppearance];
        let name: id = msg_send![appearance, name];
        let dark_str: id = msg_send![
            Class::get("NSString").unwrap(),
            stringWithUTF8String: b"Dark\0".as_ptr()
        ];
        let is_dark: bool = msg_send![name, containsString: dark_str];
        tracing::info!("[TRAY] Initial menu bar appearance: is_dark={}", is_dark);

        // ── Set initial icon ───────────────────────────────────────────────
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

        // ── KVO observer on effectiveAppearance ────────────────────────────
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
                unsafe {
                    let ap: cocoa::base::id = msg_send![object, effectiveAppearance];
                    let ap_name: cocoa::base::id = msg_send![ap, name];
                    let dark: cocoa::base::id = msg_send![
                        objc::runtime::Class::get("NSString").unwrap(),
                        stringWithUTF8String: b"Dark\0".as_ptr()
                    ];
                    let is_dark: bool = msg_send![ap_name, containsString: dark];
                    tracing::info!("[TRAY] KVO: appearance changed, is_dark={}", is_dark);

                    // Direct setImage: on button — single atomic call, no blink
                    let button_ptr = TRAY_BUTTON_PTR.load(std::sync::atomic::Ordering::Relaxed);
                    if button_ptr != 0 {
                        update_tray_icon_direct(is_dark);
                    } else {
                        update_tray_icon_via_tauri(is_dark);
                    }
                }
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
                options: 1u64 // NSKeyValueObservingOptionNew
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

#[allow(deprecated)]
fn setup_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Get tray popup window (created from tauri.conf.json) or create fallback
    let popup = if let Some(w) = app.get_webview_window("tray-popup") {
        w
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

    // Configure native macOS popup behavior (window level, Spaces, fullscreen)
    #[cfg(target_os = "macos")]
    configure_macos_popup(&popup);

    // Auto-dismiss popup on focus loss (with delay to avoid flicker from tray click)
    let popup_clone = popup.clone();
    popup.on_window_event(move |event| {
        if let tauri::WindowEvent::Focused(false) = event {
            let p = popup_clone.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(150));
                if !p.is_focused().unwrap_or(true) {
                    LAST_POPUP_HIDE_MS.store(now_ms(), std::sync::atomic::Ordering::Relaxed);
                    let _ = p.hide();
                    #[cfg(target_os = "macos")]
                    set_tray_highlight(false);
                }
            });
        }
    });

    // Global event monitor: catches mouse clicks outside the app (including desktop clicks).
    // NSEvent.addGlobalMonitorForEventsMatchingMask fires ONLY for events delivered to
    // other applications, so clicks on our own popup are not affected.
    #[cfg(target_os = "macos")]
    {
        let popup_for_monitor = popup.clone();
        let handler = block::ConcreteBlock::new(move |_event: cocoa::base::id| {
            if popup_for_monitor.is_visible().unwrap_or(false) {
                LAST_POPUP_HIDE_MS.store(now_ms(), std::sync::atomic::Ordering::Relaxed);
                let _ = popup_for_monitor.hide();
                set_tray_highlight(false);
            }
        });
        let handler = handler.copy();

        unsafe {
            // NSLeftMouseDownMask (1 << 1) | NSRightMouseDownMask (1 << 3)
            let mask: u64 = (1 << 1) | (1 << 3);
            let _: cocoa::base::id = msg_send![
                objc::runtime::Class::get("NSEvent").unwrap(),
                addGlobalMonitorForEventsMatchingMask: mask
                handler: &*handler
            ];
        }
        // Keep the block alive for the app's lifetime
        std::mem::forget(handler);

        // Local event monitor: catches clicks on other windows within the same app
        // (e.g., clicking the main Kubeli window while the popup is open).
        let popup_for_local = popup.clone();
        let popup_ns_ptr = popup.ns_window().unwrap() as usize;

        let local_handler =
            block::ConcreteBlock::new(move |event: cocoa::base::id| -> cocoa::base::id {
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

    // Initial icon — the per-Space appearance observer will set the correct variant immediately.
    let tray_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray-icon@2x.png"))?;

    let _tray = TrayIconBuilder::with_id("kubeli-tray")
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

    // Set up per-Space menu bar appearance observer.
    // Uses with_inner_tray_icon() → ns_status_item() to get the native NSStatusBarButton
    // directly, bypassing unreliable tooltip-based window enumeration.
    #[cfg(target_os = "macos")]
    {
        let _ = TRAY_APP_HANDLE.set(app.handle().clone());

        // Get the raw NSStatusItem pointer from tray-icon's inner handle.
        // ns_status_item() returns Option<Retained<NSStatusItem>> (objc2 types).
        // We extract the raw pointer as usize to bridge to our objc 0.2 code.
        let status_item_ptr = _tray
            .with_inner_tray_icon(|inner| {
                if let Some(item) = inner.ns_status_item() {
                    // SAFETY: Retained<T> is #[repr(transparent)] over NonNull<T>,
                    // so it is pointer-sized. We copy the raw pointer value and
                    // forget the Retained to avoid decrementing the refcount
                    // (the tray-icon crate still holds its own reference).
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
    }

    Ok(())
}

fn main() {
    extend_path_with_common_cli_dirs();

    // Parse command line arguments
    let args = Args::parse();

    // If --mcp flag is passed, run MCP server instead of GUI
    if args.mcp {
        // Install the ring crypto provider for rustls
        rustls::crypto::ring::default_provider()
            .install_default()
            .expect("Failed to install rustls crypto provider");

        // Run MCP server
        let rt = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");
        rt.block_on(async {
            if let Err(e) = mcp::run_mcp_server().await {
                eprintln!("MCP server error: {}", e);
                std::process::exit(1);
            }
        });
        return;
    }

    // Install the ring crypto provider for rustls before anything else
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("Failed to install rustls crypto provider");

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    // Deep-link plugin only in debug builds (screenshot automation)
    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_deep_link::init());
    }

    builder
        .manage(AppState::new())
        .manage(Arc::new(WatchManager::new()))
        .manage(Arc::new(LogStreamManager::new()))
        .manage(Arc::new(ShellSessionManager::new()))
        .manage(Arc::new(PortForwardManager::new()))
        .manage(Arc::new(PortForwardWatchManager::new()))
        .manage(AIConfigState::new())
        .manage(Arc::new(AgentManager::new()))
        .setup(|app| {
            // Initialize AI session store
            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to get app data directory");
            let db_path = app_data_dir.join("ai_sessions.db");
            let session_store = create_session_store(db_path)
                .expect("Failed to create session store");
            app.manage(session_store);

            // Setup system tray icon
            if let Err(e) = setup_tray(app) {
                tracing::error!("Failed to setup tray icon: {}", e);
            }

            // Build macOS app menu
            #[cfg(target_os = "macos")]
            {
                use chrono::{Datelike, Utc};
                let about_metadata = AboutMetadataBuilder::new()
                    .name(Some("Kubeli"))
                    .version(Some("0.1.0"))
                    .copyright(Some(&format!("© {} Kubeli", Utc::now().year())))
                    .comments(Some("Modern Kubernetes Management Desktop Application.\n\nThank you for using Kubeli!"))
                    .build();

                let app_submenu = SubmenuBuilder::new(app, "Kubeli")
                    .about(Some(about_metadata))
                    .separator()
                    .services()
                    .separator()
                    .hide()
                    .hide_others()
                    .show_all()
                    .separator()
                    .quit()
                    .build()?;

                let edit_submenu = SubmenuBuilder::new(app, "Edit")
                    .undo()
                    .redo()
                    .separator()
                    .cut()
                    .copy()
                    .paste()
                    .select_all()
                    .build()?;

                let window_submenu = SubmenuBuilder::new(app, "Window")
                    .minimize()
                    .separator()
                    .close_window()
                    .build()?;

                let menu = MenuBuilder::new(app)
                    .item(&app_submenu)
                    .item(&edit_submenu)
                    .item(&window_submenu)
                    .build()?;

                app.set_menu(menu)?;
            }

            // Deep links for screenshot automation (debug builds only)
            #[cfg(all(desktop, debug_assertions))]
            {
                use percent_encoding::percent_decode_str;
                use tauri_plugin_deep_link::DeepLinkExt;
                let app_handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    let urls = event.urls();
                    if let Some(url) = urls.first() {
                        let host = url.host_str().unwrap_or_default();
                        let path = percent_decode_str(url.path().trim_start_matches('/'))
                            .decode_utf8_lossy()
                            .to_string();
                        match host {
                            // kubeli://view/<resource-type>
                            "view" if !path.is_empty() => {
                                let _ = app_handle.emit("navigate", serde_json::json!({ "view": path }));
                            }
                            // kubeli://connect/<context-name>
                            "connect" if !path.is_empty() => {
                                let _ = app_handle.emit("auto-connect", serde_json::json!({ "context": path }));
                            }
                            _ => {}
                        }
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Tray commands
            show_main_window_command,
            // Cluster commands
            commands::clusters::list_clusters,
            commands::clusters::add_cluster,
            commands::clusters::remove_cluster,
            commands::clusters::switch_context,
            commands::clusters::get_namespaces,
            commands::clusters::connect_cluster,
            commands::clusters::disconnect_cluster,
            commands::clusters::get_connection_status,
            commands::clusters::check_connection_health,
            commands::clusters::has_kubeconfig,
            // Cluster settings commands
            commands::cluster_settings::get_cluster_settings,
            commands::cluster_settings::set_cluster_accessible_namespaces,
            commands::cluster_settings::clear_cluster_settings,
            // Kubeconfig source commands
            commands::kubeconfig::get_kubeconfig_sources,
            commands::kubeconfig::set_kubeconfig_sources,
            commands::kubeconfig::add_kubeconfig_source,
            commands::kubeconfig::remove_kubeconfig_source,
            commands::kubeconfig::list_kubeconfig_sources,
            commands::kubeconfig::validate_kubeconfig_path,
            commands::kubeconfig::set_kubeconfig_merge_mode,
            // Debug commands
            commands::debug::export_debug_info,
            commands::debug::generate_debug_log,
            // Resource commands
            commands::resources::list_pods,
            commands::resources::list_deployments,
            commands::resources::list_services,
            commands::resources::list_configmaps,
            commands::resources::list_secrets,
            commands::resources::list_nodes,
            commands::resources::list_namespaces,
            commands::resources::list_events,
            commands::resources::list_leases,
            commands::resources::list_replicasets,
            commands::resources::list_daemonsets,
            commands::resources::list_statefulsets,
            commands::resources::list_jobs,
            commands::resources::list_cronjobs,
            // Networking resources
            commands::resources::list_ingresses,
            commands::resources::list_endpoint_slices,
            commands::resources::list_network_policies,
            commands::resources::list_ingress_classes,
            // Configuration resources
            commands::resources::list_hpas,
            commands::resources::list_limit_ranges,
            commands::resources::list_resource_quotas,
            commands::resources::list_pdbs,
            // Storage resources
            commands::resources::list_persistent_volumes,
            commands::resources::list_persistent_volume_claims,
            commands::resources::list_storage_classes,
            commands::resources::list_csi_drivers,
            commands::resources::list_csi_nodes,
            commands::resources::list_volume_attachments,
            // Access Control resources
            commands::resources::list_service_accounts,
            commands::resources::list_roles,
            commands::resources::list_role_bindings,
            commands::resources::list_cluster_roles,
            commands::resources::list_cluster_role_bindings,
            // Administration resources
            commands::resources::list_crds,
            commands::resources::list_priority_classes,
            commands::resources::list_runtime_classes,
            commands::resources::list_mutating_webhooks,
            commands::resources::list_validating_webhooks,
            commands::resources::get_pod,
            commands::resources::delete_pod,
            commands::resources::get_resource_yaml,
            commands::resources::apply_resource_yaml,
            commands::resources::delete_resource,
            commands::resources::scale_deployment,
            // Watch commands
            commands::watch::watch_pods,
            commands::watch::watch_namespaces,
            commands::watch::stop_watch,
            // Log commands
            commands::logs::get_pod_logs,
            commands::logs::stream_pod_logs,
            commands::logs::stop_log_stream,
            commands::logs::get_pod_containers,
            commands::logs::download_pod_logs,
            // Shell commands
            commands::shell::shell_start,
            commands::shell::shell_send_input,
            commands::shell::shell_resize,
            commands::shell::shell_close,
            commands::shell::shell_list_sessions,
            // Port forward commands
            commands::portforward::portforward_start,
            commands::portforward::portforward_stop,
            commands::portforward::portforward_list,
            commands::portforward::portforward_get,
            commands::portforward::portforward_check_port,
            // Metrics commands
            commands::metrics::get_node_metrics,
            commands::metrics::get_pod_metrics,
            commands::metrics::get_pod_metrics_direct,
            commands::metrics::get_cluster_metrics_summary,
            commands::metrics::check_metrics_server,
            // Graph commands
            commands::graph::generate_resource_graph,
            // Helm commands
            commands::helm::list_helm_releases,
            commands::helm::get_helm_release,
            commands::helm::get_helm_release_history,
            commands::helm::get_helm_release_values,
            commands::helm::get_helm_release_manifest,
            commands::helm::uninstall_helm_release,
            // Flux commands
            commands::flux::list_flux_kustomizations,
            commands::flux::reconcile_flux_kustomization,
            commands::flux::suspend_flux_kustomization,
            commands::flux::resume_flux_kustomization,
            commands::flux::reconcile_flux_helmrelease,
            commands::flux::suspend_flux_helmrelease,
            commands::flux::resume_flux_helmrelease,
            // Network commands
            commands::network::set_proxy_config,
            commands::network::get_proxy_config,
            // MCP commands
            commands::mcp::mcp_detect_ides,
            commands::mcp::mcp_install_ide,
            commands::mcp::mcp_uninstall_ide,
            commands::mcp::mcp_get_kubeli_path,
            // AI commands (Claude)
            ai::commands::ai_check_cli_available,
            ai::commands::ai_verify_authentication,
            ai::commands::ai_set_api_key,
            ai::commands::ai_get_auth_status,
            // AI commands (Codex)
            ai::commands::ai_check_codex_cli_available,
            ai::commands::ai_verify_codex_authentication,
            ai::commands::ai_get_codex_auth_status,
            // AI session commands
            ai::commands::ai_start_session,
            ai::commands::ai_send_message,
            ai::commands::ai_interrupt,
            ai::commands::ai_stop_session,
            ai::commands::ai_list_sessions,
            ai::commands::ai_is_session_active,
            // AI context commands
            ai::commands::ai_build_context,
            ai::commands::ai_get_system_prompt,
            // AI permission commands
            ai::commands::ai_get_permission_mode,
            ai::commands::ai_set_permission_mode,
            ai::commands::ai_get_permission_status,
            ai::commands::ai_add_sandboxed_namespace,
            ai::commands::ai_remove_sandboxed_namespace,
            ai::commands::ai_get_sandboxed_namespaces,
            ai::commands::ai_list_pending_approvals,
            ai::commands::ai_approve_action,
            ai::commands::ai_reject_action,
            // AI session persistence commands
            ai::commands::ai_list_saved_sessions,
            ai::commands::ai_get_conversation_history,
            ai::commands::ai_save_session,
            ai::commands::ai_save_message,
            ai::commands::ai_update_message,
            ai::commands::ai_update_session_title,
            ai::commands::ai_delete_saved_session,
            ai::commands::ai_delete_cluster_sessions,
            ai::commands::ai_get_resume_context,
            ai::commands::ai_cleanup_old_sessions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
