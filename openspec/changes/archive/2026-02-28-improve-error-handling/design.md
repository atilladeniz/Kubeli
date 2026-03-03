## Context

Currently, Kubeli's error handling has three critical issues:

1. **Lost errors**: Tauri rejects promises with plain `string`, but every catch block checks `e instanceof Error` (always `false`), discarding the actual error for a generic fallback like "Failed to fetch Pods".
2. **Raw Rust output**: When watch errors do surface, they show unprocessed Rust `Debug` format: `Status { status: Some(Failure), code: 403, message: "..." }`.
3. **Blind retry**: Auto-refresh (10s interval) and watch (5s retry) keep hammering the API on persistent errors (403 RBAC, 401 Auth), causing the error banner to flicker: clear → fetch → error → clear → fetch → error.

The entire error path is `Result<T, String>` from Rust through Tauri IPC to the frontend, with no structure or classification.

## Goals / Non-Goals

**Goals:**
- Structured error type from Rust that preserves HTTP status, error kind, and human-readable message
- Error classification that maps K8s API errors to actionable user-facing messages
- Smart retry: pause auto-refresh/watch on persistent errors, retry only transient ones
- Error UI that shows clear title, explanation, suggestions, and expandable raw details

**Non-Goals:**
- Changing how Tauri IPC fundamentally works (still use command/invoke pattern)
- Internationalization of error messages (English only for now)
- Logging/telemetry of errors to external services
- Retry backoff strategies beyond simple pause/resume

## Decisions

### 1. Structured error type in Rust via Tauri's serialized errors

**Decision**: Define a `KubeliError` struct that implements `serde::Serialize` and return it as Tauri's error type. Tauri serializes error types that implement `Serialize` as JSON objects (not plain strings).

**Alternative considered**: Keep `Result<T, String>` and parse error strings on the frontend. Rejected because string parsing is fragile and the Rust side already has the structured `kube::Error` with status codes and reasons.

```rust
#[derive(Debug, Clone, Serialize)]
pub struct KubeliError {
    pub kind: ErrorKind,       // enum: Forbidden, Unauthorized, NotFound, Timeout, Network, Unknown
    pub code: Option<u16>,     // HTTP status code if available
    pub message: String,       // Human-readable message
    pub detail: Option<String>,// Raw error for debugging
    pub resource: Option<String>, // e.g., "pods", "deployments"
    pub suggestions: Vec<String>, // Actionable fix suggestions
    pub retryable: bool,       // Whether auto-retry makes sense
}
```

**Why**: Tauri supports returning custom serializable error types. The frontend receives a parsed JSON object instead of a plain string, eliminating the `instanceof Error` problem entirely.

### 2. Error classification in Rust, not frontend

**Decision**: Classify errors on the Rust side where we have access to the typed `kube::Error` enum (ApiError with status code/reason, network errors, etc.). The frontend only renders what it receives.

**Alternative considered**: Send raw errors to frontend and classify in TypeScript. Rejected because `kube::Error` variants (ApiError, HyperError, etc.) are already well-typed in Rust and would lose structure in string serialization.

Classification map:
| kube::Error variant | code | kind | retryable |
|---|---|---|---|
| `Api(ErrorResponse { code: 403, .. })` | 403 | `Forbidden` | false |
| `Api(ErrorResponse { code: 401, .. })` | 401 | `Unauthorized` | false |
| `Api(ErrorResponse { code: 404, .. })` | 404 | `NotFound` | false |
| `Api(ErrorResponse { code: 409, .. })` | 409 | `Conflict` | true |
| `Api(ErrorResponse { code: 429, .. })` | 429 | `RateLimited` | true |
| `Api(ErrorResponse { code: 500..599, .. })` | 5xx | `ServerError` | true |
| Network/connection errors | - | `Network` | true |
| Timeout errors | - | `Timeout` | true |
| Everything else | - | `Unknown` | true |

Suggestions map:
| kind | suggestions |
|---|---|
| `Forbidden` | "Check RBAC role assignments for your user", "Contact your cluster admin to request access", "Verify you have the correct namespace selected" |
| `Unauthorized` | "Your credentials may have expired — try reconnecting", "Check if your kubeconfig token is still valid" |
| `NotFound` | "The resource may have been deleted", "Check if the namespace exists" |
| `Network` | "Check your network connection", "Verify the cluster API server is reachable" |
| `Timeout` | "The cluster may be under heavy load", "Check network connectivity to the API server" |

### 3. Smart retry with error-aware pause

**Decision**: The `useK8sResource` hook tracks the error's `retryable` flag. When a non-retryable error occurs, both auto-refresh interval and watch auto-restart are paused. A manual "Retry" button is shown instead.

**Alternative considered**: Exponential backoff for all errors. Rejected because RBAC errors will never self-resolve — backoff just delays showing the user a stable error state.

Behavior:
- **Retryable error** (network, timeout, 5xx): Continue auto-refresh but with doubled interval (e.g., 20s instead of 10s). Show error with "Retrying..." indicator.
- **Non-retryable error** (403, 401): Stop auto-refresh and watch. Show error with manual "Retry" button. Only resume when user clicks retry or navigates away and back.

### 4. Frontend error type and invoke wrapper

**Decision**: Update `core.ts` invoke wrapper to catch rejections and parse the JSON error object from Tauri. Define a `KubeliError` TypeScript type mirroring the Rust struct.

```typescript
interface KubeliError {
  kind: 'Forbidden' | 'Unauthorized' | 'NotFound' | 'Timeout' | 'Network' | 'Conflict' | 'RateLimited' | 'ServerError' | 'Unknown';
  code?: number;
  message: string;
  detail?: string;
  resource?: string;
  suggestions: string[];
  retryable: boolean;
}
```

The invoke wrapper catches errors and ensures they're always `KubeliError` objects (parsing JSON if Tauri sends serialized error, or wrapping unexpected strings in an `Unknown` kind).

### 5. Error display component

**Decision**: Replace the simple `Alert` error banner in `ResourceList.tsx` with a structured `ResourceError` component that renders:
- Error icon + title based on `kind` (e.g., "Access Denied" for Forbidden)
- Human-readable `message`
- Collapsible suggestions list
- Expandable "Show details" section with raw `detail` string
- "Retry" button (for non-retryable) or "Retrying in Xs..." indicator (for retryable)

Reuse the existing `Alert` component as the container but add structured inner content.

## Risks / Trade-offs

- **[Breaking change for error handling]** → All catch blocks across the codebase need updating. Mitigated by: the invoke wrapper normalizes errors, so existing catch blocks still work with `e.message` — they just get better messages now. Migration can be incremental.
- **[Suggestions may be wrong/misleading]** → Suggestion strings are best-effort. Mitigated by: keep suggestions generic and always include "Contact your cluster admin" as a fallback. Mark as suggestions, not instructions.
- **[Watch flicker during transition]** → While migrating, old and new error formats may coexist briefly. Mitigated by: update Rust error type first, then frontend in same PR.
