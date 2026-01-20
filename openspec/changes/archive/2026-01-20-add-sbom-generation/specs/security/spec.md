## ADDED Requirements

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
