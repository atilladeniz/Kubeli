## ADDED Requirements
### Requirement: Log Rendering Batching
The system SHALL batch log rendering updates to maintain UI responsiveness during high-volume streams.

#### Scenario: High-volume log stream
- GIVEN a pod is emitting logs at high volume
- WHEN logs are streaming in the UI
- THEN log updates are applied in batches at most every 250ms
- AND the UI remains responsive to scrolling and filtering
