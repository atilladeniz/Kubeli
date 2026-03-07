## ADDED Requirements

### Requirement: OTA hotfix manifest check
The system SHALL check a `hotfix.json` endpoint for available frontend-only patches.

#### Scenario: Hotfix available
- **WHEN** `hotfix.json` contains a patch for the current app version
- **THEN** the system downloads the signed asset bundle

#### Scenario: No hotfix available
- **WHEN** `hotfix.json` does not contain a patch for the current version or the endpoint returns 404
- **THEN** the system does nothing

#### Scenario: Hotfix version targeting
- **WHEN** `hotfix.json` contains `minAppVersion` and `maxAppVersion` fields
- **THEN** the system only applies the hotfix if the current app version is within range

### Requirement: Signed asset bundles
The system SHALL verify the signature of OTA asset bundles before applying them.

#### Scenario: Valid signature
- **WHEN** the downloaded asset bundle has a valid signature matching the app's public key
- **THEN** the system extracts the assets to the local hotfix directory

#### Scenario: Invalid signature
- **WHEN** the downloaded asset bundle has an invalid or missing signature
- **THEN** the system rejects the bundle and logs an error

### Requirement: Asset override on load
The system SHALL serve hotfix assets from the local directory instead of the embedded bundle when available.

#### Scenario: Hotfix assets present
- **WHEN** the app starts and a valid hotfix directory exists with assets for the current version
- **THEN** the webview loads assets from the hotfix directory instead of the embedded bundle

#### Scenario: Hotfix assets missing or corrupted
- **WHEN** the hotfix directory is missing, empty, or fails integrity check
- **THEN** the webview falls back to the embedded bundle

### Requirement: Apply hotfix without restart
The system SHALL apply frontend hotfixes without requiring a full app restart.

#### Scenario: Hotfix applied via reload
- **WHEN** a hotfix is downloaded and verified
- **THEN** the system calls `location.reload()` to apply the new assets
- **AND** the user sees a brief notification: "A fix has been applied"

### Requirement: Hotfix cleanup on full update
The system SHALL remove hotfix assets when a full app update is installed.

#### Scenario: Full update clears hotfix
- **WHEN** a full app update is installed (via the standard updater)
- **THEN** the system deletes the hotfix asset directory
