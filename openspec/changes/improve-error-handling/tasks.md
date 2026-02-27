## 1. Rust Structured Error Type

- [ ] 1.1 Define `KubeliError` struct with `kind`, `code`, `message`, `detail`, `resource`, `suggestions`, `retryable` fields in a new `src-tauri/src/error.rs` module
- [ ] 1.2 Define `ErrorKind` enum: `Forbidden`, `Unauthorized`, `NotFound`, `Conflict`, `RateLimited`, `ServerError`, `Network`, `Timeout`, `Unknown`
- [ ] 1.3 Implement `From<kube::Error>` for `KubeliError` with classification logic (status code mapping, network detection, suggestion generation)
- [ ] 1.4 Implement `Serialize` for `KubeliError` so Tauri can serialize it as JSON to the frontend

## 2. Migrate Core Rust Commands to Structured Errors

- [ ] 2.1 Update `src-tauri/src/commands/resources.rs` — replace all `Result<T, String>` returns with `Result<T, KubeliError>`, remove `.map_err(|e| format!(...))` patterns
- [ ] 2.2 Update `src-tauri/src/commands/watch.rs` — update `WatchEvent::Error` to carry serialized `KubeliError` instead of raw string
- [ ] 2.3 Update `src-tauri/src/commands/clusters.rs` — migrate connection and namespace errors to `KubeliError`
- [ ] 2.4 Update `src-tauri/src/commands/logs.rs` — migrate log streaming errors and `LogEvent::Error` to `KubeliError`
- [ ] 2.5 Update `src-tauri/src/commands/helm.rs` — migrate all Helm command errors (`list_helm_releases`, `get_helm_release`, `uninstall_helm_release`, etc.) to `KubeliError`
- [ ] 2.6 Verify `cargo check` and `cargo clippy` pass for all migrated commands

## 3. Frontend Error Type and Invoke Wrapper

- [ ] 3.1 Define `KubeliError` TypeScript interface in `src/lib/types/errors.ts` mirroring the Rust struct
- [ ] 3.2 Update `src/lib/tauri/commands/core.ts` invoke wrapper to catch rejections, parse JSON error objects from Tauri, and wrap plain strings as `Unknown` kind
- [ ] 3.3 Add `isKubeliError()` type guard and `getErrorMessage()` helper for components that only need a string

## 4. Update useK8sResource Hook

- [ ] 4.1 Change error state from `string | null` to `KubeliError | null` in `useK8sResource.ts`
- [ ] 4.2 Remove all `e instanceof Error ? e.message : "fallback"` patterns — use the structured error directly
- [ ] 4.3 Implement smart retry: check `error.retryable` flag — if `false`, pause auto-refresh interval and watch auto-restart
- [ ] 4.4 For retryable errors, double the refresh interval and show "Retrying..." state
- [ ] 4.5 Add `retry()` function that clears error, resets intervals, and triggers a fresh fetch
- [ ] 4.6 Ensure navigation away clears error state and resumes normal behavior

## 5. Error Display Component

- [ ] 5.1 Create `ResourceError` component in `src/components/features/resources/ResourceError.tsx` that renders structured error with title, message, suggestions, expandable details, and retry button
- [ ] 5.2 Map `ErrorKind` to user-friendly titles (Forbidden → "Access Denied", Unauthorized → "Authentication Failed", Network → "Connection Error", etc.)
- [ ] 5.3 Update `ResourceList.tsx` to use `ResourceError` component instead of the simple `Alert` banner
- [ ] 5.4 Show "Retry" button for non-retryable errors, "Retrying in Xs..." for retryable errors

## 6. Update Remaining Stores and Catch Blocks

- [ ] 6.1 Update `resource-store.ts` error field from `string | null` to `KubeliError | null`
- [ ] 6.2 Update `cluster-store.ts` error handling to use structured errors
- [ ] 6.3 Update `log-store.ts` to handle structured `LogEvent::Error` with `KubeliError`
- [ ] 6.4 Grep for remaining `instanceof Error` patterns across the codebase and update them
- [ ] 6.5 Update `ConnectionErrorAlert.tsx` to use structured error display

## 7. Verification

- [ ] 7.1 Test with a 403 RBAC error — verify structured error display, no flicker, retry button works
- [ ] 7.2 Test with network disconnect — verify retryable behavior, auto-retry with backoff
- [ ] 7.3 Test with valid cluster — verify no regression, normal refresh/watch behavior unchanged
- [ ] 7.4 Test Helm errors — verify structured display for Helm operation failures
- [ ] 7.5 Run `cargo check`, `cargo clippy`, `npm run typecheck`, `npm run lint`

## Follow-up (separate change)

Not in scope for this change, but should be migrated next:
- `portforward.rs` + `portforward-store.ts` — Port forwarding errors
- `shell.rs` + `useShell.ts` — Shell/exec errors
- `flux.rs` + Flux views — Flux operation errors
- `metrics.rs` — Metrics server errors
- `graph.rs` — Dependency graph errors
