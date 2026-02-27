## ADDED Requirements

### Requirement: Structured error responses
The system SHALL return structured error objects from all Tauri commands instead of plain strings. Each error object MUST include an error kind, human-readable message, retryable flag, and optional HTTP status code, raw detail, resource name, and suggestions.

#### Scenario: Kubernetes API returns 403 Forbidden
- **WHEN** a Tauri command receives a 403 Forbidden response from the Kubernetes API
- **THEN** the error object has kind `Forbidden`, code `403`, a message like "You don't have permission to list pods in this namespace", retryable `false`, and suggestions including "Check RBAC role assignments for your user"

#### Scenario: Kubernetes API returns 401 Unauthorized
- **WHEN** a Tauri command receives a 401 Unauthorized response
- **THEN** the error object has kind `Unauthorized`, code `401`, a message about expired or invalid credentials, retryable `false`, and suggestions including "Try reconnecting to the cluster"

#### Scenario: Network connection fails
- **WHEN** a Tauri command fails due to a network error (connection refused, DNS failure, etc.)
- **THEN** the error object has kind `Network`, no HTTP code, a message about connectivity, retryable `true`, and suggestions including "Check your network connection"

#### Scenario: Request times out
- **WHEN** a Tauri command times out
- **THEN** the error object has kind `Timeout`, no HTTP code, retryable `true`, and suggestions including "The cluster may be under heavy load"

#### Scenario: Unknown or unclassified error
- **WHEN** a Tauri command fails with an error that doesn't match known patterns
- **THEN** the error object has kind `Unknown`, retryable `true`, and the raw error string is preserved in the detail field

### Requirement: Error classification in Rust backend
The system SHALL classify Kubernetes API errors on the Rust side by inspecting `kube::Error` variants and HTTP status codes. The classification MUST map each error to the appropriate `ErrorKind` and set the `retryable` flag correctly.

#### Scenario: kube::Error::Api with status code
- **WHEN** the kube-rs client returns an `Api(ErrorResponse)` error
- **THEN** the system extracts the HTTP status code and reason, maps it to the corresponding ErrorKind, and includes the API error message

#### Scenario: kube::Error network-level failure
- **WHEN** the kube-rs client returns a connection or hyper error
- **THEN** the system classifies it as `Network` kind with retryable `true`

### Requirement: Frontend error deserialization
The system SHALL deserialize structured error objects from Tauri command rejections. The invoke wrapper MUST parse JSON error responses and produce typed `KubeliError` objects. Unrecognized error formats MUST be wrapped as `Unknown` kind.

#### Scenario: Tauri rejects with serialized JSON error
- **WHEN** a Tauri command rejects with a JSON-serialized error object
- **THEN** the invoke wrapper parses it into a `KubeliError` with all fields preserved

#### Scenario: Tauri rejects with a plain string (legacy)
- **WHEN** a Tauri command rejects with a plain string (not JSON)
- **THEN** the invoke wrapper wraps it as a `KubeliError` with kind `Unknown`, the string as `message`, and retryable `true`

### Requirement: User-friendly error display
The system SHALL display errors with a clear title, human-readable explanation, actionable suggestions, and expandable raw details.

#### Scenario: Display structured error in resource list
- **WHEN** a resource fetch fails with a structured error
- **THEN** the error banner shows: a title based on error kind (e.g., "Access Denied"), the human-readable message, a list of suggestions, and an expandable "Details" section with the raw error

#### Scenario: Dismiss error banner
- **WHEN** the user dismisses the error banner
- **THEN** the error banner is hidden until the next error occurs

### Requirement: Smart retry behavior
The system SHALL differentiate between retryable and non-retryable errors and adjust auto-refresh and watch behavior accordingly.

#### Scenario: Non-retryable error pauses auto-refresh
- **WHEN** a resource fetch returns a non-retryable error (e.g., 403 Forbidden)
- **THEN** the auto-refresh interval is paused
- **AND** the watch auto-restart is paused
- **AND** a manual "Retry" button is shown

#### Scenario: Retryable error continues with backoff
- **WHEN** a resource fetch returns a retryable error (e.g., network timeout)
- **THEN** the auto-refresh continues with a doubled interval
- **AND** the error banner shows a "Retrying..." indicator

#### Scenario: Manual retry resumes normal behavior
- **WHEN** the user clicks "Retry" after a non-retryable error
- **THEN** the system attempts a fresh fetch
- **AND** if successful, auto-refresh and watch resume at normal intervals

#### Scenario: Navigation away clears error state
- **WHEN** the user navigates to a different resource view
- **THEN** the error state is cleared
- **AND** auto-refresh and watch resume normally for the new view
