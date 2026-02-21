# Cluster Management Specification

## Purpose
Manage connections to multiple Kubernetes clusters through kubeconfig files, context switching, and namespace selection.
## Requirements
### Requirement: Multi-Cluster Connection
The system SHALL support connecting to multiple Kubernetes clusters simultaneously.

#### Scenario: Import kubeconfig file
- GIVEN a user has a valid kubeconfig file
- WHEN the user imports the kubeconfig
- THEN the application parses and stores the cluster configurations
- AND the clusters appear in the cluster list

#### Scenario: Add cluster manually
- GIVEN a user has cluster credentials
- WHEN the user provides server URL and credentials
- THEN a new cluster connection is created

### Requirement: Context Switching
The system SHALL allow users to switch between cluster contexts with one click.

#### Scenario: Switch active context
- GIVEN multiple clusters are configured
- WHEN the user selects a different context
- THEN the active context changes immediately
- AND all resource views update to show the new cluster

### Requirement: Namespace Selection

The system SHALL provide namespace filtering for all resource views, with automatic discovery as default and manual configuration as fallback for RBAC-restricted clusters.

#### Scenario: List namespaces via auto-discovery

- **GIVEN** a cluster connection is active
- **AND** no namespaces are configured for this context in the cluster settings store
- **AND** the user has `namespaces:list` cluster-level permission
- **WHEN** the system populates the namespace selector
- **THEN** all namespaces are discovered via `GET /api/v1/namespaces`
- **AND** a namespace watch is started for live updates
- **AND** the namespace source is set to "auto"

#### Scenario: List namespaces from configuration (skip API)

- **GIVEN** a cluster connection is active
- **AND** the user has configured accessible namespaces for this context
- **WHEN** the system populates the namespace selector
- **THEN** the configured namespaces are used directly
- **AND** the namespace API call is skipped entirely
- **AND** the namespace watch is not started (static list)
- **AND** the namespace source is set to "configured"

#### Scenario: Fallback to configured namespaces on 403

- **GIVEN** a cluster connection is active
- **AND** no namespaces are pre-configured for this context
- **AND** namespace API discovery returns 403 Forbidden
- **AND** the user subsequently configures accessible namespaces
- **WHEN** the system re-populates the namespace selector
- **THEN** the configured namespaces are used
- **AND** the namespace source is set to "configured"

#### Scenario: Switch namespace

- **GIVEN** namespaces are listed (auto-discovered or configured)
- **WHEN** the user selects a namespace
- **THEN** resource lists filter to show only that namespace

#### Scenario: All namespaces view (auto-discovered)

- **GIVEN** the namespace source is "auto" (API discovery succeeded)
- **WHEN** the user selects "All Namespaces"
- **THEN** resources are fetched cluster-wide as before (existing behavior)

#### Scenario: All namespaces view (configured mode)

- **GIVEN** the namespace source is "configured" (manually set namespaces)
- **WHEN** the user selects "All Namespaces"
- **THEN** resources are fetched as a union of all configured namespaces (per-namespace queries)
- **AND** no cluster-scoped list is attempted (would trigger 403)
- **AND** per-namespace error isolation applies (one failing NS does not break others)

### Requirement: Connection Status
The system SHALL display connection health for each cluster.

#### Scenario: Healthy connection
- GIVEN a cluster is properly connected
- WHEN viewing the cluster list
- THEN a green status indicator is shown

#### Scenario: Connection failure
- GIVEN a cluster connection fails
- WHEN the user views the cluster
- THEN a clear error message explains the issue
- AND a retry option is available

### Requirement: Secure Credential Storage
The system MUST store kubeconfig credentials securely using OS keychain.

#### Scenario: Store credentials
- GIVEN the user imports a kubeconfig with credentials
- WHEN the credentials are saved
- THEN they are stored in the OS keychain (macOS Keychain / Linux Secret Service / Windows Credential Manager)
- AND credentials are never written to plain text files

### Requirement: Accessible Namespace Configuration

The system SHALL allow users to manually configure a list of accessible namespaces per cluster context, persisted across app restarts via Tauri plugin store (`cluster-settings.json`).

#### Scenario: Configure accessible namespaces before connecting

- **GIVEN** a user is on the cluster overview (home page)
- **AND** the user has a cluster that requires RBAC-restricted namespace access
- **WHEN** the user opens the context menu on a cluster card and selects "Configure Namespaces"
- **THEN** a dialog opens with a textarea for entering namespace names (one per line)
- **AND** the kubeconfig default namespace for that context is pre-filled if available
- **AND** saving persists the namespace list to `cluster-settings.json` keyed by context name

#### Scenario: Validate namespace input

- **GIVEN** the namespace configuration dialog is open
- **WHEN** the user enters namespace names
- **THEN** names are trimmed of whitespace, empty lines are filtered out, and duplicates are removed
- **AND** names violating Kubernetes DNS-1123 label rules (lowercase alphanumeric, hyphens, max 63 chars) show inline warnings
- **AND** the user can still save (warnings, not blocking errors) since namespace naming is ultimately server-enforced

#### Scenario: Configure accessible namespaces after connecting

