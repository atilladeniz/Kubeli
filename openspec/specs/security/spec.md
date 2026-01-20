# security Specification

## Purpose
TBD - created by archiving change add-sbom-generation. Update Purpose after archive.
## Requirements
### Requirement: SBOM Generation

The system SHALL generate Software Bill of Materials (SBOM) documentation in CycloneDX 1.5 format for both npm and Rust production dependencies.

#### Scenario: NPM Dependencies SBOM

- **WHEN** a developer runs `make sbom-npm`
- **THEN** a `sbom-npm.json` file in CycloneDX 1.5 format is created
- **AND** the file contains production npm dependencies only (dev excluded)

#### Scenario: Rust Dependencies SBOM

- **WHEN** a developer runs `make sbom-rust`
- **THEN** a `sbom-rust.json` file in CycloneDX 1.5 format is created
- **AND** the file contains production Cargo crates only (build deps excluded)

#### Scenario: Combined SBOM Generation

- **WHEN** a developer runs `make sbom`
- **THEN** both SBOM files are generated

### Requirement: SBOM Validation

SBOM files SHALL be validated against the CycloneDX schema before release.

#### Scenario: CI Validation

- **WHEN** SBOMs are generated in CI
- **THEN** cyclonedx-cli validates both files against CycloneDX 1.5 schema
- **AND** the pipeline fails if validation fails (--fail-on-errors)

#### Scenario: Local Validation

- **WHEN** a developer runs `make sbom-validate`
- **THEN** both SBOMs are generated and validated via Docker

### Requirement: SBOM in Releases

Each GitHub Release SHALL automatically include validated SBOM files as release assets.

#### Scenario: Release SBOM Artifacts

- **WHEN** a new release tag (v*) is pushed
- **THEN** GitHub Actions generates and validates the SBOM files
- **AND** attaches `sbom-npm.json` and `sbom-rust.json` as release assets

#### Scenario: Local Release via build-deploy

- **WHEN** a developer runs `make build-deploy`
- **THEN** SBOMs are generated after build
- **AND** attached to the GitHub release alongside the DMG

### Requirement: SBOM Format Compliance

SBOM files SHALL conform to the CycloneDX 1.5 standard for enterprise compatibility.

#### Scenario: Format Specification

- **GIVEN** generated SBOM files
- **THEN** they are valid JSON
- **AND** conform to the CycloneDX 1.5 schema
- **AND** are compatible with Grype, Trivy, Snyk, and Dependency-Track

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

