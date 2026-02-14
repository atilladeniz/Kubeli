## 1. Quick Wins (low risk, same pattern as home refactoring)
- [ ] 1.1 SettingsPanel: Let AiTab call `useAiCli()` directly instead of receiving it as prop
- [ ] 1.2 SettingsPanel: Let McpTab call `useMcpIdes()` directly instead of receiving it as prop
- [ ] 1.3 McpTab: Let McpIdeCard use `useTranslations()` directly instead of receiving translations object
- [ ] 1.4 AIHeader: Move translation calls (`title`, `clusterContext`, `stopLabel`) into AIHeader

## 2. Medium Refactorings (moderate risk, needs testing)
- [ ] 2.1 YamlTab: Internalize `copied`, `isSaving`, `hasChanges` state
- [ ] 2.2 ResourceDetail: Remove YAML state management after YamlTab owns it
- [ ] 2.3 DashboardMainWorkspace: Audit 12+ props, let children access stores directly where appropriate

## 3. Validation
- [ ] 3.1 TypeScript typecheck passes
- [ ] 3.2 ESLint passes
- [ ] 3.3 Manual test: Settings panel (AI tab, MCP tab) works correctly
- [ ] 3.4 Manual test: YAML editing, saving, and reset works
- [ ] 3.5 Manual test: Dashboard workspace renders correctly
