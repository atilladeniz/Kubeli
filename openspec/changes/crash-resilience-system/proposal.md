## Why

Kubeli v0.3.56 shipped a startup crash caused by the window-state plugin restoring invalid tray-popup state, and the update restart path (`relaunch()`) triggering a double-panic on macOS. Users who auto-updated were stuck in a crash loop with no recovery path. We need a defense-in-depth system so that even if a future release introduces a crash, the app can self-recover and users are never permanently stuck.

## What Changes

- **Crash Guard**: Count consecutive startup failures and enter Safe Mode after 3 crashes (disable tray, window-state restore, and non-essential plugins). Reset counter when frontend reports "ready" or on version change.
- **Staged Rollouts**: Add a `rollout` field to `latest.json` so updates can be gradually deployed (10% → 50% → 100%). Frontend checks rollout percentage against a stable machine-id hash. No backend changes needed.
- **Auto-Rollback**: Before installing an update, backup the current app bundle. If the crash guard detects 3 consecutive crashes on a new version, automatically restore the backup and notify the user.
- **Frontend OTA Hotfix** (optional/future): Self-hosted system for pushing web asset patches without a full app restart. Signed asset bundles downloaded to disk, applied via `location.reload()`.

## Capabilities

### New Capabilities
- `crash-guard`: Startup crash detection, crash counter persistence, Safe Mode startup, and frontend "ready" signal to reset the counter
- `staged-rollouts`: Rollout percentage in update manifest, machine-id based rollout gating, manual rollout control via `latest.json`
- `auto-rollback`: Pre-update app bundle backup, automatic restore on repeated crash, user notification of rollback
- `frontend-ota`: Self-hosted OTA hotfix system for web assets only — signed bundles, manifest check, asset override, and reload

### Modified Capabilities
- `architecture`: Startup bootstrap flow changes to integrate crash guard before Tauri build

## Impact

- **Rust backend**: `src-tauri/src/app/bootstrap.rs` (crash guard init), `src-tauri/src/app/plugins.rs` (conditional plugin loading in safe mode), `src-tauri/src/app/builder.rs` (safe mode branch)
- **Frontend**: New `useCrashGuard` hook or startup signal, updater store changes for rollout gating
- **Update infrastructure**: `latest.json` schema extended with `rollout` field, new `hotfix.json` endpoint (Phase 4)
- **File system**: New files in app data dir: `.crash-guard`, `previous/` backup directory
- **CI/CD**: Release workflow may need staged rollout tooling (manual `latest.json` editing initially)
