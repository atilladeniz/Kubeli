# CRD Management Specification

## Purpose
Enable browsing, viewing, and managing Custom Resource Definitions (CRDs) and their instances (Custom Resources) in Kubernetes clusters.

## Requirements

### Requirement: CRD Listing
The system SHALL display all Custom Resource Definitions in the cluster.

#### Scenario: List all CRDs
- GIVEN a cluster is connected
- WHEN the user navigates to Administration > CRDs
- THEN all CRDs are listed with name, group, version, scope, and age

#### Scenario: Search CRDs
- GIVEN CRDs are listed
- WHEN the user searches by name or group
- THEN matching CRDs are filtered

#### Scenario: Filter by group
- GIVEN CRDs are listed
- WHEN the user filters by API group
- THEN only CRDs from that group are shown

### Requirement: CRD Detail View
The system SHALL display detailed information about a CRD.

#### Scenario: View CRD schema
- GIVEN a CRD is selected
- WHEN viewing details
- THEN the OpenAPI schema is displayed
- AND field descriptions are shown

#### Scenario: View CRD versions
- GIVEN a CRD has multiple versions
- WHEN viewing details
- THEN all versions are listed with storage and served status

#### Scenario: View CRD conditions
- GIVEN a CRD is selected
- WHEN viewing details
- THEN establishment conditions are shown
- AND any issues are highlighted

### Requirement: Custom Resource Listing
The system SHALL list instances of Custom Resources.

#### Scenario: Browse CR instances
- GIVEN a CRD is selected
- WHEN the user clicks "View Instances"
- THEN all Custom Resources of that type are listed
- AND namespace filter applies if CR is namespaced

#### Scenario: List with custom columns
- GIVEN CR instances are displayed
- WHEN the CRD defines additionalPrinterColumns
- THEN those columns are shown in the table

#### Scenario: Search CR instances
- GIVEN CR instances are listed
- WHEN the user searches
- THEN instances are filtered by name

### Requirement: Custom Resource Detail
The system SHALL display and allow editing of Custom Resources.

#### Scenario: View CR detail
- GIVEN a CR instance is selected
- WHEN viewing details
- THEN full spec, status, and metadata are shown
- AND YAML view is available

#### Scenario: Edit CR
- GIVEN a CR instance is selected
- WHEN the user edits the YAML
- THEN schema validation is applied
- AND the CR is updated on save

#### Scenario: Delete CR
- GIVEN a CR instance is selected
- WHEN the user initiates delete
- THEN a confirmation dialog appears
- AND the CR is deleted upon confirmation

### Requirement: CR Creation
The system SHALL allow creating new Custom Resource instances.

#### Scenario: Create from template
- GIVEN a CRD is selected
- WHEN the user clicks "Create Instance"
- THEN a template YAML is generated from the schema
- AND the user can customize and apply

#### Scenario: Validate before create
- GIVEN CR YAML is entered
- WHEN the user attempts to create
- THEN the YAML is validated against the CRD schema
- AND errors are shown before submission

## IPC Commands

```typescript
invoke('crd:list'): Promise<CRDInfo[]>

invoke('crd:get', {
  name: string
}): Promise<CRDDetail>

invoke('crd:list_instances', {
  group: string,
  version: string,
  plural: string,
  namespace?: string
}): Promise<CustomResource[]>

invoke('crd:get_instance', {
  group: string,
  version: string,
  plural: string,
  name: string,
  namespace?: string
}): Promise<CustomResource>

invoke('crd:create_instance', {
  group: string,
  version: string,
  plural: string,
  namespace?: string,
  manifest: string
}): Promise<CustomResource>

invoke('crd:update_instance', {
  group: string,
  version: string,
  plural: string,
  name: string,
  namespace?: string,
  manifest: string
}): Promise<CustomResource>

invoke('crd:delete_instance', {
  group: string,
  version: string,
  plural: string,
  name: string,
  namespace?: string
}): Promise<void>
```

## Data Model

```typescript
interface CRDInfo {
  name: string;              // e.g., "certificates.cert-manager.io"
  group: string;             // e.g., "cert-manager.io"
  version: string;           // Storage version
  kind: string;              // e.g., "Certificate"
  plural: string;            // e.g., "certificates"
  scope: 'Cluster' | 'Namespaced';
  versions: string[];
  established: boolean;
  age: string;
}

interface CRDDetail extends CRDInfo {
  spec: {
    group: string;
    names: {
      kind: string;
      listKind: string;
      plural: string;
      singular: string;
      shortNames?: string[];
    };
    scope: string;
    versions: CRDVersion[];
  };
  status: {
    conditions: CRDCondition[];
    acceptedNames: object;
    storedVersions: string[];
  };
  schema?: object;  // OpenAPI v3 schema
}

interface CRDVersion {
  name: string;
  served: boolean;
  storage: boolean;
  schema?: {
    openAPIV3Schema: object;
  };
  additionalPrinterColumns?: PrinterColumn[];
}

interface PrinterColumn {
  name: string;
  type: string;
  jsonPath: string;
  description?: string;
}

interface CRDCondition {
  type: string;
  status: string;
  reason: string;
  message: string;
  lastTransitionTime: string;
}

interface CustomResource {
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
  spec: object;
  status?: object;
}
```

## Backend Implementation

### Rust Module Structure
```
src-tauri/src/
├── commands/
│   └── crd.rs          # Tauri command handlers
└── k8s/
    └── crd.rs          # CRD API client
```

### Required Dependencies
```toml
kube = { version = "1.1.0", features = ["client", "config", "derive", "ws", "runtime"] }
k8s-openapi = { version = "0.24", features = ["v1_32"] }
# For JSONPath queries on custom columns
jsonpath-rust = "0.7"
```

### Dynamic API Access
- Use kube-rs `Api::all_with()` for dynamic resource access
- Parse CRD schema for validation
- Handle version conversion if multiple versions exist

## Frontend Components

### Components Structure
```
src/components/features/crd/
├── CRDList.tsx             # CRD listing table
├── CRDDetail.tsx           # CRD detail view
├── CRDSchemaViewer.tsx     # Schema visualization
├── CustomResourceList.tsx  # CR instances table
├── CustomResourceDetail.tsx
└── CustomResourceEditor.tsx
```

### Schema Visualization
- Tree view for nested schema
- Type indicators (string, number, object, array)
- Required field markers
- Description tooltips

## UI/UX Considerations

### Navigation
- CRDs appear under Administration section
- Quick link from CRD to its instances
- Breadcrumb: Administration > CRDs > [CRD Name] > Instances

### Popular CRDs
- Quick access to commonly used CRDs:
  - cert-manager (Certificate, Issuer)
  - Prometheus (ServiceMonitor, PrometheusRule)
  - Istio (VirtualService, Gateway)
  - ArgoCD (Application, AppProject)

## Priority

This is a **P2 (Medium Priority)** feature for post-MVP releases.

## Dependencies

- Requires cluster connection from Task 2
- Integrates with YAML editor from Task 8
- Part of Administration navigation category (Task 18)
