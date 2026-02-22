## Context

Kubeli is a Tauri 2.0 desktop app with a Rust backend and Next.js/WKWebView frontend. Profiling requires measuring both the native Rust process and the WebView rendering layer. macOS provides `xctrace` (CLI for Xcode Instruments) which can profile any running process without modification.

## Goals / Non-Goals

**Goals:**
- One-command profiling: `make perf`
- Measure: RAM (peak/avg), CPU (peak/avg), startup time, binary size
- Generate human-readable report (terminal + optional file)
- No app code changes required
- Work with release builds

**Non-Goals:**
- Flamegraph generation (separate `cargo flamegraph` workflow)
- Frontend-specific React profiling (use WebView DevTools)
- CI integration (local developer tool only)
- Windows/Linux support (macOS-only, uses `xctrace`)

## Decisions

### Decision: Two-Tier Profiling

**Tier 1: `make perf-quick` (no Xcode needed)**
- Uses `top`, `ps`, `/usr/bin/time` for basic metrics
- Reports: startup time, peak RSS, CPU %, binary size
- Runs for configurable duration (default 10s)
- Zero dependencies beyond macOS built-ins

**Tier 2: `make perf` (requires Xcode)**
- Uses `xctrace record` with Allocations template
- Full memory allocation tracking, leak detection
- Generates `.trace` file openable in Instruments
- Parses key metrics from trace into summary report

Rationale: Not every developer has Xcode installed. Tier 1 provides useful metrics with zero setup. Tier 2 gives deep analysis when needed.

### Decision: Profiling Workflow

```
make perf [DURATION=30]
    │
    ├──► 1. Verify release build exists (or prompt to build)
    │
    ├──► 2. Record binary size
    │
    ├──► 3. Launch Kubeli via xctrace record
    │         --template 'Allocations'
    │         --time-limit ${DURATION}s
    │         --output .perf/kubeli-<timestamp>.trace
    │
    ├──► 4. Extract metrics from trace (xctrace export)
    │
    ├──► 5. Collect additional metrics (binary size, startup)
    │
    └──► 6. Print summary report + save to .perf/report-<timestamp>.txt
```

### Decision: Quick Profiling Workflow

```
make perf-quick [DURATION=10]
    │
    ├──► 1. Verify release build exists
    │
    ├──► 2. Record binary size + app bundle size
    │
    ├──► 3. Launch Kubeli in background, record start time
    │
    ├──► 4. Sample metrics every 1s for DURATION seconds
    │         - RSS (Resident Set Size)
    │         - Virtual memory
    │         - CPU %
    │
    ├──► 5. Kill Kubeli process
    │
    └──► 6. Print summary:
             - Startup time (time until process appears)
             - Peak RSS / Average RSS
             - Peak CPU% / Average CPU%
             - Binary size / Bundle size
```

### Decision: Report Format

Terminal output with comparison-friendly format:

```
═══════════════════════════════════════════
  Kubeli Performance Report
  Version: 0.3.6 | Date: 2026-01-28
  Duration: 30s | Mode: quick
═══════════════════════════════════════════

  Binary Size:      12.4 MB
  Bundle Size:      28.7 MB (.app)

  Startup Time:     ~320 ms

  Memory (RSS):
    Peak:           48.2 MB
    Average:        35.1 MB
    At Idle:        31.4 MB

  CPU Usage:
    Peak:           12.3%
    Average:         2.1%
    At Idle:         0.4%

═══════════════════════════════════════════
  Saved: .perf/report-20260128-143022.txt
═══════════════════════════════════════════
```

### Decision: Output Directory

Reports stored in `.perf/` at project root:
- `.perf/` added to `.gitignore`
- Trace files: `.perf/kubeli-<timestamp>.trace`
- Text reports: `.perf/report-<timestamp>.txt`
- Keeps history for manual comparison

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Xcode not installed | `make perf-quick` works without Xcode |
| Build not available | Check and prompt `make build` first |
| App needs cluster to be useful | Profile idle state; real usage requires manual interaction |
| xctrace needs permissions | First run may require granting Developer Tools access |

## Open Questions

1. Should `make perf` automatically interact with the app (e.g., click through screens)?
2. Should we add a `make perf-compare` that diffs two reports?
3. Should we track perf baselines in the repo for regression detection?