- **GIVEN** a user is connected to a cluster where namespace auto-discovery failed (403 Forbidden)
- **AND** the namespace section shows a "Configure accessible namespaces" prompt
- **WHEN** the user clicks the configure button
- **THEN** the same namespace configuration dialog opens
- **AND** after saving, the namespace selector immediately displays the configured namespaces

#### Scenario: Clear configured namespaces to restore auto-discovery

- **GIVEN** a cluster context has manually configured namespaces
- **WHEN** the user opens the namespace configuration dialog and clicks "Clear"
- **THEN** the configured namespaces are removed from the store for that context
- **AND** the system reverts to auto-discovery mode on next connection or refresh
- **AND** a namespace API call is attempted to re-populate the list

#### Scenario: Configured namespaces persist across restarts

- **GIVEN** a user has configured accessible namespaces for a context
- **WHEN** the application is restarted and the user connects to that cluster
- **THEN** the configured namespaces are loaded from the persisted store
- **AND** the namespace API call is skipped (avoids triggering a 403)

### Requirement: RBAC-Safe Connection Test

The system SHALL successfully connect to clusters where the user lacks `namespaces:list` permission by using the Kubernetes API server version endpoint (`GET /version`) for connection verification.

#### Scenario: Connect to RBAC-restricted cluster

- **GIVEN** a cluster where the user cannot list namespaces (403 Forbidden on `GET /api/v1/namespaces`)
- **WHEN** the user initiates a connection
- **THEN** the system tests connectivity via `GET /version` (accessible to all users via default `system:public-info-viewer` ClusterRole)
- **AND** the connection succeeds if the API server responds
- **AND** namespace discovery proceeds to fallback logic (configured namespaces or UI prompt)

#### Scenario: Distinguish RBAC denial from connection failure

- **GIVEN** a connection test is performed
- **WHEN** `GET /version` succeeds but namespace listing returns 403
- **THEN** the system logs it as an info-level RBAC restriction, not as a connection error
- **AND** the connection is marked as successful
- **AND** the user is informed that namespace auto-discovery is not available

#### Scenario: Actual connection failure

- **GIVEN** a cluster API server is unreachable (network error, DNS failure, TLS error)
- **WHEN** the user initiates a connection
- **THEN** `GET /version` fails with a network-level error
- **AND** the connection is marked as failed with a descriptive error message
- **AND** this is clearly distinguished from RBAC denial

### Requirement: Namespace Source Indicator

The system SHALL visually indicate whether the namespace list was auto-discovered from the API or manually configured.

#### Scenario: Auto-discovered namespaces

- **GIVEN** a cluster connection is active and namespace API listing succeeded
- **WHEN** the namespace section is displayed in the sidebar
- **THEN** the namespace selector shows the discovered namespaces without any special indicator

#### Scenario: Manually configured namespaces

- **GIVEN** a cluster is using manually configured namespaces (source is "configured")
- **WHEN** the namespace section is displayed in the sidebar
- **THEN** a "(configured)" badge or label is shown next to the namespace section header
- **AND** the user can distinguish this from auto-discovered namespaces

#### Scenario: Configured namespaces indicator on home page

- **GIVEN** a cluster context has manually configured accessible namespaces
- **WHEN** the cluster card is displayed on the home page (grid or list view)
- **THEN** a subtle indicator (e.g., small badge or icon) shows that namespaces are configured for this cluster
- **AND** the user can see at a glance which clusters have custom namespace settings

#### Scenario: No namespaces available

- **GIVEN** a user is connected but namespace discovery failed and no namespaces are configured
- **WHEN** the namespace section would normally be hidden
- **THEN** the section shows an informational message: "Namespace listing not permitted"
- **AND** a "Configure accessible namespaces" button is displayed
- **AND** clicking the button opens the namespace configuration dialog

### Requirement: Per-Namespace Error Isolation

The system SHALL handle errors for individual configured namespaces independently, without failing the entire resource view.

#### Scenario: One configured namespace is inaccessible

- **GIVEN** a user has configured namespaces ["team-a", "team-b", "team-c"]
- **AND** the user's RBAC permissions were revoked for "team-c"
- **WHEN** the system fetches resources across all configured namespaces
- **THEN** resources from "team-a" and "team-b" are displayed normally
- **AND** an inline error is shown for "team-c" (e.g., "Cannot access namespace 'team-c'")
- **AND** the overall resource view is not broken

#### Scenario: All configured namespaces are accessible

- **GIVEN** a user has configured namespaces and has valid permissions for all of them
- **WHEN** the system fetches resources
- **THEN** resources from all configured namespaces are displayed
- **AND** no error indicators are shown

## IPC Commands

```typescript
invoke('cluster:list'): Promise<Cluster[]>
invoke('cluster:add', { kubeconfig: string }): Promise<void>
invoke('cluster:remove', { id: string }): Promise<void>
invoke('cluster:switch_context', { context: string }): Promise<void>
invoke('cluster:get_namespaces'): Promise<string[]>
```

## Data Model

```typescript
interface Cluster {
  id: string;
  name: string;
  context: string;
  server: string;
  current: boolean;
  namespaces: string[];
}
```
