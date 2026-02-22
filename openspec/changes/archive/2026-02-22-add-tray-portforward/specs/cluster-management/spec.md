## ADDED Requirements

### Requirement: System Tray Port-Forward Access
The system SHALL provide a system tray icon with a popup panel for quick port-forward management without opening the main application window.

#### Scenario: Tray icon visible
- GIVEN the application is running
- WHEN the user looks at the system menu bar (macOS) or taskbar (Windows)
- THEN the Kubeli tray icon is visible
- AND hovering shows a tooltip with app name and active forward count

#### Scenario: Open tray popup
- GIVEN the tray icon is visible
- WHEN the user left-clicks the tray icon
- THEN a compact popup panel appears anchored to the tray icon
- AND the popup shows the Forward tab by default

#### Scenario: Dismiss tray popup
- GIVEN the tray popup is visible
- WHEN the user clicks outside the popup or presses Escape
- THEN the popup hides

#### Scenario: Search pods for forwarding
- GIVEN the tray popup is open on the Forward tab
- WHEN the user types in the search bar
- THEN the pod/service list filters in real-time by name or namespace
- AND only pods/services with exposed ports are shown

#### Scenario: Start port-forward from tray
- GIVEN the Forward tab shows a pod with an exposed port
- WHEN the user clicks the forward button on a pod row
- THEN a port-forward starts with an auto-assigned local port
- AND the item appears in the Active tab
- AND the tray icon badge updates with the active forward count

#### Scenario: View active forwards
- GIVEN one or more port-forwards are running
- WHEN the user switches to the Active tab in the tray popup
- THEN all running forwards are listed with name, local port, target port, and status indicator

#### Scenario: Stop forward from tray
- GIVEN the Active tab shows a running port-forward
- WHEN the user clicks the stop button on a forward row
- THEN the port-forward stops
- AND the item is removed from the Active tab
- AND the tray icon badge updates

#### Scenario: Open forwarded service in browser
- GIVEN a port-forward is active in the Active tab
- WHEN the user clicks the open browser button on a forward row
- THEN the default browser opens `http://localhost:{local_port}`

#### Scenario: Stop all forwards
- GIVEN multiple port-forwards are running
- WHEN the user clicks "Stop All" in the Active tab
- THEN all port-forwards are stopped
- AND the Active tab shows empty state
- AND the tray icon badge is cleared

### Requirement: Tray Icon Status Badge
The system SHALL display the count of active port-forwards on the tray icon.

#### Scenario: Badge shows active count
- GIVEN one or more port-forwards are active
- WHEN viewing the tray icon
- THEN the active forward count is displayed next to the icon (macOS) or in the tooltip (Windows)

#### Scenario: Badge cleared when no forwards
- GIVEN all port-forwards have been stopped
- WHEN viewing the tray icon
- THEN no count is displayed next to the icon
- AND the tooltip shows only "Kubeli"

### Requirement: Background Operation
The system SHALL continue running port-forwards when the main window is closed, using the system tray for persistent background operation.

#### Scenario: Close main window to tray
- GIVEN the application is running with the main window visible
- WHEN the user closes the main window
- THEN the main window hides but the application continues running
- AND the tray icon remains visible
- AND all active port-forwards continue running

#### Scenario: Reopen main window from tray
- GIVEN the main window is hidden and the tray icon is visible
- WHEN the user right-clicks the tray icon and selects "Open Kubeli"
- THEN the main window reappears with its previous state preserved

#### Scenario: Quit application from tray
- GIVEN the application is running in the tray
- WHEN the user right-clicks the tray icon and selects "Quit"
- THEN all active port-forwards are stopped
- AND the application exits completely

### Requirement: Linux Tray Fallback
The system SHALL provide a native context menu fallback on Linux where tray click events are not supported.

#### Scenario: Linux tray menu
- GIVEN the application is running on Linux
- WHEN the user interacts with the tray icon
- THEN a native context menu shows active port-forwards as menu items
- AND a "Start Forward..." item opens the main window port-forward panel
- AND "Open Kubeli" and "Quit" options are available
