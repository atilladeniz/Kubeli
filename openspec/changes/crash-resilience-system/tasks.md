## 1. Crash Guard

- [ ] 1.1 Create `src-tauri/src/app/crash_guard.rs` module with CrashGuard struct: read/write `.crash-guard` JSON file in `app_data_dir`
- [ ] 1.2 Implement crash counter logic: increment on start, reset on version change, handle corrupted file gracefully
- [ ] 1.3 Add `is_safe_mode()` check: returns true when count >= 3 for current version
- [ ] 1.4 Wrap all crash guard file I/O in `catch_unwind` to prevent crash guard itself from crashing
- [ ] 1.5 Integrate crash guard into `bootstrap.rs::initialize()`: read counter before Tauri build, set SAFE_MODE flag
- [ ] 1.6 Modify `app/builder.rs`: skip `tauri-plugin-window-state`, tray setup, and auto-connect when SAFE_MODE is true
- [ ] 1.7 Add `crash_guard_ready` Tauri command that resets counter to 0
- [ ] 1.8 Call `crash_guard_ready` from frontend on successful App mount (App.tsx or equivalent)
- [ ] 1.9 Add Safe Mode banner component in frontend: "Started in Safe Mode due to repeated crashes. Restart to try normal mode."
- [ ] 1.10 Write unit tests for crash guard: counter increment, reset, version change, corrupted file, safe mode threshold
- [ ] 1.11 Write integration test: simulate 3 crashes and verify safe mode activation

## 2. Staged Rollouts

- [ ] 2.1 Add `rollout` field parsing to the update manifest (`latest.json`) deserialization
- [ ] 2.2 Implement machine-id hashing: `SHA256(machine-id) % 100` using `tauri-plugin-os` device identifier
- [ ] 2.3 Add rollout gating logic: compare hash against `rollout * 100`, treat missing/1.0 as full rollout
- [ ] 2.4 Handle machine-id unavailable: fall back to rollout 1.0
- [ ] 2.5 Integrate rollout check into the existing update check flow (skip update if user outside rollout)
- [ ] 2.6 Write unit tests for rollout gating: within range, outside range, full rollout, missing field, no machine-id

## 3. Auto-Rollback

- [ ] 3.1 Create backup module: `src-tauri/src/app/backup.rs` with platform-specific backup logic
- [ ] 3.2 Implement pre-update backup: copy current app to `app_data_dir/previous/` with metadata JSON before `downloadAndInstall()`
- [ ] 3.3 Implement macOS backup: `tar.gz` of `.app` bundle
- [ ] 3.4 Implement Windows backup: copy `.exe` + resources
- [ ] 3.5 Add rollback trigger in crash guard: when count >= 3 and backup exists with different version, restore and launch backup
- [ ] 3.6 Implement macOS restore: extract backup, launch via `open -n`, `_exit(0)`
- [ ] 3.7 Implement Windows restore: copy backup executable, launch via `Command::new()`
- [ ] 3.8 Add rollback notification in frontend: "The latest update caused issues. Your previous version has been restored."
- [ ] 3.9 Implement backup cleanup: delete backup after 7 days when crash counter is 0, maintain max one backup
- [ ] 3.10 Wire backup into the update flow in `useUpdater.tsx`: trigger backup before confirming update install
- [ ] 3.11 Write unit tests for backup/restore logic and cleanup

## 4. Frontend OTA Hotfix (Optional / Phase 4)

- [ ] 4.1 Design `hotfix.json` manifest format with `minAppVersion`, `maxAppVersion`, signed bundle URL
- [ ] 4.2 Implement hotfix check on app start: fetch `hotfix.json`, compare version range
- [ ] 4.3 Implement signed asset bundle verification using app's public key
- [ ] 4.4 Implement asset extraction to local hotfix directory
- [ ] 4.5 Implement asset override: serve hotfix assets from local directory instead of embedded bundle
- [ ] 4.6 Implement `location.reload()` apply with user notification: "A fix has been applied"
- [ ] 4.7 Implement hotfix cleanup on full app update
- [ ] 4.8 Write tests for hotfix flow: available, not available, invalid signature, version targeting
