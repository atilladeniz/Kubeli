## MODIFIED Requirements
### Requirement: Connection Status
The system SHALL display connection health for each cluster and provide diagnostics for failures.

#### Scenario: Healthy connection
- GIVEN a cluster is properly connected
- WHEN viewing the cluster list
- THEN a green status indicator is shown

#### Scenario: Connection failure
- GIVEN a cluster connection fails
- WHEN the user views the cluster
- THEN a clear error message explains the issue
- AND a retry option is available

#### Scenario: Download debug log
- GIVEN a cluster connection fails
- WHEN the user selects "Debug Log herunterladen"
- THEN the app generates a debug log with the recent connection attempt details
- AND the log is saved locally so it can be shared with support
