## ADDED Requirements
### Requirement: Virtualized Resource Lists
The system SHALL virtualize resource list rendering when the list size exceeds the virtual scroll threshold.

#### Scenario: Large resource list
- GIVEN a resource list exceeds the virtual scroll threshold
- WHEN the list is rendered
- THEN only visible rows are rendered at a time
- AND scrolling remains smooth
