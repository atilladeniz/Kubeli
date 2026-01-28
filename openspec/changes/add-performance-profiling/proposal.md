# Change: Add performance profiling via `make perf`

## Why
There is no automated way to measure Kubeli's resource usage (RAM, CPU, startup time). Developers need to manually open Activity Monitor or Xcode Instruments to get basic metrics. A single-command profiling target would make performance regression testing simple and repeatable.

## What Changes
- Add `make perf` target that launches Kubeli, profiles it, and generates a report
- Add `make perf-quick` for lightweight metrics without Xcode dependency
- Add `scripts/perf-report.sh` profiling script
- Store reports in `.perf/` directory (gitignored)

## Impact
- Affected specs: none (new capability)
- Affected code: `Makefile`, new `scripts/perf-report.sh`
- No changes to application code
