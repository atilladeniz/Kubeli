# windows-code-signing Specification

## Purpose

Authenticode code signing for Windows binaries via SignPath Foundation, integrated into the CI/CD release pipeline.

## ADDED Requirements

### Requirement: Windows Authenticode Signing

The release pipeline SHALL sign all Windows NSIS installer executables with a trusted Authenticode certificate via SignPath Foundation before publishing them as release assets.

#### Scenario: Successful signing during release

- **WHEN** a release tag (`v*`) is pushed and the Windows build completes
- **THEN** the unsigned NSIS installer `.exe` is submitted to SignPath for Authenticode signing
- **AND** the signed `.exe` replaces the unsigned artifact
- **AND** the signed `.exe` is uploaded to the GitHub Release

#### Scenario: Signed installer on Windows

- **GIVEN** a user downloads the signed NSIS installer on Windows
- **WHEN** the user runs the installer
- **THEN** Windows SmartScreen shows "SignPath Foundation" as the verified publisher
- **AND** no "Unknown Publisher" warning is displayed

### Requirement: SignPath CI Integration

The signing process SHALL use SignPath's GitHub Actions integration with origin verification enabled.

#### Scenario: GitHub Actions signing step

- **GIVEN** the `publish.yml` workflow runs on a `v*` tag push
- **WHEN** the Windows build job reaches the signing step
- **THEN** the `signpath/github-action-submit-signing-request` action submits the artifact
- **AND** SignPath verifies the build originated from the configured repository
- **AND** the action waits for signing completion and downloads the signed artifact

#### Scenario: Required GitHub Secrets

- **GIVEN** a fresh CI environment
- **WHEN** the signing step executes
- **THEN** it requires `SIGNPATH_API_TOKEN`, `SIGNPATH_ORGANIZATION_ID`, `SIGNPATH_PROJECT_SLUG`, and `SIGNPATH_SIGNING_POLICY_SLUG` secrets

### Requirement: Signing Failure Handling

The release pipeline SHALL handle signing failures gracefully without blocking the entire release.

#### Scenario: SignPath service unavailable

- **GIVEN** SignPath is unreachable or returns an error
- **WHEN** the signing step fails
- **THEN** the Windows build job fails
- **AND** other platform builds (macOS, Linux) are not affected
- **AND** the release remains in draft state for manual intervention

#### Scenario: Workflow re-run after failure

- **GIVEN** a signing step has failed
- **WHEN** a maintainer re-runs the failed Windows build job
- **THEN** the signing step retries from scratch
- **AND** a successful signing completes the release normally

### Requirement: Code Signing Policy Page

The project SHALL maintain a public code signing policy page as required by SignPath Foundation terms of use.

#### Scenario: Policy page content

- **GIVEN** the kubeli.dev landing page
- **WHEN** a user navigates to `/code-signing-policy`
- **THEN** the page states that Windows binaries are signed via SignPath Foundation
- **AND** the page links to the SignPath Foundation website
- **AND** the page provides instructions for verifying the signature
- **AND** the page links to the source repository

### Requirement: Updater Compatibility

Authenticode signing SHALL not interfere with the existing Tauri updater signing mechanism.

#### Scenario: Dual signing coexistence

- **GIVEN** a signed Windows NSIS installer
- **WHEN** the Tauri updater checks for updates
- **THEN** the updater verifies the `.sig` file (Tauri signing) independently of Authenticode
- **AND** both signatures are present on the released artifact
