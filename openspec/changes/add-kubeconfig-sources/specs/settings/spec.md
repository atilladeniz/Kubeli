# Spec Delta: Settings — Kubeconfig Sources

## ADDED Requirements

### Requirement: Kubeconfig Sources Management

The system SHALL allow users to configure multiple kubeconfig file and folder sources through a dedicated settings tab.

#### Scenario: Default first-launch state
- **WHEN** the user opens Kubeli for the first time
- **THEN** `~/.kube/config` is pre-configured as the default kubeconfig source
- **AND** the cluster list shows contexts from this file

#### Scenario: Add a kubeconfig file
- **WHEN** the user clicks "Add File" in Kubeconfig settings
- **THEN** a native file picker dialog opens
- **AND** the selected file is validated as a kubeconfig
- **AND** contexts from the file appear in the cluster list

#### Scenario: Add a kubeconfig folder
- **WHEN** the user clicks "Add Folder" in Kubeconfig settings
- **THEN** a native folder picker dialog opens
- **AND** all `*.yaml`, `*.yml`, and `config` files in the folder are scanned
- **AND** contexts from all valid files appear in the cluster list

#### Scenario: Enter a manual path
- **WHEN** the user clicks "Enter Path" and types a file or folder path
- **THEN** the path is validated for existence and kubeconfig validity
- **AND** an error is shown if the path is invalid

#### Scenario: Remove a kubeconfig source
- **WHEN** the user removes a configured source
- **THEN** contexts originating from that source are removed from the cluster list
- **AND** active connections to those contexts are disconnected

#### Scenario: Source file changes on disk
- **WHEN** a configured kubeconfig file is modified externally
- **THEN** the system detects the change via file watcher
- **AND** the cluster list is automatically refreshed

### Requirement: Kubeconfig Merge Mode

The system SHALL support an optional merge mode that combines incomplete kubeconfig files into a unified configuration.

#### Scenario: Merge mode disabled (default)
- **WHEN** merge mode is OFF
- **THEN** each kubeconfig file is treated as a self-contained configuration
- **AND** contexts missing cluster or user references are shown as invalid

#### Scenario: Merge mode enabled
- **WHEN** merge mode is ON
- **THEN** all kubeconfig files are merged into a single logical configuration
- **AND** a context from file A can reference a cluster defined in file B
- **AND** duplicate names are resolved by preferring the first source in order

### Requirement: Kubeconfig Sources Persistence

The system SHALL persist kubeconfig source configuration across application restarts.

#### Scenario: Settings survive restart
- **WHEN** the user configures kubeconfig sources and restarts Kubeli
- **THEN** all configured sources are restored
- **AND** the cluster list matches the previous session
