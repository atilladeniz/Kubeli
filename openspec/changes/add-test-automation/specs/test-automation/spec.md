## ADDED Requirements
### Requirement: Frontend Unit Tests
The project SHALL provide automated frontend unit tests using Jest and React Testing Library.

#### Scenario: Run frontend tests
- **WHEN** a developer runs `npm run test`
- **THEN** Jest executes all frontend unit tests and reports pass/fail.

### Requirement: Backend Unit Tests
The project SHALL provide automated backend unit tests using Rust's built-in test framework.

#### Scenario: Run backend tests
- **WHEN** a developer runs `cargo test` in `src-tauri`
- **THEN** all Rust unit tests execute without requiring a live Kubernetes cluster.

### Requirement: E2E Smoke Tests
The project SHALL provide Playwright E2E smoke tests against a mocked IPC layer.

#### Scenario: Run E2E tests in CI
- **WHEN** CI executes the E2E test job
- **THEN** Playwright runs a minimal smoke suite that verifies core navigation and empty/error states.

### Requirement: CI Test Gates
The project SHALL enforce test execution in CI for frontend, backend, and E2E suites.

#### Scenario: Pull request validation
- **WHEN** a pull request is opened
- **THEN** CI blocks merging if any test suite fails.

### Requirement: Test Documentation
The project SHALL document local test commands and expected runtime.

#### Scenario: Developer onboarding
- **WHEN** a developer reads the testing documentation
- **THEN** they can run frontend, backend, and E2E tests locally.
