## Why

Users see unhelpful error messages when Kubernetes API calls fail. A 403 RBAC error shows either a generic "Failed to fetch Pods" (because the actual error string from Tauri is silently discarded) or a raw Rust debug dump like `Status { status: Some(Failure), code: 403, message: "pods is forbidden..." }`. The auto-refresh keeps retrying on errors, causing the error banner to flicker between states. Users have no idea what went wrong or how to fix it.

## What Changes

- **Fix the `instanceof Error` bug**: Tauri rejects promises with plain strings, not `Error` objects. Every catch block uses `e instanceof Error ? e.message : "fallback"` which always hits the fallback. The actual Rust error is thrown away.
- **Structured error responses from Rust**: Replace `Result<T, String>` with structured error types that include HTTP status code, error kind (RBAC, network, auth, not found, etc.), human-readable message, and optional suggestions.
- **Error classification and parsing**: Parse Kubernetes API errors (403 Forbidden, 401 Unauthorized, 404 Not Found, timeout, network errors) and map them to user-friendly messages with actionable suggestions.
- **Smart retry behavior**: Stop auto-refresh when errors are persistent (RBAC, auth). Only retry on transient errors (network, timeout). Show a manual "Retry" button for persistent errors.
- **Improved error UI**: Show structured error banners with: clear title (e.g., "Access Denied"), human-readable explanation, actionable suggestions (e.g., "Check your RBAC role assignments"), and expandable raw error details for debugging.

## Capabilities

### New Capabilities
- `error-handling`: Structured error classification, parsing, user-friendly error messages, smart retry logic, and improved error display components.

### Modified Capabilities
- `resource-management`: Error handling in resource fetching, watch streams, and auto-refresh behavior changes.

## Impact

- **Rust backend** (`src-tauri/src/commands/`, `src-tauri/src/k8s/`): New structured error type replacing `Result<T, String>`, error classification logic.
- **Frontend core** (`src/lib/tauri/commands/core.ts`): Error deserialization from structured Tauri responses.
- **Hooks** (`src/lib/hooks/k8s/useK8sResource.ts`): Fix instanceof bug, smart retry logic, structured error state.
- **UI components** (`src/components/`): New/updated error display component with structured information.
- **All resource stores/hooks**: Updated catch blocks to handle structured errors.
