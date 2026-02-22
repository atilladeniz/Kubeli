## 1. Tauri Backend - Tray Setup

- [ ] 1.1 Add `tray-icon` and `image-png` features to Tauri in `Cargo.toml`
- [ ] 1.2 Add tray permissions to `src-tauri/capabilities/default.json`
- [ ] 1.3 Create tray icon builder in `src-tauri/src/main.rs` setup with Kubeli icon
- [ ] 1.4 Set `icon_as_template(true)` for macOS menu bar adaptation
- [ ] 1.5 Implement right-click native context menu (Open Kubeli, Quit)
- [ ] 1.6 Implement left-click handler to toggle tray popup window

## 2. Tray Popup Window Configuration

- [ ] 2.1 Add `tray-popup` window definition in `tauri.conf.json` (borderless, transparent, always-on-top, hidden by default, skip-taskbar)
- [ ] 2.2 Implement `toggle_tray_popup()` with platform-specific positioning (macOS: below, Windows: above)
- [ ] 2.3 Add screen bounds clamping to prevent popup from going off-screen
- [ ] 2.4 Implement auto-dismiss on focus loss (blur event)
- [ ] 2.5 Add tray popup window permissions to capabilities

## 3. App Lifecycle - Run in Tray

- [ ] 3.1 Intercept main window close event to hide instead of quit
- [ ] 3.2 Add "Open Kubeli" action to re-show main window from tray
- [ ] 3.3 Add "Quit" action to fully exit app and stop all port-forwards
- [ ] 3.4 Ensure port-forwards persist when main window is hidden

## 4. Frontend - Tray Popup Route

- [ ] 4.1 Create `/tray` route in Next.js app router (`src/app/tray/page.tsx`)
- [ ] 4.2 Create `TrayPopup` layout component with header (Kubeli logo, settings gear, open main window button)
- [ ] 4.3 Implement tab switcher (Forward / Active) with pill-style segmented control
- [ ] 4.4 Apply Kubeli dark theme with transparent/rounded popup styling
- [ ] 4.5 Set up Zustand store hydration for the tray popup window

## 5. Frontend - Forward Tab

- [ ] 5.1 Create `ForwardTab` component with search input
- [ ] 5.2 Implement pod/service fetching with exposed port filtering
- [ ] 5.3 Create `TrayForwardItem` compact row component (name, namespace, port, forward button)
- [ ] 5.4 Implement search filtering (debounced 150ms, fuzzy match on name/namespace)
- [ ] 5.5 Implement one-click forward action (auto-assign local port, call `portforward_start`)
- [ ] 5.6 Add success feedback on forward start (item moves to Active tab)
- [ ] 5.7 Add empty state when no pods with exposed ports are found
- [ ] 5.8 Add namespace grouping with subtle section headers

## 6. Frontend - Active Tab

- [ ] 6.1 Create `ActiveTab` component listing running port-forwards
- [ ] 6.2 Create `ActiveForwardItem` row component (name, localhost:port → target:port, status dot, stop button, open browser button)
- [ ] 6.3 Implement stop button calling `portforward_stop`
- [ ] 6.4 Implement open browser button for `localhost:{port}`
- [ ] 6.5 Implement click-to-copy `localhost:{port}` to clipboard
- [ ] 6.6 Add "Stop All" button at bottom
- [ ] 6.7 Add status indicators (green: connected, yellow: reconnecting, red: error)
- [ ] 6.8 Show active count badge on Active tab label

## 7. Tray Icon Badge

- [ ] 7.1 Implement `update_tray_badge()` Rust function to set tray title (macOS) / tooltip (Windows) with forward count
- [ ] 7.2 Hook badge update into port-forward event emission (start, stop, status change)
- [ ] 7.3 Clear badge when no forwards are active

## 8. State Synchronization

- [ ] 8.1 Ensure `app.emit()` broadcasts port-forward events to both main and tray-popup windows
- [ ] 8.2 Set up Tauri event listeners in tray popup for `portforward-update` events
- [ ] 8.3 Verify port-forward store consistency between both windows

## 9. Linux Fallback

- [ ] 9.1 Implement native context menu fallback for Linux (no click events)
- [ ] 9.2 Show active forwards as native menu items
- [ ] 9.3 Add "Start Forward..." menu item that opens main window port-forward panel

## 10. Testing

- [ ] 10.1 Test tray icon appears on macOS and Windows
- [ ] 10.2 Test popup positioning on macOS (below menu bar) and Windows (above taskbar)
- [ ] 10.3 Test popup auto-dismiss on focus loss
- [ ] 10.4 Test one-click forward from popup
- [ ] 10.5 Test stop forward from popup
- [ ] 10.6 Test state sync between main window and popup (start in main, see in popup and vice versa)
- [ ] 10.7 Test app stays running when main window is closed
- [ ] 10.8 Test badge count updates on forward start/stop
