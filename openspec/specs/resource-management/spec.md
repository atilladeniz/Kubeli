# Resource Management Specification

## Purpose
View, create, edit, and delete Kubernetes resources with real-time updates and YAML editing capabilities.

## Requirements

### Requirement: Resource Listing
The system SHALL display Kubernetes resources in filterable list views with real-time updates.

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

### Requirement: Supported Resource Types
The system SHALL support viewing and managing the following resource types:

#### Scenario: Workload resources
- GIVEN the user needs to manage workloads
- WHEN viewing workload resources
- THEN Pods, Deployments, StatefulSets, DaemonSets, Jobs, and CronJobs are available

#### Scenario: Network resources
- GIVEN the user needs to manage networking
- WHEN viewing network resources
- THEN Services, Ingresses, and Endpoints are available

#### Scenario: Configuration resources
- GIVEN the user needs to manage configuration
- WHEN viewing config resources
- THEN ConfigMaps and Secrets are available

#### Scenario: Storage resources
- GIVEN the user needs to manage storage
- WHEN viewing storage resources
- THEN PersistentVolumes, PersistentVolumeClaims, and StorageClasses are available

#### Scenario: RBAC resources
- GIVEN the user needs to manage access control
- WHEN viewing RBAC resources
- THEN Roles, RoleBindings, ClusterRoles, and ClusterRoleBindings are available

### Requirement: Resource Details
The system SHALL display comprehensive details for any selected resource.

#### Scenario: View resource details
- GIVEN resources are listed
- WHEN the user clicks a resource
- THEN a detail view shows metadata, spec, status, events, and conditions

#### Scenario: View YAML representation
- GIVEN a resource detail view is open
- WHEN the user selects YAML view
- THEN the full YAML definition is displayed with syntax highlighting

### Requirement: Resource Editing
The system SHALL allow editing resources via YAML with validation.

#### Scenario: Edit resource YAML
- GIVEN a resource is selected
- WHEN the user edits the YAML
- THEN syntax validation highlights errors
- AND the user can apply changes

#### Scenario: Apply changes
- GIVEN valid YAML edits are made
- WHEN the user applies changes
- THEN the resource is updated in the cluster
- AND success/failure feedback is shown

### Requirement: Resource Deletion
The system SHALL allow deleting resources with confirmation.

#### Scenario: Delete resource
- GIVEN a resource is selected
- WHEN the user initiates delete
- THEN a confirmation dialog appears
- AND upon confirmation, the resource is deleted

### Requirement: Resource Creation
The system SHALL allow creating resources from YAML or templates.

#### Scenario: Create from YAML
- GIVEN the user has YAML content
- WHEN the user pastes YAML and submits
- THEN the resource is created in the cluster

#### Scenario: Create from template
- GIVEN template library is available
- WHEN the user selects a template
- THEN a pre-filled YAML editor opens for customization

### Requirement: Resource Actions
The system SHALL support common resource actions.

#### Scenario: Scale deployment
- GIVEN a Deployment is selected
- WHEN the user changes replica count
- THEN the deployment scales to the new count

#### Scenario: Restart deployment
- GIVEN a Deployment is selected
- WHEN the user triggers restart
- THEN pods are rolling restarted

## IPC Commands

```typescript
invoke('list_pods', {
  options?: {
    namespace?: string,
    label_selector?: string,
    field_selector?: string,
    limit?: number
  }
}): Promise<PodInfo[]>

invoke('list_deployments', {
  options?: {
    namespace?: string,
    label_selector?: string,
    field_selector?: string,
    limit?: number
  }
}): Promise<DeploymentInfo[]>

invoke('get_resource_yaml', {
  resourceType: string,
  name: string,
  namespace?: string
}): Promise<ResourceYaml>

invoke('apply_resource_yaml', {
  yamlContent: string
}): Promise<string>

invoke('delete_resource', {
  resourceType: string,
  name: string,
  namespace?: string
}): Promise<void>

invoke('watch_pods', {
  watchId: string,
  namespace?: string
}): Promise<void>

invoke('stop_watch', { watchId: string }): Promise<void>
```

## Data Model

```typescript
interface K8sResource {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    uid: string;
    creationTimestamp: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: any;
  status?: any;
}
```
