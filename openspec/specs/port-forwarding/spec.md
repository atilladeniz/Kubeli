# Port Forwarding Specification

## Purpose
Forward ports from pods and services to localhost for local testing and development.

## Requirements

### Requirement: Port Forward Creation
The system SHALL allow forwarding ports from pods and services to local machine.

#### Scenario: Forward pod port
- GIVEN a pod is selected
- WHEN the user specifies local and remote ports
- THEN traffic to local port is forwarded to the pod
- AND the user is notified when connection is established

#### Scenario: Forward service port
- GIVEN a service is selected
- WHEN the user specifies local and remote ports
- THEN traffic to local port is forwarded through the service

#### Scenario: Quick establish
- GIVEN valid port configuration
- WHEN the user initiates port forward
- THEN connection establishes in < 2 seconds

### Requirement: Port Forward Management
The system SHALL provide management UI for active port forwards.

#### Scenario: List active forwards
- GIVEN port forwards are active
- WHEN viewing port forward panel
- THEN all active forwards are listed with status

#### Scenario: Stop individual forward
- GIVEN multiple forwards are active
- WHEN the user stops one forward
- THEN only that forward is terminated
- AND others continue working

#### Scenario: Stop all forwards
- GIVEN multiple forwards are active
- WHEN the user clicks "Stop All"
- THEN all port forwards are terminated

### Requirement: Connection Resilience
The system SHALL maintain port forwards through temporary disconnections.

#### Scenario: Auto-reconnect
- GIVEN a port forward is active
- WHEN the connection is temporarily lost
- THEN the system attempts automatic reconnection
- AND the user is notified of reconnection status

#### Scenario: Pod restart
- GIVEN a port forward is active
- WHEN the target pod restarts
- THEN the forward reconnects to the new pod instance

### Requirement: Multiple Port Forwards
The system SHALL support multiple simultaneous port forwards.

#### Scenario: Create multiple forwards
- GIVEN one port forward is active
- WHEN the user creates another
- THEN both forwards operate simultaneously

#### Scenario: Port conflict detection
- GIVEN a local port is in use
- WHEN the user tries to forward to that port
- THEN an error message indicates the conflict

### Requirement: Port Forward Persistence (Optional)
The system MAY persist port forward configurations across app restarts.

#### Scenario: Save port forwards
- GIVEN active port forwards exist
- WHEN the user enables persistence
- THEN forwards are saved and restored on restart

## IPC Commands

```typescript
invoke('portforward:start', {
  resource_type: 'pod' | 'service',
  name: string,
  namespace: string,
  local_port: number,
  remote_port: number
}): Promise<string> // Returns portforward ID

invoke('portforward:stop', { id: string }): Promise<void>

invoke('portforward:list'): Promise<PortForward[]>
```

## Data Model

```typescript
interface PortForward {
  id: string;
  resourceType: 'pod' | 'service';
  name: string;
  namespace: string;
  localPort: number;
  remotePort: number;
  active: boolean;
}
```

## Performance Requirements

- Port forward establishment: < 2 seconds
- Network throughput: No artificial limits
- Reconnection attempts: 3 times with exponential backoff
