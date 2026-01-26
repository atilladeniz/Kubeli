# Tasks: Add Comprehensive Test Coverage

## Phase 1: Infrastructure Setup

### Coverage Tools
- [ ] Add Jest coverage configuration (`jest.config.js`)
- [ ] Add coverage thresholds (60% lines, 50% branches)
- [ ] Install `@jest/coverage` reporter
- [ ] Add Rust coverage with `cargo-tarpaulin` or `cargo-llvm-cov`
- [ ] Create coverage output directories

### CI Integration
- [ ] Update `.github/workflows/ci.yml` to generate coverage reports
- [ ] Add coverage artifact upload
- [ ] Add coverage threshold check (fail if below 60%)
- [ ] Add coverage badge to README
- [ ] Configure Codecov or similar service (optional)

## Phase 2: Frontend Unit Tests

### Zustand Stores (High Priority)
- [ ] `cluster-store.test.ts` - Cluster state management
- [ ] `diagram-store.test.ts` - Diagram state
- [ ] `resource-store.test.ts` - Resource caching
- [ ] `settings-store.test.ts` - User preferences

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
