## ADDED Requirements

### Requirement: Crash counter persistence
The system SHALL maintain a JSON file `.crash-guard` in the app data directory that tracks consecutive startup failures. The file MUST contain: `count` (integer), `version` (string), and `lastCrash` (ISO timestamp or null).

#### Scenario: First ever launch
- **WHEN** the app starts and no `.crash-guard` file exists
- **THEN** the system creates it with `{ "count": 1, "version": "<current>", "lastCrash": null }`

#### Scenario: Normal startup increments counter
- **WHEN** the app starts and `.crash-guard` exists with count < 3
- **THEN** the system increments `count` by 1 and writes the file before proceeding with Tauri build

#### Scenario: Corrupted crash guard file
- **WHEN** the app starts and `.crash-guard` exists but cannot be parsed as valid JSON
- **THEN** the system treats it as a fresh start (count=0) and overwrites with a new file

### Requirement: Crash counter reset on successful startup
The system SHALL reset the crash counter to 0 when the frontend signals successful initialization.

#### Scenario: Frontend reports ready
- **WHEN** the frontend invokes the `crash_guard_ready` Tauri command
- **THEN** the system writes `.crash-guard` with `count: 0` and the current version

#### Scenario: Version change resets counter
- **WHEN** the app starts and `.crash-guard` contains a different version than the running binary
- **THEN** the system resets `count` to 1 (fresh start for new version)

### Requirement: Safe Mode activation
The system SHALL enter Safe Mode when the crash counter reaches 3 or more for the same version.

#### Scenario: Third consecutive crash triggers Safe Mode
- **WHEN** the app starts and `.crash-guard` shows count >= 3 for the current version
- **THEN** the system sets a `SAFE_MODE` flag before Tauri build

#### Scenario: Safe Mode disables non-essential features
- **WHEN** the app starts in Safe Mode
- **THEN** the system MUST skip: window-state plugin, tray icon setup, and auto-connect to last cluster
- **AND** the system MUST keep: main window, all Tauri commands, full frontend functionality

### Requirement: Safe Mode user notification
The system SHALL inform the user when running in Safe Mode.

#### Scenario: Safe Mode banner displayed
- **WHEN** the app starts in Safe Mode
- **THEN** the frontend MUST display a banner: "Started in Safe Mode due to repeated crashes. Restart to try normal mode."

#### Scenario: Safe Mode exit
- **WHEN** the user restarts the app after a Safe Mode session
- **THEN** the crash counter has been reset (by the successful "ready" signal) and normal mode resumes

### Requirement: Crash guard resilience
The crash guard code itself MUST NOT cause crashes.

#### Scenario: File system error during crash guard
- **WHEN** the `.crash-guard` file cannot be read or written (permissions, disk full)
- **THEN** the system logs a warning and continues with normal startup (no Safe Mode)
