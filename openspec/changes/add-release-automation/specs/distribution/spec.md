## ADDED Requirements

### Requirement: Automated Release Pipeline
The system SHALL provide an automated release pipeline via GitHub Actions that builds, signs, and
publishes release artifacts when a version tag is pushed.

#### Scenario: Tag triggers release build
- **WHEN** a tag matching `v*` pattern is pushed to the repository
- **THEN** the release workflow SHALL be triggered automatically
- **AND** builds SHALL be created for macOS ARM64 and x86_64 architectures
- **AND** builds SHALL be created for Windows x64 architecture

#### Scenario: Manual release trigger
- **WHEN** a maintainer triggers the workflow manually via `workflow_dispatch`
- **THEN** the release workflow SHALL execute with the current branch state
- **AND** a draft release SHALL be created

#### Scenario: macOS build artifacts signed
- **WHEN** the macOS build completes
- **THEN** the application bundle SHALL be code-signed with Apple Developer ID
- **AND** the application SHALL be notarized with Apple
- **AND** the DMG installer SHALL be created

#### Scenario: Windows build artifacts generated
- **WHEN** the Windows build completes on `windows-latest` runner
- **THEN** an MSI installer SHALL be generated at `bundle/msi/*.msi`
- **AND** an NSIS installer SHALL be generated at `bundle/nsis/*.exe`
- **AND** both installers SHALL be uploaded as release artifacts

#### Scenario: Windows build artifacts signed
- **WHEN** the Windows build completes
- **THEN** the MSI installer SHALL be code-signed with the Windows certificate
- **AND** the NSIS installer SHALL be code-signed with the Windows certificate
- **AND** the signed installers SHALL pass Windows SmartScreen validation

#### Scenario: SBOM generation
- **WHEN** the release build completes
- **THEN** CycloneDX SBOMs SHALL be generated for npm and Rust dependencies
- **AND** SBOM files SHALL be attached to the GitHub release

### Requirement: Tauri Update Artifacts
The system SHALL generate update artifacts compatible with the Tauri updater plugin.

#### Scenario: Update bundle created
- **WHEN** the build completes successfully
- **THEN** a signed `.app.tar.gz` update bundle SHALL be created
- **AND** a signature file (`.sig`) SHALL be generated using the Tauri signing key

#### Scenario: Update manifest generation
- **WHEN** the FTP deployment is enabled
- **THEN** a `latest.json` manifest SHALL be generated with version, signature, and download URL
- **AND** the manifest SHALL be uploaded to the configured update endpoint

### Requirement: Local Release Preparation
The system SHALL provide Makefile commands for preparing releases locally.

#### Scenario: Interactive release preparation
- **WHEN** a maintainer runs `make release`
- **THEN** the version SHALL be bumped interactively (patch/minor/major)
- **AND** the changelog SHALL be generated using Claude CLI
- **AND** a confirmation prompt SHALL be shown before creating the git tag

#### Scenario: Release push
- **WHEN** a maintainer runs `make release-push`
- **THEN** the release tag SHALL be pushed to the remote repository
- **AND** the CI release workflow SHALL be triggered
