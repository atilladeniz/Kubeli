## ADDED Requirements

### Requirement: SBOM-based Vulnerability Scanning
The system SHALL scan generated SBOMs for known vulnerabilities using Trivy.

#### Scenario: CI SBOM vulnerability scan
- **GIVEN** a pull request or push to main
- **WHEN** CI runs security scanning
- **THEN** Trivy scans sbom-npm.json and sbom-rust.json
- **AND** results are uploaded to GitHub Security tab as SARIF
- **AND** HIGH/CRITICAL findings are flagged

### Requirement: Secret and Misconfiguration Scanning
The system SHALL scan the filesystem for secrets and misconfigurations.

#### Scenario: CI secret scan
- **GIVEN** a pull request or push to main
- **WHEN** CI runs Trivy filesystem scan
- **THEN** secrets and misconfigurations are detected
- **AND** results are uploaded to GitHub Security tab

### Requirement: Static Code Analysis (SAST)
The system SHALL run static code analysis using Semgrep with TypeScript, Rust, and security rulesets.

#### Scenario: CI SAST scan
- **GIVEN** a pull request or push to main
- **WHEN** CI runs Semgrep
- **THEN** TypeScript, Rust, and security patterns are scanned
- **AND** results are uploaded to GitHub Security tab as SARIF

### Requirement: Local Security Scanning
Developers SHALL be able to run security scans locally via Makefile targets.

#### Scenario: Local scan execution
- **WHEN** a developer runs `make security-scan`
- **THEN** Trivy and Semgrep scans execute via Docker
- **AND** results are displayed in terminal

### Requirement: Scan Configuration
The system SHALL provide configuration files for customizing scan behavior.

#### Scenario: Trivy configuration
- **GIVEN** trivy.yaml and trivy-secret.yaml in repo root
- **THEN** Trivy uses configured severity thresholds and secret rules

#### Scenario: Semgrep configuration
- **GIVEN** .semgrep.yaml in repo root
- **THEN** Semgrep applies custom rules for TypeScript and Rust
