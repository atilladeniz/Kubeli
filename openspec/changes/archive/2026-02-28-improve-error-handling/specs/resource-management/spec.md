## MODIFIED Requirements

### Requirement: Resource Listing
The system SHALL display Kubernetes resources in filterable list views with real-time updates. When resource fetching fails, the system SHALL display structured error information instead of generic failure messages.

#### Scenario: View pods list
- GIVEN a namespace is selected
- WHEN the user navigates to Pods
- THEN all pods are displayed with name, status, age, and restarts
- AND status is color-coded (Running=green, Pending=yellow, Failed=red)

#### Scenario: Real-time updates
- GIVEN a resource list is displayed
- WHEN a resource changes in the cluster
- THEN the list updates automatically within 1 second

#### Scenario: Search resources
- GIVEN resources are displayed
- WHEN the user enters a search term
- THEN the list filters to show matching resources

#### Scenario: Resource fetch fails with permission error
- GIVEN a namespace is selected
- WHEN the user navigates to a resource type they lack permissions for
- THEN a structured error banner shows "Access Denied" with the specific resource type
- AND suggestions are shown (e.g., "Check RBAC role assignments")
- AND the auto-refresh is paused (no flickering)
- AND a manual "Retry" button is available

#### Scenario: Resource fetch fails with network error
- GIVEN a resource list is displayed
- WHEN connectivity to the cluster is lost
- THEN a structured error banner shows "Connection Error"
- AND the system continues retrying with increased interval
- AND the error banner shows "Retrying..." indicator

#### Scenario: Watch stream error
- GIVEN a resource watch is active
- WHEN the watch stream receives an error
- THEN the error is displayed with structured information
- AND watch auto-restart behavior depends on whether the error is retryable
