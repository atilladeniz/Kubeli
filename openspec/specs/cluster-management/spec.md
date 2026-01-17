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
The system SHALL provide namespace filtering for all resource views.

#### Scenario: List namespaces
- GIVEN a cluster connection is active
- WHEN the user opens the namespace selector
- THEN all namespaces the user has access to are displayed

#### Scenario: Switch namespace
- GIVEN namespaces are listed
- WHEN the user selects a namespace
- THEN resource lists filter to show only that namespace

#### Scenario: All namespaces view
- GIVEN the user needs cross-namespace visibility
- WHEN the user selects "All Namespaces"
- THEN resources from all accessible namespaces are shown

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
