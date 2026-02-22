## Context

Kubeli has a complete port-forwarding system (5 Tauri commands, event-driven status updates, automatic reconnection, service port resolution) but no system tray integration. The Tauri v2 tray API provides `TrayIconBuilder` with click event handling and `event.rect` positioning data, enabling a custom popup window anchored to the tray icon. There is no built-in popup panel in Tauri - the popup must be a separate borderless webview window positioned programmatically.

Kubeli already has a sophisticated visual system that the tray popup can reuse: `macOSPrivateApi: true`, `windowEffects` with `hudWindow` (macOS) and `mica` (Windows), a 4-level vibrancy system (`off`/`standard`/`more`/`extra`), `backdrop-filter: blur(20px)`, and 16px corner radius. The popup window inherits this entire visual stack, ensuring a consistent, polished look that matches the main application window.

### References
- Tauri v2 tray API: `TrayIconBuilder`, `TrayIconEvent`, `event.rect` positioning
- Tauri v2 migration: `systemTray` renamed to `trayIcon`, feature flag `system-tray` renamed to `tray-icon`
- Existing port-forward commands: `portforward_start`, `portforward_stop`, `portforward_list`, `portforward_get`, `portforward_check_port`
- Existing port-forward store: `src/lib/stores/portforward-store.ts`
- Existing port-forward types: `PortForwardInfo`, `PortForwardStatus`, `PortForwardEvent`
- Existing vibrancy system: `src/app/globals.css` (4-level CSS custom properties)
- Existing window effects: `tauri.conf.json` (`hudWindow`, `mica`, `radius: 16`)
- Existing ThemeProvider: `src/components/providers/ThemeProvider.tsx`

## Goals / Non-Goals

### Goals
- One-click port-forward from tray popup (search pod, click forward)
- Monitor active forwards at a glance (status, local port, target)
- Stop forwards directly from tray without opening main window
- App stays alive in tray when main window is closed
- **Polished, native-feeling popup** with rounded corners, vibrancy blur, and Kubeli's dark theme
- Tray icon shows active forward count as badge
- Consistent visual language between main window and tray popup

### Non-Goals
- Full resource management from tray (only port-forwarding)
- Log streaming from tray (too complex for small popup)
- Shell/exec from tray (requires full terminal)
- Tray-only mode without main window (main window always available)
- Custom tray icon per cluster or per forward
- Dock icon hiding (`LSUIElement`) - Kubeli keeps its dock presence

## Decisions

### 1. Tray Popup Window - Visual Specification

The tray popup is a second Tauri webview window that reuses Kubeli's existing visual effects stack for a polished, native-feeling appearance like high-quality desktop tray apps.

**Window definition in `tauri.conf.json`:**

```json
{
  "label": "tray-popup",
  "url": "/tray",
  "title": "",
  "width": 360,
  "height": 480,
  "resizable": false,
  "decorations": false,
  "transparent": true,
  "alwaysOnTop": true,
  "visible": false,
  "skipTaskbar": true,
  "focus": true,
  "windowEffects": {
    "effects": ["hudWindow", "mica"],
    "state": "active",
    "radius": 16
  }
}
```

**Key visual properties:**
- `decorations: false` - No native title bar, fully custom UI
- `transparent: true` - Transparent background allows vibrancy blur to show through
- `windowEffects.effects: ["hudWindow", "mica"]` - Same as main window: macOS HUD window blur, Windows Mica material
- `windowEffects.radius: 16` - Native 16px rounded corners at the OS level (not just CSS)
- `skipTaskbar: true` - Popup doesn't appear in taskbar/dock

The `radius: 16` in `windowEffects` creates **native rounded corners** at the compositor level. This is the same technique that gives the main Kubeli window its rounded appearance. Combined with `transparent: true`, the corners are truly rounded (no white/black corner artifacts).

**Rationale**: Reusing the exact same `windowEffects` config as the main window ensures visual consistency. The `hudWindow` effect on macOS provides the same frosted glass blur that apps like the reference VPN client use for their tray popups. The 16px radius matches Kubeli's design language.

### 2. Popup CSS Visual Design

The popup page (`/tray`) shares the same CSS vibrancy system as the main app:

