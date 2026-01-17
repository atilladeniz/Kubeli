# Logs & Debugging Specification

## Purpose
Stream real-time logs from pods with filtering, search, and multi-container support for debugging applications.

## Requirements

### Requirement: Real-Time Log Streaming
The system SHALL stream logs from pods in real-time with minimal latency.

#### Scenario: Start log stream
- GIVEN a pod is selected
- WHEN the user opens logs
- THEN logs stream in real-time (tail -f behavior)
- AND logs appear within 500ms of generation

#### Scenario: Container selection
- GIVEN a pod has multiple containers
- WHEN the user opens logs
- THEN a container selector is shown
- AND the user can switch between containers

#### Scenario: Follow mode
- GIVEN logs are streaming
- WHEN new logs arrive
- THEN the view auto-scrolls to show latest logs

### Requirement: Log Filtering
The system SHALL allow filtering and searching log content.

#### Scenario: Text search
- GIVEN logs are displayed
- WHEN the user enters a search term
- THEN matching lines are highlighted
- AND the user can navigate between matches

#### Scenario: Severity filtering
- GIVEN logs contain parseable severity levels
- WHEN the user filters by severity
- THEN only matching log levels are shown

### Requirement: Log Display
The system SHALL display logs with proper formatting.

#### Scenario: Timestamp display
- GIVEN logs are streaming
- WHEN displaying log lines
- THEN timestamps are shown in user's locale format

#### Scenario: Color coding
- GIVEN logs contain parseable severity
- WHEN displaying logs
- THEN lines are color-coded by severity (ERROR=red, WARN=yellow, INFO=blue)

### Requirement: Log Export
The system SHALL allow exporting logs to files.

#### Scenario: Download logs
- GIVEN logs are displayed
- WHEN the user clicks download
- THEN logs are saved to a local file

### Requirement: Multiple Log Sessions
The system SHALL support viewing logs from multiple pods simultaneously.

#### Scenario: Open multiple log tabs
- GIVEN logs are open for one pod
- WHEN the user opens logs for another pod
- THEN a new tab is created
- AND each tab operates independently

#### Scenario: Tab identification
- GIVEN multiple log tabs are open
- WHEN viewing tabs
- THEN each tab shows the pod name

### Requirement: Historical Logs
The system SHALL allow viewing historical log lines.

#### Scenario: Tail lines
- GIVEN a pod has existing logs
- WHEN opening logs
- THEN the user can specify how many historical lines to show (default: 100)

## IPC Commands

```typescript
invoke('logs:stream', {
  pod_name: string,
  namespace: string,
  container?: string,
  follow: boolean,
  tail_lines?: number
}): Promise<string> // Returns stream ID

invoke('logs:stop', { stream_id: string }): Promise<void>
```

## Data Model

```typescript
interface LogStream {
  id: string;
  pod: string;
  namespace: string;
  container?: string;
  active: boolean;
}
```

## Performance Requirements

- Log streaming latency: < 500ms
- Support for streams with 10,000+ lines
- Memory-efficient buffering for long-running streams
