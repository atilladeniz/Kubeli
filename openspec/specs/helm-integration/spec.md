# Helm Integration Specification

## Purpose
Manage Helm chart releases including installation, upgrades, rollbacks, and repository management.

## Requirements

### Requirement: Release Listing
The system SHALL display all Helm releases in the cluster.

#### Scenario: List releases
- GIVEN a cluster is connected
- WHEN the user navigates to Helm
- THEN all releases are listed with name, namespace, chart version, status, and updated time

#### Scenario: Filter by namespace
- GIVEN releases are listed
- WHEN the user filters by namespace
- THEN only releases in that namespace are shown

#### Scenario: Search releases
- GIVEN releases are listed
- WHEN the user searches by name
- THEN matching releases are shown

### Requirement: Chart Installation
The system SHALL allow installing Helm charts from repositories.

#### Scenario: Search charts
- GIVEN chart repositories are configured
- WHEN the user searches for a chart
- THEN matching charts from all repos are shown

#### Scenario: Preview values
- GIVEN a chart is selected
- WHEN the user requests preview
- THEN default values.yaml is displayed

#### Scenario: Customize values
- GIVEN chart values are shown
- WHEN the user modifies values
- THEN custom values are used for installation

#### Scenario: Install chart
- GIVEN chart and values are configured
- WHEN the user installs
- THEN the chart is installed to the selected namespace
- AND progress feedback is shown

### Requirement: Release Management
The system SHALL support upgrading and managing existing releases.

#### Scenario: Upgrade release
- GIVEN a release exists
- WHEN the user upgrades with new chart version or values
- THEN the release is upgraded
- AND the user can monitor progress

#### Scenario: View release history
- GIVEN a release is selected
- WHEN the user views history
- THEN all revisions are listed with dates and status

#### Scenario: Rollback release
- GIVEN release history is shown
- WHEN the user selects a revision to rollback
- THEN a confirmation dialog appears
- AND the release rolls back to that revision

### Requirement: Release Uninstallation
The system SHALL allow uninstalling Helm releases with confirmation.

#### Scenario: Uninstall release
- GIVEN a release is selected
- WHEN the user initiates uninstall
- THEN a confirmation dialog appears
- AND upon confirmation, the release is removed

## IPC Commands

```typescript
invoke('helm:list_releases', {
  namespace?: string
}): Promise<HelmRelease[]>

invoke('helm:install', {
  chart: string,
  release_name: string,
  namespace: string,
  values?: string
}): Promise<void>

invoke('helm:upgrade', {
  release_name: string,
  chart: string,
  namespace: string,
  values?: string
}): Promise<void>

invoke('helm:uninstall', {
  release_name: string,
  namespace: string
}): Promise<void>

invoke('helm:history', {
  release_name: string,
  namespace: string
}): Promise<HelmRevision[]>

invoke('helm:rollback', {
  release_name: string,
  namespace: string,
  revision: number
}): Promise<void>
```

## Data Model

```typescript
interface HelmRelease {
  name: string;
  namespace: string;
  revision: number;
  updated: string;
  status: string;
  chart: string;
  appVersion: string;
}

interface HelmRevision {
  revision: number;
  updated: string;
  status: string;
  chart: string;
  description: string;
}
```

## Priority

This is a P2 (Nice to Have) feature for post-MVP releases.