```css
/* Tray popup container - inherits vibrancy from globals.css */
.tray-popup {
  width: 360px;
  height: 480px;
  border-radius: 16px;
  overflow: hidden;
  background: var(--vibrancy-bg);      /* Uses existing vibrancy CSS vars */
  backdrop-filter: blur(20px) saturate(1.2);
  -webkit-backdrop-filter: blur(20px) saturate(1.2);
  border: 1px solid rgba(255, 255, 255, 0.08);  /* Subtle glass edge */
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.4),       /* Deep shadow for floating feel */
    0 0 0 1px rgba(255, 255, 255, 0.05);          /* Thin highlight border */
}
```

**Vibrancy inheritance**: The popup renders inside the existing ThemeProvider, so it automatically applies the user's chosen vibrancy level (`standard`/`more`/`extra`). The `vibrancy-*` CSS classes set the correct opacity for dark/classic-dark/light themes.

**Platform-specific adjustments** (already handled by existing `.platform-windows` classes):
- macOS: Lower opacity (0.75) for true frosted glass through `hudWindow`
- Windows: Higher opacity (0.95) to work with Mica's softer blur

**Rationale**: Zero new CSS infrastructure needed. The popup simply wraps in the same vibrancy container used by the main app, getting rounded corners, blur, and theme adaptation for free.

### 3. Tray Icon Setup

**Icon assets:**
- macOS: Template image (monochrome PNG, 18x18 + 36x36 @2x). `icon_as_template(true)` adapts to light/dark menu bar automatically.
- Windows: Multi-layer ICO container with 16, 24, 32, 48, 64, 256px layers. Generated via `cargo tauri icon` from a single 1024x1024 source PNG.
- Icon should be a simplified Kubeli logo (helm wheel) optimized for small sizes.

**Initialization (Rust):**

```rust
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::menu::{Menu, MenuItem};

fn setup_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Right-click native context menu
    let open_i = MenuItem::with_id(app, "open", "Open Kubeli", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open_i, &quit_i])?;

    let _tray = TrayIconBuilder::new()
        .id("kubeli-tray")
        .icon(app.default_window_icon().unwrap().clone())
        .icon_as_template(true)           // macOS: adapts to menu bar color
        .tooltip("Kubeli")
        .menu(&menu)
        .show_menu_on_left_click(false)   // Left click = popup, right click = menu
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main_window(app),
            "quit" => {
                stop_all_portforwards(app);
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                rect,
                ..
            } = event
            {
                toggle_tray_popup(tray.app_handle(), rect);
            }
        })
        .build(app)?;

    Ok(())
}
```

**Singleton guarantee**: The tray icon is created once in `setup()` with a fixed ID (`kubeli-tray`). `TrayIcon::getById("kubeli-tray")` prevents duplicate instances if setup is called multiple times.

**Rationale**: Left-click for custom popup, right-click for native menu is the standard macOS/Windows tray pattern. `icon_as_template(true)` ensures the icon adapts automatically to light/dark menu bars without manual theme detection.

### 4. Popup Positioning Logic

```rust
fn toggle_tray_popup(app: &AppHandle, rect: tauri::Rect) {
    let Some(popup) = app.get_webview_window("tray-popup") else { return };

    if popup.is_visible().unwrap_or(false) {
        let _ = popup.hide();
        return;
    }

    let popup_width = 360.0;
    let popup_height = 480.0;

    // Center popup horizontally on tray icon
    let center_x = rect.position.x + rect.size.width / 2.0 - popup_width / 2.0;

    // macOS: tray at top → popup appears below icon (4px gap)
    #[cfg(target_os = "macos")]
    let y = rect.position.y + rect.size.height + 4.0;

    // Windows: tray at bottom → popup appears above icon (4px gap)
    #[cfg(target_os = "windows")]
    let y = rect.position.y - popup_height - 4.0;

    // Clamp to screen bounds
    let position = clamp_to_screen(app, center_x, y, popup_width, popup_height);

    let _ = popup.set_position(position);
    let _ = popup.show();
    let _ = popup.set_focus();
}

fn clamp_to_screen(
    app: &AppHandle,
    x: f64, y: f64,
    width: f64, height: f64,
) -> PhysicalPosition<i32> {
    if let Some(monitor) = app.primary_monitor().ok().flatten() {
        let screen = monitor.size();
        let scale = monitor.scale_factor();
        let screen_w = screen.width as f64 / scale;
        let screen_h = screen.height as f64 / scale;

        let clamped_x = x.max(8.0).min(screen_w - width - 8.0);
        let clamped_y = y.max(8.0).min(screen_h - height - 8.0);

        PhysicalPosition::new(clamped_x as i32, clamped_y as i32)
    } else {
        PhysicalPosition::new(x as i32, y as i32)
    }
}
```

