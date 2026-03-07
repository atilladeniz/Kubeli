## ADDED Requirements

### Requirement: Pre-update backup
The system SHALL create a backup of the current app binary before installing an update.

#### Scenario: Backup created before update install
- **WHEN** the user confirms an update installation
- **THEN** the system copies the current app to `app_data_dir/previous/` before downloading and installing
- **AND** the backup includes a metadata file with `{ "version": "<backed-up-version>", "date": "<ISO timestamp>" }`

#### Scenario: Backup already exists
- **WHEN** a backup from a previous update already exists in `previous/`
- **THEN** the system overwrites it with the current version's backup

#### Scenario: Backup fails
- **WHEN** the backup cannot be created (disk space, permissions)
- **THEN** the system logs a warning and proceeds with the update without backup

### Requirement: Automatic rollback on crash loop
The system SHALL automatically restore the backup when the crash guard detects repeated failures on a new version.

#### Scenario: Rollback triggered
- **WHEN** the crash guard detects count >= 3 for the current version
- **AND** a backup exists in `previous/` with a different version
- **THEN** the system extracts the backup, launches the old version, and exits the current process

#### Scenario: No backup available
- **WHEN** the crash guard detects count >= 3
- **AND** no backup exists or backup version matches current version
- **THEN** the system enters Safe Mode instead of rolling back

#### Scenario: Rollback on macOS
- **WHEN** rollback is triggered on macOS
- **THEN** the system extracts the `.app` bundle from the backup and launches it via `open -n`

#### Scenario: Rollback on Windows
- **WHEN** rollback is triggered on Windows
- **THEN** the system copies the backup executable and launches it via `Command::new()`

### Requirement: Rollback user notification
The system SHALL inform the user when a rollback has occurred.

#### Scenario: User sees rollback notification
- **WHEN** the app starts after a rollback to a previous version
- **THEN** the frontend MUST display a notification: "The latest update caused issues. Your previous version has been restored."

### Requirement: Backup cleanup
The system SHALL clean up old backups to prevent unbounded disk usage.

#### Scenario: Cleanup after stable version
- **WHEN** the crash guard resets to 0 (successful startup on new version)
- **AND** a backup older than 7 days exists
- **THEN** the system deletes the backup

#### Scenario: Maximum one backup
- **WHEN** a new backup is created
- **THEN** any existing backup is replaced (only one backup at a time)
