# Tasks: Add Comprehensive Test Coverage

## Phase 1: Infrastructure Setup

### Coverage Tools
- [x] Update Jest config with `coverageProvider: 'v8'` (avoids Jest 30 bugs)
- [x] Add coverage thresholds (baseline: 2% lines, 30% branches - increase gradually)
- [x] Exclude async server components from Jest coverage (test via E2E)
- [x] Install `cargo-llvm-cov` for Rust (NOT tarpaulin - cross-platform support)
- [x] Create coverage output directories (coverage/, coverage-rust/)

### Dependencies
- [x] Install `next-router-mock` for App Router testing
- [x] Install `@testing-library/user-event`
- [x] Verify `@tauri-apps/api/mocks` is available (already mocked in jest.setup.ts)

### CI Integration
- [x] Update `.github/workflows/ci.yml` to generate coverage reports
- [x] Add coverage artifact upload (frontend-coverage, rust-coverage)
- [x] Add coverage threshold check (baseline thresholds for now)
- [ ] Add coverage badge to README (optional - later)
- [ ] Configure Codecov or similar service (optional - later)

## Phase 2: Frontend Unit Tests

### Zustand Stores (High Priority)
- [x] `cluster-store.test.ts` - Cluster state management (21 tests, 78% coverage)
- [x] `ui-store.test.ts` - UI settings and state (24 tests, 94% coverage)
- [ ] `diagram-store.test.ts` - Diagram state
- [ ] `resource-store.test.ts` - Resource caching
- [ ] `favorites-store.test.ts` - Favorites management

### Tauri Command Mocks
- [ ] Create `__mocks__/@tauri-apps/api.ts`
- [ ] Mock `invoke` function with type safety
- [ ] Add mock responses for all commands

### Utility Functions
- [ ] `src/lib/utils/` - All utility functions
- [ ] `src/lib/hooks/` - Custom hooks
- [ ] `src/lib/tauri/commands.ts` - Command wrappers

### Components
- [ ] Settings components
- [ ] Resource list components
- [ ] Error boundary components
- [ ] Modal/Dialog components

## Phase 3: Rust Unit Tests

### K8s Module
- [ ] `k8s/client.rs` - Client manager tests (with mocks)
- [ ] `k8s/resources.rs` - Resource type tests

### Commands Module
- [ ] `commands/clusters.rs` - Cluster operations
- [ ] `commands/resources.rs` - Resource CRUD
- [ ] `commands/logs.rs` - Additional log parsing tests
- [ ] `commands/mcp.rs` - MCP command tests

### MCP Module
- [ ] `mcp/tools.rs` - MCP tool handlers
- [ ] `mcp/server.rs` - Server initialization
- [ ] `mcp/ide_config.rs` - Additional IDE config tests

### Network Module
- [ ] `network/proxy.rs` - Port forward tests (if applicable)

## Phase 4: E2E Tests

### Navigation & UI
- [ ] Cluster selection flow
- [ ] Settings page navigation
- [ ] Theme switching
- [ ] Keyboard shortcuts

### Resource Views
- [ ] Pod list view
- [ ] Deployment view
- [ ] Service view
- [ ] Namespace switching

### Error Scenarios
- [ ] No cluster connected
- [ ] Invalid kubeconfig
- [ ] Network errors

## Phase 5: Documentation

- [ ] Update CLAUDE.md with test commands
- [ ] Add TESTING.md guide
- [ ] Document mock patterns

---

## Acceptance Criteria

- [ ] All CI checks pass
- [ ] Coverage reports generated in CI
- [ ] Coverage threshold enforced (60%+)
- [ ] No flaky tests
- [ ] Test documentation complete