**Auto-dismiss**: The popup hides when it loses focus. Implemented via the `blur` window event:

```rust
if let Some(popup) = app.get_webview_window("tray-popup") {
    popup.on_window_event(move |event| {
        if let tauri::WindowEvent::Focused(false) = event {
            let _ = popup.hide();
        }
    });
}
```

**Rationale**: Platform-specific positioning ensures the popup appears correctly relative to the menu bar (macOS) or taskbar (Windows). Screen clamping with 8px padding prevents the popup from being cut off near screen edges or behind the notch on newer MacBooks.

### 5. Tray Popup UI Layout

```
┌─────────────────────────────────────────┐  ← 16px radius (native windowEffects)
│                                         │
│  ⎈ Kubeli                    [⚙] [↗]  │  Header: logo, settings, open main
│                                         │
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤  Subtle separator
│                                         │
│  ┌──────────────┐┌──────────────────┐  │
│  │   Forward    ││   Active (3)     │  │  Pill tabs (segmented control)
│  └──────────────┘└──────────────────┘  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 🔍 Search pods & services...   │   │  Search input (rounded, subtle)
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  demo-api                   [→] │   │  Row: name bold, action right
│  │  kubeli-demo · :8080            │   │  Subtitle: namespace · port (muted)
│  ├─────────────────────────────────┤   │  Thin separator between rows
│  │  demo-web                   [→] │   │
│  │  kubeli-demo · :3000            │   │
│  ├─────────────────────────────────┤   │
│  │  demo-db-0                  [→] │   │
│  │  kubeli-demo · :5432            │   │
│  ├─────────────────────────────────┤   │
│  │  demo-auth                  [→] │   │
│  │  kubeli-demo · :9090            │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘  ← 16px radius (native windowEffects)
```

**Active tab:**
```
┌─────────────────────────────────────────┐
│                                         │
│  ⎈ Kubeli                    [⚙] [↗]  │
│                                         │
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│                                         │
│  ┌──────────────┐┌──────────────────┐  │
│  │   Forward    ││   Active (2)     │  │
│  └──────────────┘└──────────────────┘  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ● demo-api              [↗] [■]│   │  Green dot, open browser, stop
│  │ localhost:8080 → :8080          │   │  Local → remote port mapping
│  ├─────────────────────────────────┤   │
│  │ ◐ demo-worker           [↗] [■]│   │  Yellow dot = reconnecting
│  │ localhost:3000 → :3000          │   │
│  └─────────────────────────────────┘   │
│                                         │
│                                         │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │          Stop All               │   │  Destructive action, muted red
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### 6. Visual Design Tokens (reuse existing Kubeli system)

The popup uses the same Tailwind/CSS design tokens as the main app:

| Element | CSS Class / Token | Notes |
|---------|------------------|-------|
| **Background** | `bg-background` (via vibrancy vars) | Translucent with blur behind |
| **Header text** | `text-foreground font-semibold text-sm` | Kubeli logo + name |
| **Tab bar** | `bg-muted rounded-lg p-1` | Segmented control container |
| **Active tab** | `bg-background text-foreground rounded-md shadow-sm` | Elevated active pill |
| **Inactive tab** | `text-muted-foreground` | Muted text, no background |
| **Search input** | `bg-muted/50 border-border rounded-lg text-sm` | Subtle, low-contrast input |
| **Row** | `px-3 py-2.5` hover: `bg-muted/50 rounded-lg` | Hover highlight |
| **Pod name** | `text-foreground font-medium text-sm` | Primary text |
| **Namespace/port** | `text-muted-foreground text-xs` | Secondary info |
| **Forward button** | `text-primary hover:bg-primary/10 rounded-md` | Accent color action |
| **Stop button** | `text-destructive hover:bg-destructive/10 rounded-md` | Red destructive action |
| **Status dot** | `bg-green-500` / `bg-yellow-500` / `bg-red-500` | 6px circle, inline |
| **Separator** | `border-border/50` | Very subtle, 50% opacity |
| **Outer border** | `border border-white/[0.08]` | Glass edge effect |
| **Shadow** | `shadow-2xl` | Deep shadow for floating panel feel |

**Typography scale**: All text in the popup uses `text-xs` (12px) and `text-sm` (14px) only, keeping the compact density appropriate for a 360px-wide panel.

**Rationale**: Using existing design tokens ensures zero visual inconsistency. The popup looks like a natural extension of the main app, not a separate interface.

### 7. Forward Tab - Pod/Service List

The Forward tab fetches pods and services from the connected cluster(s) and displays them in a searchable list:

```typescript
interface TrayForwardItem {
    name: string;          // pod or service name
    namespace: string;     // namespace
    port: number;          // container port (first exposed port)
    targetType: 'pod' | 'service';
    context: string;       // cluster context (for multi-cluster)
}
```

**Data fetching**:
- Uses existing `portforward:list_resources` or pod/service list commands
- Filters to show only pods/services with exposed ports (containerPort or service port)
- Groups by namespace with subtle section headers
- Caches results, refreshes on popup show

**Search behavior**:
- Filters by pod/service name (fuzzy match)
- Filters by namespace
- Results update as user types (debounced 150ms)
- Empty state: "No pods with exposed ports found"

**One-click forward**:
- Clicking [→] starts a forward with auto-assigned local port (same port as target if available, otherwise random)
- Row shows brief success state (checkmark animation), then item appears in Active tab
- Badge count updates on tray icon

**Rationale**: The search-first approach matches the UX of modern command palettes. Developers know the pod name - let them type and forward instantly.

### 8. Active Tab - Running Forwards

Displays all active port-forwards from the existing `portforward-store`:

```typescript
// Reuses existing PortForwardInfo from the store
interface ActiveForwardRow {
    forward_id: string;
    name: string;           // pod/service name
    namespace: string;
    local_port: number;     // localhost:port
    target_port: number;    // container port
    status: PortForwardStatus;  // Connected | Reconnecting | Error
}
```

**Row actions**:
- [↗] Open browser: opens `http://localhost:{local_port}` in default browser
- [■] Stop button: calls `portforward_stop(forward_id)`
- Click on row: copies `localhost:{port}` to clipboard (subtle toast feedback)

