# Design: Test Coverage Infrastructure

## Overview

This document outlines the technical approach for implementing comprehensive test coverage.

## Frontend Testing Stack

### Current Setup
```
Jest + React Testing Library + Playwright (E2E)
```

### Additions
```
+ Jest Coverage (istanbul)
+ MSW (Mock Service Worker) for API mocking
+ @testing-library/user-event for interactions
```

## Coverage Configuration

### Jest Config Update

```javascript
// jest.config.js additions
module.exports = {
  // ... existing config
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
};
```

### Rust Coverage

Using `cargo-llvm-cov` for accurate coverage:

```bash
# Install
cargo install cargo-llvm-cov

# Run with coverage
cargo llvm-cov --lcov --output-path coverage/rust-lcov.info

# HTML report
cargo llvm-cov --html
```

## Tauri Mock Strategy

### Mock File Structure

```
src/
  __mocks__/
    @tauri-apps/
      api.ts          # Core API mocks
      plugin-store.ts # Store plugin mock
    tauri-commands.ts # Command response mocks
```

### Mock Implementation

```typescript
// src/__mocks__/@tauri-apps/api.ts
const mockResponses: Record<string, unknown> = {
  'get_clusters': [
    { name: 'test-cluster', context: 'test-context' }
  ],
  'get_pods': [
    { name: 'nginx-pod', namespace: 'default', status: 'Running' }
  ],
  // ... more commands
};

export const invoke = jest.fn((cmd: string, args?: unknown) => {
  if (cmd in mockResponses) {
    return Promise.resolve(mockResponses[cmd]);
  }
  return Promise.reject(new Error(`Unknown command: ${cmd}`));
});
```

## Store Testing Pattern

```typescript
// src/lib/stores/__tests__/cluster-store.test.ts
import { useClusterStore } from '../cluster-store';
import { act, renderHook } from '@testing-library/react';

describe('ClusterStore', () => {
  beforeEach(() => {
    useClusterStore.getState().reset(); // Reset between tests
  });

  it('should set active cluster', () => {
    const { result } = renderHook(() => useClusterStore());

    act(() => {
      result.current.setActiveCluster({
        name: 'test',
        context: 'test-ctx',
      });
    });

    expect(result.current.activeCluster?.name).toBe('test');
  });

  it('should handle cluster connection', async () => {
    const { result } = renderHook(() => useClusterStore());

    await act(async () => {
      await result.current.connectCluster('test-ctx');
    });

    expect(result.current.isConnected).toBe(true);
  });
});
```

## CI Workflow Updates

```yaml
# .github/workflows/ci.yml additions

- name: Run tests with coverage
  run: npm test -- --coverage --coverageReporters=lcov

- name: Check coverage threshold
  run: |
    COVERAGE=$(cat coverage/lcov.info | grep -E "^LF:" | awk -F: '{sum+=$2} END {print sum}')
    COVERED=$(cat coverage/lcov.info | grep -E "^LH:" | awk -F: '{sum+=$2} END {print sum}')
    PERCENT=$((COVERED * 100 / COVERAGE))
    echo "Coverage: $PERCENT%"
    if [ $PERCENT -lt 60 ]; then
      echo "Coverage below threshold (60%)"
      exit 1
    fi

- name: Upload coverage artifact
  uses: actions/upload-artifact@v4
  with:
    name: coverage-report
    path: coverage/
    retention-days: 7

# Optional: Codecov integration
- name: Upload to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: coverage/lcov.info
    fail_ci_if_error: false
```

## Rust Test Patterns

### Mocking K8s Client

```rust
// src-tauri/src/k8s/client.rs
#[cfg(test)]
mod tests {
    use super::*;
    use mockall::predicate::*;

    // Create mock trait for testing
    #[cfg_attr(test, mockall::automock)]
    trait KubeClientOps {
        async fn list_pods(&self, namespace: &str) -> Result<Vec<Pod>>;
    }

    #[tokio::test]
    async fn test_list_pods_filters_by_namespace() {
        let mut mock = MockKubeClientOps::new();
        mock.expect_list_pods()
            .with(eq("default"))
            .returning(|_| Ok(vec![/* mock pods */]));

        // Test implementation
    }
}
```

### Testing MCP Tools

```rust
// src-tauri/src/mcp/tools.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_call_tool_get_pods() {
        let handler = KubeToolsHandler::new_for_testing();

        let request = CallToolRequestParams {
            name: "get_pods".into(),
            arguments: Some(json!({"namespace": "default"})),
        };

        let result = handler.call_tool(request, mock_context()).await;
        assert!(result.is_ok());
    }
}
```

## E2E Test Expansion

```typescript
// tests/e2e/cluster-connection.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Cluster Connection', () => {
  test('should show error for invalid kubeconfig', async ({ page }) => {
    await page.goto('/');
    // Mock invalid kubeconfig scenario
    await expect(page.getByText('Failed to load')).toBeVisible();
  });

  test('should connect to cluster and show resources', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="cluster-test"]');
    await expect(page.getByText('Pods')).toBeVisible();
    await expect(page.getByText('Deployments')).toBeVisible();
  });
});
```

## File Structure After Implementation

```
Kubeli/
├── coverage/                    # Generated coverage reports
│   ├── lcov.info
│   └── html/
├── src/
│   ├── __mocks__/              # Jest mocks
│   │   └── @tauri-apps/
│   ├── lib/
│   │   ├── stores/
│   │   │   ├── __tests__/      # Store tests
│   │   │   └── cluster-store.ts
│   │   └── utils/
│   │       └── __tests__/      # Utility tests
│   └── components/
│       └── __tests__/          # Component tests
├── src-tauri/
│   └── src/
│       └── (inline #[cfg(test)] modules)
├── tests/
│   └── e2e/                    # Playwright E2E tests
├── jest.config.js              # Updated with coverage
└── .github/
    └── workflows/
        └── ci.yml              # Updated with coverage checks
```
