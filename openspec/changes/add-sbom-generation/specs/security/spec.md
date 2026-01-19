## ADDED Requirements

### Requirement: SBOM Generation

The system SHALL generate Software Bill of Materials (SBOM) documentation in CycloneDX format for both npm and Rust dependencies.

#### Scenario: NPM Dependencies SBOM

- **WHEN** a developer runs `make sbom-npm`
- **THEN** a `sbom-npm.json` file in CycloneDX format is created
- **AND** the file contains all npm dependencies with versions

#### Scenario: Rust Dependencies SBOM

- **WHEN** a developer runs `make sbom-rust`
- **THEN** a `sbom-rust.json` file in CycloneDX format is created
- **AND** the file contains all Cargo crates with versions

#### Scenario: Combined SBOM Generation

- **WHEN** a developer runs `make sbom`
- **THEN** both SBOM files are generated

### Requirement: SBOM in Releases

Each GitHub Release SHALL automatically include SBOM files as release assets.

#### Scenario: Release SBOM Artifacts

- **WHEN** a new release tag is pushed
- **THEN** GitHub Actions generates the SBOM files
- **AND** attaches `sbom-npm.json` and `sbom-rust.json` as release assets

### Requirement: SBOM Format Compliance

SBOM files SHALL conform to the CycloneDX standard.

#### Scenario: Format Validation

- **WHEN** an SBOM file is generated
- **THEN** it is valid JSON
- **AND** conforms to the CycloneDX 1.4+ schema
