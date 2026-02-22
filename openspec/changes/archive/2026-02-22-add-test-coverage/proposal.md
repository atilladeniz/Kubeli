# Proposal: Add Comprehensive Test Coverage

## Summary

Improve test infrastructure and coverage to prevent regressions and ensure code quality before merging to main.

## Motivation

Current test coverage is minimal:
- **Frontend**: 3 test files covering ~3% of 117 source files
- **Rust**: 10 unit tests covering ~30% of critical paths
- **E2E**: 1 smoke test

This leaves critical functionality untested:
- Zustand stores (application state)
- Tauri command integrations
- Kubernetes resource views
- MCP server tools
- Error handling paths

## Goals

1. **Increase test coverage** to meaningful levels (target: 60%+)
2. **Add coverage reporting** to CI pipeline
3. **Block PRs** that drop coverage below threshold
4. **Add integration tests** for critical paths
5. **Improve E2E test suite** for user workflows

## Non-Goals

- 100% coverage (diminishing returns)
- Testing third-party libraries
- Performance/load testing (separate initiative)

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Frontend Coverage | ~5% | 60% |
| Rust Coverage | ~15% | 50% |
| E2E Scenarios | 1 | 10+ |
| CI Coverage Gate | None | 60% minimum |

## Risks

- **Test maintenance burden**: Mitigate with focused tests on public APIs
- **CI slowdown**: Mitigate with parallel test execution
- **Flaky tests**: Mitigate with proper mocking and retry logic

## Timeline

- Phase 1: Infrastructure Setup (Coverage tools, CI integration)
- Phase 2: Store & Utility Tests
- Phase 3: Component Tests
- Phase 4: E2E Expansion
