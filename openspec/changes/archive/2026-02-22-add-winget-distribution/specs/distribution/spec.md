## ADDED Requirements

### Requirement: Windows Package Manager (winget) Distribution
The system SHALL provide a winget package manifest for installing Kubeli on Windows via the
`winget install` command.

#### Scenario: Install via winget
- **WHEN** a user runs `winget install Kubeli.Kubeli`
- **THEN** the latest Kubeli NSIS installer SHALL be downloaded from GitHub releases
- **AND** the installer SHA256 SHALL be verified against the manifest
- **AND** Kubeli SHALL be installed to the user's system

#### Scenario: Silent install
- **WHEN** a user runs `winget install Kubeli.Kubeli --silent`
- **THEN** the installation SHALL complete without user interaction
- **AND** no UI dialogs SHALL be displayed

#### Scenario: Upgrade via winget
- **WHEN** a new version of Kubeli is released
- **AND** a user runs `winget upgrade Kubeli.Kubeli`
- **THEN** the new version SHALL be downloaded and installed
- **AND** the previous version SHALL be replaced

#### Scenario: Uninstall via winget
- **WHEN** a user runs `winget uninstall Kubeli.Kubeli`
- **THEN** Kubeli SHALL be removed from the system
- **AND** the uninstaller SHALL clean up application files

### Requirement: Multi-Architecture Windows Support
The system SHALL provide Windows installers for both x64 and ARM64 architectures.

#### Scenario: x64 installation
- **WHEN** a user on Windows x64 runs `winget install Kubeli.Kubeli`
- **THEN** the x64 NSIS installer SHALL be downloaded and executed

#### Scenario: ARM64 installation
- **WHEN** a user on Windows ARM64 runs `winget install Kubeli.Kubeli`
- **THEN** the ARM64 NSIS installer SHALL be downloaded and executed

### Requirement: Automated Winget Manifest Updates
The system SHALL automatically update the winget manifest when a new version is released.

#### Scenario: Manifest PR created on release
- **WHEN** a new version tag is pushed
- **AND** the Windows build completes successfully
- **THEN** a Pull Request SHALL be created to `microsoft/winget-pkgs`
- **AND** the PR SHALL contain updated manifests with new version and SHA256 hashes

#### Scenario: Manual manifest update
- **WHEN** a maintainer runs `make winget-update`
- **THEN** the script SHALL generate manifest files for the current release
- **AND** calculate SHA256 checksums for all installers
- **AND** create a PR to the winget-pkgs repository

### Requirement: NSIS Installer Configuration
The system SHALL produce NSIS installers compatible with winget requirements.

#### Scenario: Installer meets winget standards
- **WHEN** the Windows build completes
- **THEN** the NSIS installer SHALL support silent installation (`/S` flag)
- **AND** the installer SHALL register the application for winget detection
- **AND** the installer SHALL create standard uninstall registry entries
