## ADDED Requirements
### Requirement: Virtualized Log Viewer
The system SHALL virtualize log rendering when the log line count exceeds the virtual scroll threshold.

#### Scenario: Large log output
- GIVEN a log stream exceeds the virtual scroll threshold
- WHEN the log viewer renders the output
- THEN only visible lines are rendered at a time
- AND scrolling remains smooth
