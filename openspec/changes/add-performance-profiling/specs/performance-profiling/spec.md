## ADDED Requirements

### Requirement: Quick Performance Profiling

The system SHALL provide a `make perf-quick` target that measures basic resource usage without external dependencies.

#### Scenario: Quick profiling run
- **WHEN** developer runs `make perf-quick`
- **AND** a release build exists at `src-tauri/target/release/bundle/macos/Kubeli.app`
- **THEN** the system launches Kubeli, samples metrics for 10 seconds
- **AND** reports: binary size, bundle size, startup time, peak/avg RSS, peak/avg CPU
- **AND** saves report to `.perf/report-<timestamp>.txt`

#### Scenario: Custom duration
- **WHEN** developer runs `make perf-quick DURATION=20`
- **THEN** the system samples metrics for 20 seconds instead of the default 10

#### Scenario: No release build available
- **WHEN** developer runs `make perf-quick`
- **AND** no release build exists
- **THEN** the system displays error: "Release build not found. Run 'make build' first."

---

### Requirement: Full Performance Profiling

The system SHALL provide a `make perf` target that uses Xcode Instruments for deep profiling.

#### Scenario: Full profiling run
- **WHEN** developer runs `make perf`
- **AND** Xcode command line tools are installed
- **AND** a release build exists
- **THEN** the system runs `xctrace record` with Allocations template
- **AND** saves `.trace` file to `.perf/` directory
- **AND** prints summary report with peak memory and CPU metrics

#### Scenario: Xcode not installed
- **WHEN** developer runs `make perf`
- **AND** `xctrace` is not available
- **THEN** the system displays error: "Xcode CLI tools required. Run 'xcode-select --install'"
- **AND** suggests `make perf-quick` as alternative

#### Scenario: Open trace in Instruments
- **WHEN** developer runs `make perf-open`
- **THEN** the system opens the most recent `.trace` file in Instruments.app

---

### Requirement: Performance Report Format

The system SHALL generate human-readable performance reports.

#### Scenario: Report content
- **WHEN** a profiling run completes
- **THEN** the report includes: app version, date, duration, binary size, bundle size, startup time, memory metrics (peak/avg RSS), CPU metrics (peak/avg %)

#### Scenario: Report persistence
- **WHEN** a profiling run completes
- **THEN** the report is saved to `.perf/report-<timestamp>.txt`
- **AND** previous reports are preserved for comparison
