# Change: Add Automated Test Suite and CI Gates

## Why
Kubeli currently relies on manual verification and linting, which leaves gaps for regressions before
releases. We need a consistent, automated test suite for frontend, backend (Tauri/Rust), and
end-to-end flows, plus CI gates to enforce test execution.

## What Changes
- Add frontend unit tests with Jest + React Testing Library and a stable test harness.
- Expand backend Rust tests and ensure `cargo test` runs in CI.
- Add Playwright E2E smoke tests with a mocked IPC layer.
- Add CI jobs and scripts to run all tests and block regressions.
- Document local test commands and expected runtime.

## Impact
- Affected specs: test-automation
- Affected code:
  - `package.json`
  - `src/` (test setup and tests)
  - `src-tauri/` (tests)
  - `.github/workflows/ci.yml`
  - `Makefile` (optional test shortcuts)
  - `.dev/README.md` or `README.md`
