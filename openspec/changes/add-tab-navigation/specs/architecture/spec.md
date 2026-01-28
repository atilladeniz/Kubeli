## ADDED Requirements

### Requirement: Tab Navigation

The system SHALL provide a horizontal tab bar for navigating between multiple resource views simultaneously.

#### Scenario: User opens a resource in a new tab
- **WHEN** user Cmd/Ctrl+clicks a sidebar navigation item
- **THEN** a new tab is created with the selected resource type
- **AND** the new tab becomes active
- **AND** the tab bar displays the new tab with appropriate icon and title

#### Scenario: User switches between tabs
- **WHEN** user clicks on an inactive tab
- **THEN** that tab becomes active
- **AND** the main content area displays the resource view for that tab
- **AND** scroll position is preserved from previous visit

#### Scenario: User closes a tab
- **WHEN** user clicks the close button (X) on a tab
- **OR** user presses Cmd/Ctrl+W
- **THEN** the tab is removed from the tab bar
- **AND** if it was the active tab, the previous tab becomes active
- **AND** the closed tab is added to closed-tabs history (max 5)

#### Scenario: User reorders tabs
- **WHEN** user drags a tab to a new position
- **THEN** the tab bar updates to reflect the new order
- **AND** the order is persisted to localStorage

#### Scenario: Maximum tabs reached
- **WHEN** user attempts to open an 11th tab (limit is 10)
- **THEN** the oldest non-active tab is closed automatically
- **AND** the new tab is created and becomes active

### Requirement: Tab Keyboard Shortcuts

The system SHALL provide keyboard shortcuts for efficient tab management.

#### Scenario: Switch to tab by index
- **WHEN** user presses Cmd/Ctrl+1 through Cmd/Ctrl+9
- **THEN** the tab at that index (1-based) becomes active
- **AND** if the index exceeds tab count, the last tab becomes active

#### Scenario: Close current tab
- **WHEN** user presses Cmd/Ctrl+W
- **THEN** the active tab is closed
- **AND** the previous tab becomes active

#### Scenario: Cycle through tabs
- **WHEN** user presses Cmd/Ctrl+Tab
- **THEN** the next tab becomes active (wraps to first)
- **WHEN** user presses Cmd/Ctrl+Shift+Tab
- **THEN** the previous tab becomes active (wraps to last)

### Requirement: Tab Persistence

The system SHALL persist tab state across sessions per cluster.

#### Scenario: Tabs saved on cluster disconnect
- **WHEN** user disconnects from a cluster
- **THEN** the current tabs and their order are saved to localStorage
- **AND** the active tab ID is saved

#### Scenario: Tabs restored on cluster connect
- **WHEN** user connects to a cluster that has saved tabs
- **THEN** the saved tabs are restored to the tab bar
- **AND** the previously active tab becomes active
- **AND** if the saved active tab no longer exists, the first tab becomes active

#### Scenario: Tabs cleared on explicit reset
- **WHEN** user chooses "Reset tabs" from settings or context menu
- **THEN** all tabs for the current cluster are cleared
- **AND** a single default tab (Cluster Overview) is created

### Requirement: Tab Visual Design

The system SHALL display tabs with consistent visual styling matching the application theme.

#### Scenario: Tab displays resource icon
- **WHEN** a tab is rendered
- **THEN** it displays the appropriate Lucide icon for the resource type
- **AND** the icon matches the sidebar navigation icon for that resource

#### Scenario: Tab displays namespace context
- **WHEN** a tab is for a namespace-scoped resource list
- **AND** a specific namespace is selected
- **THEN** the tab title includes the namespace (e.g., "Pods - kube-system")

#### Scenario: Active tab is visually distinct
- **WHEN** a tab is active
- **THEN** it has a highlighted background color
- **AND** it has a visible bottom border accent
- **AND** inactive tabs have muted styling
