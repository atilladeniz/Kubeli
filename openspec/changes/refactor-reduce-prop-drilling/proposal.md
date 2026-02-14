# Change: Reduce prop drilling across feature components

## Why
Several feature components act as intermediaries — importing hooks/stores, computing state, and passing results as props to children that could access them directly. This creates unnecessary coupling, bloats parent components, and makes maintenance harder.

## What Changes
- Let child components call hooks directly instead of receiving computed results as props
- Move translation logic into the components that render the strings
- Internalize local UI state (e.g. `copied`, `isSaving`) in the components that own the interaction

### Quick Wins (same pattern, low risk)
1. **SettingsPanel.tsx** — Calls `useAiCli()` and `useMcpIdes()` only to pass results to `<AiTab>` / `<McpTab>`
2. **McpTab.tsx** — Builds `ideTranslations` object (7 strings) to pass to `<McpIdeCard>`; child should use `useTranslations()` directly
3. **AIHeader.tsx** — Receives `title`, `clusterContext`, `stopLabel` as pre-translated strings; can translate internally

### Medium Refactorings
4. **YamlTab.tsx** — Receives 11 props; `copied`, `isSaving`, `hasChanges` could be internal state
5. **ResourceDetail.tsx** — Manages entire YAML editing state only to pass it to YamlTab
6. **DashboardMainWorkspace.tsx** — Receives 12+ props, many are just forwarded

### Larger Scope (document only, no immediate action)
7. **ResourceList.tsx** — 18 props (generic list, may benefit from config-object pattern)
8. **PodsView.tsx** — 10+ hooks aggregated and forwarded to ResourceList

## Impact
- Affected specs: `specs/architecture`
- Affected code:
  - `src/components/features/settings/SettingsPanel.tsx`
  - `src/components/features/settings/components/McpTab.tsx`
  - `src/components/features/settings/components/CliStatusCard.tsx`
  - `src/components/features/ai/components/AIHeader.tsx`
  - `src/components/features/resources/components/YamlTab.tsx`
  - `src/components/features/resources/ResourceDetail.tsx`
  - `src/components/features/dashboard/components/DashboardMainWorkspace.tsx`
  - `src/components/features/dashboard/views/workloads/PodsView.tsx`
  - `src/components/features/resources/ResourceList.tsx`
