# Design: Add Lens-style Tab Navigation

## Context

Kubeli currently uses single-view navigation with sidebar. Users navigate by clicking sidebar items, which replaces the main content area. This proposal adds browser/IDE-style tabs to enable multi-resource workflows.

Reference: Lens IDE screenshot shows tabs like "Nodes - kwok", "Deployments - lc-staging1 (...)", "Pods - lc-staging1 (eu-west-...)" with close buttons.

## Goals / Non-Goals

### Goals
- Enable users to have multiple resource views open simultaneously
- Provide familiar tab UX (drag reorder, close, keyboard shortcuts)
- Persist tabs across sessions within same cluster

### Non-Goals
- Bottom panel tabs (Lens has Terminal, Logs panels) - separate feature
- Tab groups or split views - future enhancement
- Cross-cluster tabs - each cluster has its own tab set

## Decisions

### 1. Tab Data Model

```typescript
interface Tab {
  id: string;                    // uuid
  type: ResourceType;            // 'pods' | 'deployments' | 'services' | ...
  title: string;                 // Display name: "Pods" or "Pods - nginx-xxx"
  icon?: string;                 // Lucide icon name
  namespace?: string;            // If namespace-filtered
  resourceName?: string;         // If viewing specific resource detail
  scrollPosition?: number;       // Preserve scroll when switching
  createdAt: number;             // For LRU eviction
}
```

**Rationale**: Simple flat structure. No nested state per tab - the ResourceStore already handles data fetching based on active resource type.

### 2. State Architecture

```
tabs-store.ts
├── tabs: Tab[]
├── activeTabId: string | null
├── maxTabs: 10
└── closedTabs: Tab[] (for reopen, max 5)

Integration:
- TabBar reads from tabs-store
- Sidebar writes to tabs-store (openTab)
- Dashboard routes content based on activeTab.type
- ResourceStore remains unchanged (fetches based on active type)
```

**Rationale**: Tabs are a UI concern, not a data concern. ResourceStore should not know about tabs.

### 3. Layout

```
┌─────────────────────────────────────────────────────┐
│ [traffic lights]  Titlebar               [AI] [⚙️] │
├──────────┬──────────────────────────────────────────┤
│ Sidebar  │ [Tab 1] [Tab 2] [Tab 3]             [+]  │  <- NEW: TabBar
│          ├──────────────────────────────────────────┤
│          │  Main Content (based on active tab)      │
│          │                                          │
│          │                                          │
└──────────┴──────────────────────────────────────────┘
```

TabBar is inside the content area, to the right of the sidebar. The sidebar remains unchanged and unaffected by tabs. TabBar height: `h-9` (36px).

### 4. Tab Interactions

| Action | Trigger | Behavior |
|--------|---------|----------|
| Open in current tab | Sidebar click | Update activeTab.type, scroll to top |
| Open in new tab | Cmd/Ctrl+click, middle-click | Create tab, set as active |
| Close tab | Click X, Cmd/Ctrl+W | Remove tab, activate previous |
| Reorder | Drag & drop | Update tabs array order |
| Switch | Click tab, Cmd/Ctrl+1-9 | Set activeTabId |

### 5. Persistence Strategy

```typescript
// localStorage key format:
`kubeli:tabs:${clusterContext}`

// Saved on:
- Tab open/close/reorder
- App blur (window loses focus)

// Restored on:
- Cluster connect (if tabs exist for that cluster)
```

**Rationale**: Per-cluster persistence because tabs are contextual to the cluster.

## Risks / Trade-offs

### Risk: Memory with many tabs
- **Mitigation**: Max 10 tabs, LRU eviction, lazy content loading

### Risk: Complexity creep
- **Mitigation**: MVP without drag-drop, reopen-closed, tab groups

### Trade-off: Screen real estate
- TabBar takes 36px vertical space
- Acceptable trade-off for multi-view capability

## Open Questions

1. **Should the first tab be closable?**
   - Lens: Yes, can close all tabs
   - Recommendation: Keep at least one tab (show "New Tab" page if empty)

2. **Tab title format?**
   - Option A: "Pods" (simple)
   - Option B: "Pods - default" (with namespace)
   - Option C: "Pods - nginx-abc" (with resource name for details)
   - Recommendation: Option B for list views, Option C for detail views

3. **What happens on cluster disconnect?**
   - Recommendation: Tabs persist, show "Reconnect" state when viewing
