# Change: Add Lens-style Tab Navigation

## Why

Currently, Kubeli uses single-view navigation where users can only see one resource type at a time. Users managing complex clusters frequently need to cross-reference multiple resources (e.g., comparing Pods across namespaces, monitoring Deployments while checking Services). Lens-style tabs would significantly improve workflow efficiency for power users.

## What Changes

- **ADDED**: Horizontal tab bar inside the content area (right of sidebar, above resource content)
- **ADDED**: Tab state management via new Zustand store (`tabs-store.ts`)
- **ADDED**: Ability to open resources in new tabs (via Cmd/Ctrl+click or context menu)
- **ADDED**: Tab persistence across sessions (localStorage)
- **ADDED**: Keyboard shortcuts for tab navigation (Cmd/Ctrl+1-9, Cmd/Ctrl+W)
- **MODIFIED**: Sidebar navigation opens in current tab (single-click) or new tab (Cmd/Ctrl+click)
- **MODIFIED**: Dashboard layout to include TabBar component

## Impact

- Affected specs: `architecture` (new TabBar component, tabs store)
- Affected code:
  - `src/components/layout/TabBar.tsx` (new)
  - `src/lib/stores/tabs-store.ts` (new)
  - `src/components/features/dashboard/Dashboard.tsx`
  - `src/components/layout/Sidebar.tsx`
  - `src/lib/hooks/useKeyboardShortcuts.ts`

## Trade-offs

### Benefits
1. **Power user productivity**: Cross-reference resources without losing context
2. **Familiar UX**: Users from Lens/VS Code/browser will feel at home
3. **Flexible workflows**: Users choose their own workflow (tabs vs single-view)

### Costs
1. **Complexity**: Additional state management and UI real estate
2. **Memory**: Each tab maintains its own resource state
3. **Learning curve**: Casual users may not discover tabs

## Alternatives Considered

1. **Split-pane view**: Divide screen into multiple panels
   - Rejected: More complex UX, harder to manage on smaller screens

2. **Popup/modal views**: Open resources in floating windows
   - Rejected: Doesn't scale well, interrupts workflow

3. **Keep single-view**: Status quo
   - Rejected: User feedback indicates need for multi-resource workflows

## Recommendation

Implement tabs with a minimal MVP approach:
- Start with top tabs only (no bottom panel tabs like Lens)
- Maximum 10 tabs to prevent memory issues
- Single tab bar, no tab groups/splits initially
