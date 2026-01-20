## MODIFIED Requirements

### Requirement: Release Listing
The system SHALL display all Helm releases in the cluster, including releases managed by Flux HelmRelease resources.

#### Scenario: List releases
- GIVEN a cluster is connected
- WHEN the user navigates to Helm
- THEN all releases are listed with name, namespace, chart version, status, updated time, and management source

#### Scenario: Flux-managed release indicator
- GIVEN a Flux HelmRelease exists in the cluster
- WHEN releases are listed
- THEN the release is shown with a "Flux" managed-by indicator

#### Scenario: Filter by namespace
- GIVEN releases are listed
- WHEN the user filters by namespace
- THEN only releases in that namespace are shown

#### Scenario: Search releases
- GIVEN releases are listed
- WHEN the user searches by name
- THEN matching releases are shown
