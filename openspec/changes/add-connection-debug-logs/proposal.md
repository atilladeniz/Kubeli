# Change: Add connection debug log export

## Why
Users experiencing "Failed to create Kubernetes client" need actionable diagnostics, especially on other machines, but the app currently shows only a generic error.

## What Changes
- Instrument the Rust Kubernetes client initialization with structured logging and persist logs per attempt.
- Add a Tauri command to fetch the latest debug log payload so users can download it.
- Update the connection error UI to show a "Debug Log herunterladen" button that saves the captured log and instructions for sharing.

## Impact
- Affected specs: cluster-management
- Affected code: src-tauri/src/k8s/client.rs, src-tauri/src/commands, src/components/features/clusters, frontend error UI
