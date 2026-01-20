## ADDED Requirements

### Requirement: Dependency and Configuration Scanning
The system SHALL run dependency and configuration security scans in CI using Trivy.

#### Scenario: CI dependency scan
- GIVEN a pull request or release tag
- WHEN CI runs security scanning
- THEN Trivy scans dependencies and configuration
- AND the job fails on HIGH or CRITICAL findings

### Requirement: Static Code Scanning
The system SHALL run static code analysis in CI using Semgrep with a project ruleset.

#### Scenario: CI code scan
- GIVEN a pull request
- WHEN CI runs Semgrep
- THEN the codebase is scanned
- AND the job fails on findings that match the ruleset

### Requirement: Scan Reports
The system SHALL publish scan results in the CI output or as artifacts.

#### Scenario: Report visibility
- WHEN a scan runs in CI
- THEN results are visible in logs or uploaded as artifacts
