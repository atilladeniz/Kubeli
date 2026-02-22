# Tasks: Automated Test Suite and CI Gates

## 1. Frontend Unit Testing
- [x] 1.1 Add Jest + React Testing Library dependencies and config
- [x] 1.2 Add test setup (JSDOM, jest-dom matchers, mocks for Tauri IPC)
- [x] 1.3 Add unit tests for core utilities (e.g., `detectClusterType`)
- [x] 1.4 Add component tests for critical UI states (empty cluster list, error banner)

## 2. Backend (Rust/Tauri) Tests
- [x] 2.1 Ensure `cargo test` runs cleanly in CI
- [x] 2.2 Add tests for kubeconfig parsing and auth error mapping
- [x] 2.3 Add tests for log batching or stream handling utilities

## 3. E2E Smoke Tests
- [x] 3.1 Add Playwright config and test runner scripts
- [x] 3.2 Implement mocked IPC layer for E2E mode
- [x] 3.3 Add E2E tests for navigation + core screens

## 4. CI and Documentation
- [x] 4.1 Update `ci.yml` to run frontend tests, backend tests, and E2E smoke tests
- [x] 4.2 Add Makefile shortcuts for test commands (optional)
- [x] 4.3 Document local test commands and CI expectations
