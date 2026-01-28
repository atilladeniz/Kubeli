# Tasks: Add Lens-style Tab Navigation

## 1. State Management

- [ ] 1.1 Create `tabs-store.ts` with Zustand
  - Tab interface: `{ id, type, title, icon?, namespace?, resourceName?, createdAt }`
  - Actions: `openTab`, `closeTab`, `setActiveTab`, `reorderTabs`, `closeOtherTabs`, `closeTabsToRight`
  - Persist to localStorage with cluster context prefix
- [ ] 1.2 Add tab limit (max 10) with oldest-tab-removal policy
- [ ] 1.3 Add session persistence (save/restore tabs on app restart)

## 2. Tab Bar Component

- [ ] 2.1 Create `TabBar.tsx` component
  - Horizontal scrollable tab list
  - Tab: icon + title + close button (x)
  - Active tab highlight
  - "New tab" button (+)
- [ ] 2.2 Implement drag-and-drop tab reordering (optional, can defer)
- [ ] 2.3 Add context menu for tabs (Close, Close Others, Close to Right)
- [ ] 2.4 Handle overflow with horizontal scroll or dropdown

## 3. Dashboard Integration

- [ ] 3.1 Modify `Dashboard.tsx` to include TabBar between titlebar and content
- [ ] 3.2 Route content rendering based on active tab
- [ ] 3.3 Preserve tab scroll position when switching tabs

## 4. Sidebar Integration

- [ ] 4.1 Single-click: navigate in current tab
- [ ] 4.2 Cmd/Ctrl+click: open in new tab
- [ ] 4.3 Add "Open in New Tab" to resource context menus (if context menus exist)

## 5. Keyboard Shortcuts

- [ ] 5.1 Cmd/Ctrl+1-9: Switch to tab by index
- [ ] 5.2 Cmd/Ctrl+W: Close current tab
- [ ] 5.3 Cmd/Ctrl+Shift+T: Reopen last closed tab (optional)
- [ ] 5.4 Cmd/Ctrl+Tab / Cmd/Ctrl+Shift+Tab: Cycle through tabs

## 6. Visual Polish

- [ ] 6.1 Tab icons matching Sidebar icons (Layers, Box, Globe, etc.)
- [ ] 6.2 Namespace badge on tab (if filtered by namespace)
- [ ] 6.3 Loading indicator for tab content
- [ ] 6.4 Tab close animation

## 7. Testing

- [ ] 7.1 Unit tests for tabs-store
- [ ] 7.2 Component tests for TabBar
- [ ] 7.3 E2E test: open multiple tabs, switch, close

## 8. Documentation

- [ ] 8.1 Update keyboard shortcuts in Settings or Help
- [ ] 8.2 Add tooltip hints for tab actions
