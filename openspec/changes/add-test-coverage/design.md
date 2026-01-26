# Design: Test Coverage Infrastructure

## Overview

This document outlines the technical approach for implementing comprehensive test coverage.

## Important Considerations

### Jest 30 Known Issues
- [Branch coverage reporting bug](https://github.com/jestjs/jest/issues/15760) - may show incorrect branch coverage after upgrade
- Workaround: Use `v8` coverage provider instead of `babel` for more accurate results

### Next.js App Router Limitations
- **Async Server Components NOT supported by Jest** - use E2E tests instead
- Need to mock `next/navigation` for App Router hooks
- Use `next-router-mock` package for router mocking

### Tauri 2.0 Testing
- Official `tauri::test` module (unstable but usable)
- Frontend mocking via `@tauri-apps/api/mocks`
- See: [Tauri Testing Docs](https://v2.tauri.app/develop/tests/)

### Rust Coverage Tool Choice
- **Use `cargo-llvm-cov`** (NOT `cargo-tarpaulin`)
- Reasons:
  - Cross-platform (macOS + Linux + Windows)
  - More accurate LLVM-based coverage
  - Supports line, region, AND branch coverage
  - tarpaulin is Linux-only with limited macOS support

## Frontend Testing Stack

### Current Setup
```
Jest 30 + React Testing Library + Playwright (E2E)
```

### Additions
```
+ Jest Coverage (v8 provider for accuracy)
+ @tauri-apps/api/mocks (official Tauri mocks)
+ next-router-mock (App Router mocking)
+ @testing-library/user-event for interactions
```

## Coverage Configuration

### Jest Config Update

```javascript
// jest.config.js additions
module.exports = {
  // ... existing config

  // Use v8 provider for more accurate coverage (avoids Jest 30 branch coverage bugs)
  coverageProvider: 'v8',

  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/app/**/layout.tsx',  // Async server components - test via E2E
    '!src/app/**/loading.tsx',
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

  // Mock next/navigation for App Router
  moduleNameMapper: {
    '^next/navigation$': 'next-router-mock',
  },
};
```

### Install Additional Dependencies

```bash
npm install -D next-router-mock @testing-library/user-event
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

Tauri 2.0 provides official mocking utilities via `@tauri-apps/api/mocks`.
See: [Tauri Mock Docs](https://v2.tauri.app/develop/tests/mocking/)

### Mock File Structure

```
src/
  __mocks__/
    @tauri-apps/
      api.ts          # Core API mocks
      plugin-store.ts # Store plugin mock
  test-utils/
    tauri-mocks.ts    # Command response fixtures
    setup.ts          # Test setup with mocks
```

### Using Official Tauri Mocks

```typescript
// src/test-utils/setup.ts
import { mockIPC, mockWindows, clearMocks } from '@tauri-apps/api/mocks';

beforeAll(() => {
  // Mock window labels
  mockWindows('main', 'settings');
});

afterEach(() => {
  clearMocks();
});
```

### Custom IPC Mock Implementation

```typescript
// src/test-utils/tauri-mocks.ts
import { mockIPC } from '@tauri-apps/api/mocks';

export const mockKubeliCommands = () => {
  mockIPC((cmd, args) => {
    switch (cmd) {
      case 'get_clusters':
        return [
          { name: 'test-cluster', context: 'test-context' }
        ];
      case 'get_pods':
        return [
          { name: 'nginx-pod', namespace: 'default', status: 'Running' }
        ];
      case 'connect_cluster':
        return { success: true };
      default:
        throw new Error(`Unhandled command: ${cmd}`);
    }
  });
};

// Usage in tests:
// import { mockKubeliCommands } from '@/test-utils/tauri-mocks';
// beforeEach(() => mockKubeliCommands());
```

### Fallback Manual Mock (if needed)

```typescript
// src/__mocks__/@tauri-apps/api.ts
const mockResponses: Record<string, unknown> = {
  'get_clusters': [
    { name: 'test-cluster', context: 'test-context' }
  ],
  'get_pods': [
    { name: 'nginx-pod', namespace: 'default', status: 'Running' }
  ],
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
