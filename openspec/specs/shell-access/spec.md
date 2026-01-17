# Shell Access Specification

## Purpose
Provide interactive terminal access to running pods for debugging and command execution.

## Requirements

### Requirement: Interactive Shell
The system SHALL provide full interactive shell access to pod containers.

#### Scenario: Start shell session
- GIVEN a pod is running
- WHEN the user opens shell
- THEN an interactive terminal connects to the container
- AND standard shell commands work (bash or sh)

#### Scenario: Container selection
- GIVEN a pod has multiple containers
- WHEN the user opens shell
- THEN a container selector is shown

#### Scenario: Custom command
- GIVEN a shell is requested
- WHEN the user specifies a custom command
- THEN that command is executed instead of default shell

### Requirement: Terminal Emulation
The system SHALL provide full terminal emulation capabilities.

#### Scenario: Keyboard shortcuts
- GIVEN a shell session is active
- WHEN the user presses Ctrl+C
- THEN the signal is sent to the container process

#### Scenario: Terminal resize
- GIVEN a shell session is active
- WHEN the user resizes the terminal window
- THEN the remote terminal adapts to new dimensions

#### Scenario: Copy and paste
- GIVEN a shell session is active
- WHEN the user copies text
- THEN text is copied to system clipboard
- AND the user can paste from clipboard

### Requirement: Multiple Sessions
The system SHALL support multiple concurrent terminal sessions.

#### Scenario: Open multiple shells
- GIVEN a shell is open
- WHEN the user opens another shell
- THEN a new tab is created
- AND each session operates independently

#### Scenario: Session persistence
- GIVEN multiple shell tabs are open
- WHEN the user switches between them
- THEN each session maintains its state

### Requirement: Session Management
The system SHALL allow proper session lifecycle management.

#### Scenario: Close session
- GIVEN a shell session is active
- WHEN the user closes the tab
- THEN the remote session is terminated cleanly

#### Scenario: Connection loss
- GIVEN a shell session is active
- WHEN network connection is lost
- THEN the user is notified
- AND reconnection is attempted

## IPC Commands

```typescript
invoke('shell:start', {
  pod_name: string,
  namespace: string,
  container?: string,
  command?: string[]
}): Promise<string> // Returns session ID

invoke('shell:write', {
  session_id: string,
  data: string
}): Promise<void>

invoke('shell:resize', {
  session_id: string,
  rows: number,
  cols: number
}): Promise<void>

invoke('shell:close', { session_id: string }): Promise<void>
```

## Data Model

```typescript
interface ShellSession {
  id: string;
  pod: string;
  namespace: string;
  container?: string;
  active: boolean;
}
```

## Performance Requirements

- Terminal input latency: < 200ms
- Support for ANSI escape sequences
- UTF-8 character support
