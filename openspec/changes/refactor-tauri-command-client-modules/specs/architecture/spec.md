## ADDED Requirements

### Requirement: Modular Frontend IPC Command Client
The system SHALL organize frontend Tauri IPC command wrappers into domain-focused modules while preserving the existing public API surface.

#### Scenario: Backward compatible imports
- GIVEN existing frontend code imports from `@/lib/tauri/commands`
- WHEN the command client is modularized
- THEN all previously exported command functions and types remain available with the same names and signatures

#### Scenario: Stable command invocation behavior
- GIVEN a command wrapper existed before modularization
- WHEN it is called with the same inputs after modularization
- THEN it invokes the same backend command name
- AND it sends the same payload keys and values

#### Scenario: Mock mode compatibility
- GIVEN `VITE_TAURI_MOCK` is set to `"true"`
- WHEN any command wrapper is called
- THEN the wrapper routes through the mock invoke path exactly as before
