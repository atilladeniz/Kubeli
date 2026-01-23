## ADDED Requirements

### Requirement: Homebrew Cask Distribution
The system SHALL provide a Homebrew Cask formula for installing Kubeli on macOS via the
`brew install --cask` command.

#### Scenario: Install via Homebrew tap
- **WHEN** a user runs `brew tap atilladeniz/kubeli`
- **AND** the user runs `brew install --cask kubeli`
- **THEN** the latest Kubeli DMG SHALL be downloaded from GitHub releases
- **AND** the DMG SHA256 SHALL be verified against the formula
- **AND** Kubeli.app SHALL be installed to `/Applications`

#### Scenario: Upgrade via Homebrew
- **WHEN** a new version of Kubeli is released
- **AND** a user runs `brew upgrade --cask kubeli`
- **THEN** the new version SHALL be downloaded and installed
- **AND** the previous version SHALL be replaced

#### Scenario: Uninstall via Homebrew
- **WHEN** a user runs `brew uninstall --cask kubeli --zap`
- **THEN** Kubeli.app SHALL be removed from `/Applications`
- **AND** application data in `~/Library/Application Support/com.kubeli` SHALL be removed
- **AND** caches in `~/Library/Caches/com.kubeli` SHALL be removed
- **AND** preferences in `~/Library/Preferences/com.kubeli.plist` SHALL be removed

### Requirement: Automated Cask Updates
The system SHALL automatically update the Homebrew Cask formula when a new version is released.

#### Scenario: Cask updated on release
- **WHEN** a new version tag is pushed
- **AND** the release workflow completes successfully
- **THEN** the Homebrew tap repository SHALL be updated with new version and SHA256
- **AND** a commit SHALL be pushed to the tap repository

#### Scenario: Manual Cask update
- **WHEN** a maintainer runs `make brew-update`
- **THEN** the script SHALL download the current release DMG
- **AND** calculate the SHA256 checksum
- **AND** update the Cask formula with new version and checksum
- **AND** commit and push to the tap repository

### Requirement: Livecheck Support
The Cask formula SHALL support Homebrew's livecheck feature for version detection.

#### Scenario: Livecheck detects new version
- **WHEN** Homebrew runs `brew livecheck kubeli`
- **THEN** the latest version SHALL be detected from GitHub releases
- **AND** the result SHALL indicate if an update is available