**"Stop All" button**: At the bottom, stops all active forwards at once. Styled as muted destructive (`text-destructive/70`).

**Status indicators**:
- Green dot (●): Connected - forward is active and healthy
- Yellow dot (◐): Reconnecting - pod died, waiting for replacement
- Red dot (●): Error - with tooltip showing error message on hover

**Rationale**: The active tab is a quick dashboard. All information and actions are visible without expanding or drilling down.

### 9. Tray Icon Badge (Active Forward Count)

```rust
fn update_tray_badge(app: &AppHandle, count: usize) {
    if let Some(tray) = app.tray_by_id("kubeli-tray") {
        if count > 0 {
            // macOS: set_title shows text next to icon in menu bar
            #[cfg(target_os = "macos")]
            let _ = tray.set_title(Some(&format!("{}", count)));

            // All platforms: tooltip on hover
            let _ = tray.set_tooltip(Some(
                &format!("Kubeli - {} active forward{}", count, if count == 1 { "" } else { "s" })
            ));
        } else {
            #[cfg(target_os = "macos")]
            let _ = tray.set_title(None::<&str>);

            let _ = tray.set_tooltip(Some("Kubeli"));
        }
    }
}
```

**Note**: `set_title` is macOS-only (shows text beside icon). On Windows, the count is shown via `set_tooltip` on hover only.

**Rationale**: macOS `set_title` is the standard pattern used by menu bar apps to show live counts (Docker Desktop, cloud storage sync counts, etc.).

### 10. App Lifecycle - Run in Tray

When the main window is closed, the app stays running in the tray:

```rust
// In setup, handle main window close
if let Some(main_window) = app.get_webview_window("main") {
    let window_clone = main_window.clone();
    main_window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            // Don't quit - hide to tray
            api.prevent_close();
            let _ = window_clone.hide();
        }
    });
}
```

**"Open Kubeli"** from tray right-click menu or popup header [↗] button:

```rust
fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}
```

**"Quit"** from right-click menu actually exits the app and stops all forwards.

**Rationale**: Port-forwards must persist when the user closes the window. Running in tray is the expected behavior for developer tools with background services (Docker Desktop, database clients, VPN apps all do this).

