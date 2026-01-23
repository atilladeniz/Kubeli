## Context
Kubeli is a desktop app with a Next.js frontend and a Tauri/Rust backend. The current CI only runs
lint and type checks. We need automated test coverage that is reliable in CI without requiring
paid Kubernetes clusters.

## Goals / Non-Goals
- Goals:
  - Provide deterministic unit tests for frontend and backend logic.
  - Add basic end-to-end UI smoke tests that can run in CI.
  - Gate merges on test results in CI.
- Non-Goals:
  - Full integration testing against real cloud providers.
  - Visual regression testing or performance benchmarking.

## Decisions
- Frontend unit tests use Jest + React Testing Library to align with project conventions.
- Backend tests rely on Rust's built-in test framework and mockable units.
- E2E tests use Playwright against a web build with a mocked Tauri IPC layer.
- CI includes separate jobs for frontend tests, backend tests, and E2E smoke tests.

## Risks / Trade-offs
- E2E tests may be slower; keep them minimal to avoid flaky CI.
- Mocked IPC may diverge from real runtime; mitigate with targeted integration tests.

## Migration Plan
1. Add test tooling and minimal test cases.
2. Add CI jobs and ensure they pass locally.
3. Expand coverage iteratively per feature area.

## Open Questions
- Which UI flows are the highest priority for E2E coverage?
- Do we want a nightly job for heavier integration tests?
