# Tasks: Refactor Frontend Tauri Command Client into Modular Domains

## 1. Preparation

- [x] 1.1 Capture current export surface of `src/lib/tauri/commands.ts`
- [ ] 1.2 Add characterization checks for representative command wrappers and payload shapes

## 2. Modularization

- [x] 2.1 Create `src/lib/tauri/commands/core.ts` with shared `invoke` helper and shared command types
- [x] 2.2 Split wrappers into domain modules (cluster, resources, logs, shell, portforward, metrics, graph, helm, flux, network, ai, mcp)
- [x] 2.3 Create barrel exports so `@/lib/tauri/commands` remains backward compatible

## 3. Verification

- [x] 3.1 Run TypeScript build/check to verify unchanged consumer imports
- [x] 3.2 Run tests and confirm no UI or runtime behavior regressions
- [x] 3.3 Verify command name and payload parity for changed files before merge
