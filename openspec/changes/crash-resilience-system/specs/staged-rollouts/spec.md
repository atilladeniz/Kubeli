## ADDED Requirements

### Requirement: Rollout field in update manifest
The update manifest (`latest.json`) SHALL support an optional `rollout` field with a float value between 0.0 and 1.0 inclusive.

#### Scenario: Rollout field present
- **WHEN** `latest.json` contains `"rollout": 0.1`
- **THEN** the updater uses this value to gate update visibility

#### Scenario: Rollout field absent
- **WHEN** `latest.json` does not contain a `rollout` field
- **THEN** the updater treats it as `rollout: 1.0` (available to all users)

### Requirement: Client-side rollout gating
The system SHALL determine update eligibility by comparing a stable machine hash against the rollout percentage.

#### Scenario: User within rollout percentage
- **WHEN** `SHA256(machine-id)` mod 100 is less than `rollout * 100`
- **THEN** the update is shown to the user as available

#### Scenario: User outside rollout percentage
- **WHEN** `SHA256(machine-id)` mod 100 is greater than or equal to `rollout * 100`
- **THEN** the update is hidden from the user (check returns "up to date")

#### Scenario: Full rollout
- **WHEN** `rollout` is 1.0 or absent
- **THEN** all users see the update regardless of machine-id hash

### Requirement: Deterministic rollout assignment
The rollout assignment for a given machine MUST be deterministic and stable across app restarts.

#### Scenario: Same machine always gets same assignment
- **WHEN** the same machine checks for updates multiple times with the same `rollout` value
- **THEN** the result is always the same (either eligible or not)

#### Scenario: Machine-id unavailable
- **WHEN** the system cannot obtain a machine identifier
- **THEN** the system falls back to treating rollout as 1.0 (user sees the update)
