# Change: Add System Tray Port-Forward Quick Access

## Why

Port-forwarding is one of the most frequent developer workflows: quickly forwarding a database, API, or service to localhost for local testing. Currently users must open the full Kubeli window, navigate to the port-forward panel, find the target pod/service, and configure the forward. This is too many steps for something developers do dozens of times a day. A system tray popup provides instant access to start, monitor, and stop port-forwards without leaving the current context - the app stays in the background while the tray icon gives persistent, at-a-glance status.

## What Changes

- **ADDED**: Tauri tray icon with Kubeli logo in the system menu bar
- **ADDED**: Tray popup window (borderless, anchored to tray icon) with two tabs:
  - **Forward** tab: Search bar + compact pod/service list with one-click forwarding
  - **Active** tab: Running port-forwards with status, local port, and disconnect button
- **ADDED**: Tray popup search with instant filtering by pod/service name across connected clusters
- **ADDED**: Tray icon badge showing count of active port-forwards
- **ADDED**: Quick-forward action: single click starts port-forward with auto-assigned local port
- **ADDED**: Tray-level disconnect: stop any running forward directly from the popup
- **ADDED**: "Open in Browser" shortcut on active forwards (localhost:port)
- **ADDED**: "Open Kubeli" menu item to bring up the main window
- **MODIFIED**: App lifecycle - app continues running in tray when main window is closed
- **MODIFIED**: `src-tauri/Cargo.toml` - add `tray-icon` feature to Tauri
- **MODIFIED**: `src-tauri/capabilities/default.json` - add tray permissions

## Impact

- Affected specs: `cluster-management` (new tray capability)
- Affected code:
  - `src-tauri/Cargo.toml` (modified - tray-icon feature)
  - `src-tauri/src/main.rs` (modified - tray initialization, window lifecycle)
  - `src-tauri/capabilities/default.json` (modified - tray permissions)
  - `src-tauri/tauri.conf.json` (modified - tray popup window definition)
  - `src/components/features/tray/TrayPopup.tsx` (new)
  - `src/components/features/tray/ForwardTab.tsx` (new)
  - `src/components/features/tray/ActiveTab.tsx` (new)
  - `src/components/features/tray/TrayPortForwardItem.tsx` (new)
  - `src/app/tray/page.tsx` (new - tray popup route)
  - `src/lib/stores/portforward-store.ts` (modified - tray state sync)

## Trade-offs

### Benefits

1. **Workflow speed**: Start a port-forward in 2 clicks (tray icon + forward button) vs 5+ clicks in main window
2. **Persistent visibility**: Active forward count always visible in menu bar
3. **Background operation**: Main window can be closed while forwards keep running
4. **Minimal footprint**: Tray popup is lightweight (~320x480px), doesn't disrupt current workspace

### Costs

1. **Platform differences**: Linux tray click events are not supported (fallback: right-click context menu)
2. **Second window**: Tray popup is a separate Tauri webview window - small memory overhead (~15-20 MB)
3. **State synchronization**: Port-forward state must be shared between main window and tray popup
4. **Design complexity**: Custom popup positioning logic per platform (macOS menu bar vs Windows taskbar)

## Alternatives Considered

1. **Native menu only (no custom popup)**
   - Rejected: Native menus can't have search bars, rich status indicators, or the polished dark UI that matches Kubeli's design

2. **Spotlight-style floating panel** (always centered on screen)
   - Rejected: Doesn't anchor to tray icon, feels disconnected from the persistent tray presence

3. **Main window mini-mode** (shrink main window to small panel)
   - Rejected: Loses the benefit of background operation, more complex window state management
