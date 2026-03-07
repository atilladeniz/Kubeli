## Context

Kubeli v0.3.56 had a startup crash caused by two issues: the `tauri-plugin-window-state` restoring invalid tray-popup state, and the `relaunch()` API triggering a double-panic on macOS. The immediate fixes shipped in v0.3.57 (#191), but users on v0.3.56 experienced one unavoidable crash during the transition because the old binary executed the buggy restart path.

Currently Kubeli has no crash recovery, no staged rollouts, and no rollback capability. If a release introduces a startup crash, users are stuck until they manually download a new version.

The app bootstrap flow is: `main()` → `initialize()` (panic hook, PATH, args) → `install_rustls_provider()` → `app::builder::run()` (plugins, setup, build, run). The crash guard must intercept before the Tauri build phase.

## Goals / Non-Goals

**Goals:**
- Self-healing startup: app recovers from crash loops without user intervention
- Gradual rollout: limit blast radius of broken releases
- Automatic rollback: restore previous working version if new version crashes repeatedly
- All mechanisms work offline (no server dependency for recovery)

**Non-Goals:**
- Crash telemetry/reporting (separate concern)
- Frontend OTA hotfix system (Phase 4, deferred — design will be done separately when needed)
- Server-side rollout management dashboard
- Mobile platform support

## Decisions

### 1. Crash Guard: File-based counter in app data dir

**Choice**: JSON file `.crash-guard` in `app_data_dir` read/written in Rust before Tauri build.

**Alternatives considered**:
- SQLite row in existing `ai_sessions.db` — rejected: DB init happens in Tauri `setup()`, too late
- Environment variable passed across restarts — rejected: not persistent across manual relaunches
- macOS `UserDefaults` / Windows registry — rejected: not cross-platform

**Flow**:
```
bootstrap.rs::initialize()
  ├─ read .crash-guard (or create with count=0)
  ├─ if count >= 3 AND same version → set SAFE_MODE = true
  ├─ increment count, write file
  ├─ continue normal startup...
  │
app::builder::run()
  ├─ if SAFE_MODE → skip window-state plugin, skip tray setup
  ├─ build & run Tauri app
  │
Frontend (App.tsx mount)
  ├─ invoke("crash_guard_ready") → resets count to 0
```

**Safe Mode disables**:
- `tauri-plugin-window-state` (known crash source)
- Tray icon + popup setup (ObjC code, known crash source)
- Auto-connect to last cluster (network issues on boot)

**Safe Mode keeps**:
- Main window, all Tauri commands, all frontend functionality
- User sees a banner: "Started in Safe Mode due to repeated crashes"

### 2. Staged Rollouts: Client-side gating via `latest.json`

**Choice**: Add `rollout` field (0.0–1.0) to `latest.json`. Frontend computes `hash(machine-id) % 100 < rollout * 100` to decide whether to show the update.

**Alternatives considered**:
- Server-side gating per user — rejected: requires backend, overkill for our scale
- Separate update channels (stable/beta) — complementary but doesn't solve gradual rollout

**Machine-ID source**: `tauri-plugin-os` provides a stable device identifier. Hash with SHA-256 to get uniform distribution.

**Manual control**: Release engineer edits `rollout` field in the GitHub Release `latest.json` asset. Start at 0.1, wait 24h, bump to 0.5, wait 24h, then 1.0.

### 3. Auto-Rollback: Backup bundle before update install

**Choice**: Before `update.downloadAndInstall()`, copy current app to `app_data_dir/previous/`. If crash guard triggers on the new version (count >= 3, different version than backup), restore backup and launch it.

**Alternatives considered**:
- Keep N previous versions — rejected: disk space concern, one backup is sufficient
- OS-level snapshot (APFS/btrfs) — rejected: not cross-platform, requires privileges

**Backup format**:
- macOS: `tar.gz` of `Kubeli.app` bundle
- Windows: Copy of `Kubeli.exe` + resources
- Linux: Copy of `AppImage`

**Restore flow**:
```
bootstrap.rs (count >= 3, new version)
  ├─ if previous/backup exists AND backup version != current version
  │    ├─ extract backup to temp location
  │    ├─ spawn backup executable
  │    ├─ _exit(0)
  └─ else → enter Safe Mode (no backup available)
```

## Risks / Trade-offs

**[Risk] Crash in crash guard code itself** → Mitigation: Crash guard is pure file I/O with no dependencies. If the file is corrupted, treat as count=0 (fresh start). Wrap all crash guard code in `catch_unwind`.

**[Risk] Safe Mode confuses users** → Mitigation: Clear banner in UI explaining what happened and how to exit Safe Mode (restart app). Safe Mode is functional — all core features work, just no tray/window-state.

**[Risk] Rollback to old version loses new data** → Mitigation: App data (SQLite, settings) is forward-compatible by design. Old version reads what it understands, ignores new fields.

**[Risk] Staged rollout is manual** → Mitigation: Acceptable for current scale (<1000 users). Automate later if needed. Document the process in release runbook.

**[Risk] Backup takes disk space (~15MB)** → Mitigation: One backup only. Delete after 30 days or when user is stable on new version (count reset to 0 after successful start).

**[Trade-off] Safe Mode disables tray** → Acceptable: tray is convenience, not core functionality. Users can still use the main window for everything.

**[Trade-off] First update from pre-crash-guard version has no protection** → Unavoidable bootstrap problem (same as v0.3.56→v0.3.57). After crash guard ships, all future versions are protected.