### 11. State Synchronization Between Windows

Both the main window and tray popup share the same Tauri backend state. Port-forward events are emitted to **all** windows:

```rust
// Existing port-forward event emission (already in portforward.rs)
app.emit("portforward-update", &event)?;  // Broadcasts to ALL webview windows
```

Both windows listen on the same event channels. The Zustand store in each window processes events independently but arrives at the same state since they share the same backend source of truth.

**No cross-window store sync needed** - both windows:
1. Call the same Tauri commands (same backend state)
2. Receive the same `app.emit()` events (same event stream)
3. Derive the same UI state (deterministic)

**Rationale**: Tauri's `app.emit()` broadcasts to all webview windows. This is simpler and more reliable than trying to sync Zustand stores across windows.

### 12. Linux Fallback

Since Linux doesn't support tray click events (Click, DoubleClick, Enter, Move, Leave are **not emitted**), the tray uses a native context menu:

```rust
#[cfg(target_os = "linux")]
{
    // Rebuild menu dynamically when forwards change
    let menu = build_portforward_menu(app);
    tray.set_menu(Some(menu))?;
    // Note: on Linux, once menu is set, it cannot be removed
}
```

The native menu shows:
- Active forwards as menu items (click to open `localhost:{port}` in browser)
- Separator
- "Start Forward..." → opens main window port-forward panel
- "Open Kubeli" → shows main window
- "Quit" → exits app

**Important Linux limitation**: `tray.set_menu()` is permanent on Linux - the menu cannot be removed once set. The menu must be rebuilt/replaced each time the forward list changes.

**Rationale**: Linux tray doesn't support programmatic click handling. A native menu is the only reliable option and still provides quick access to active forwards.

### 13. Tray Icon Assets

Use `cargo tauri icon` to generate all required formats from a single 1024x1024 source PNG:

| Platform | Format | Sizes | Notes |
|----------|--------|-------|-------|
| macOS | PNG (template) | 18x18, 36x36 (@2x) | Monochrome, `icon_as_template(true)` |
| macOS | ICNS | 16-1024px | App icon (already exists) |
| Windows | ICO (multi-layer) | 16, 24, 32, 48, 64, 256px | **Must include 256px** for 4K/HiDPI |
| Linux | PNG | 32x32, 128x128 | Standard icon sizes |

**Windows ICO critical note**: A common pitfall is an ICO with only a 32x32 layer. This causes blurry icons on HiDPI displays (125%, 150%, 175% scaling). The 256px layer is essential for sharp rendering on 4K monitors and high scaling settings.

**macOS template icon**: A template image is monochrome (black pixels + transparency). macOS automatically inverts the colors for dark menu bars. This is why `icon_as_template(true)` is set - it tells the OS to treat the icon as adaptive. No manual dark/light mode icon switching needed.

**Rationale**: Proper multi-resolution assets prevent the "blurry tray icon" issue that plagues many desktop apps, especially on Windows with mixed DPI setups.

## Risks / Trade-offs

- **Risk**: Popup positioning edge cases (tray near screen edge, MacBook notch)
  - Mitigation: `clamp_to_screen()` function with 8px padding. macOS safe area insets via monitor API.

- **Risk**: Memory overhead of second webview window
  - Mitigation: Tray popup is a minimal React page (~15-20 MB). Acceptable for the workflow benefit. The popup window is created once and hidden/shown, not created/destroyed each time.

- **Risk**: Port-forward data stale in popup if main window makes changes
  - Mitigation: Both windows receive the same Tauri events via `app.emit()`. State is eventually consistent within milliseconds.

- **Risk**: Window effects not rendering on older OS versions
  - Mitigation: `hudWindow` requires macOS 10.15+ (already our minimum). `mica` requires Windows 11 (falls back gracefully to opaque on Windows 10). The CSS vibrancy system provides the fallback visual.

- **Risk**: `icon_as_template` not rendering correctly with colored icons
  - Mitigation: Use a strictly monochrome (black + transparent) template icon for macOS. The colored app icon is only used for the dock/app switcher.

## Open Questions

- Should the popup support drag-to-resize for users who want to see more items?
- Should frequently forwarded pods be pinned/favorited for even faster access?
- Should the tray icon change between monochrome and colored when forwards are active vs idle?
