## 1. Script - `scripts/perf-report.sh`

- [ ] 1.1 Create `scripts/perf-report.sh` with two modes: `quick` and `full`
- [ ] 1.2 Implement `quick` mode:
  - Locate Kubeli binary in `src-tauri/target/release/bundle/macos/Kubeli.app`
  - Record binary size (`stat`) and bundle size (`du -sh`)
  - Launch app in background, record PID and start timestamp
  - Wait for process to appear (measure startup time)
  - Sample `ps -o rss,vsz,%cpu -p $PID` every 1 second for DURATION
  - Compute peak/average RSS, peak/average CPU
  - Kill process, print report
- [ ] 1.3 Implement `full` mode:
  - Check `xctrace` is available (`xcrun xctrace version`)
  - Create `.perf/` output directory
  - Run `xctrace record --template 'Allocations' --time-limit ${DURATION}s --output .perf/kubeli-<ts>.trace --launch -- <binary-path>`
  - Export table of contents: `xctrace export --input <trace> --toc`
  - Parse peak memory from trace summary
  - Print report with trace file path
- [ ] 1.4 Report output:
  - Print formatted summary to terminal
  - Save copy to `.perf/report-<timestamp>.txt`
  - Include version number from `package.json`

## 2. Makefile Targets

- [ ] 2.1 Add `perf-quick` target:
  ```makefile
  perf-quick: ## Quick performance check (no Xcode needed)
  	@./scripts/perf-report.sh quick $(or $(DURATION),10)
  ```
- [ ] 2.2 Add `perf` target:
  ```makefile
  perf: ## Full performance profile with Xcode Instruments
  	@./scripts/perf-report.sh full $(or $(DURATION),30)
  ```
- [ ] 2.3 Add `perf-open` target to open last trace in Instruments:
  ```makefile
  perf-open: ## Open last performance trace in Instruments
  	@open $(shell ls -t .perf/*.trace 2>/dev/null | head -1)
  ```
- [ ] 2.4 Add targets to `.PHONY` declaration

## 3. Project Configuration

- [ ] 3.1 Add `.perf/` to `.gitignore`
- [ ] 3.2 Ensure `scripts/perf-report.sh` is executable (`chmod +x`)

## 4. Documentation

- [ ] 4.1 Add Performance section to Makefile help output
- [ ] 4.2 Update `CLAUDE.md` with perf commands in Development Commands table

## Dependencies

- Task 1.x must complete before 2.x (script before Makefile targets)
- Task 3.x can run in parallel with 1.x
- Task 4.x after 2.x
