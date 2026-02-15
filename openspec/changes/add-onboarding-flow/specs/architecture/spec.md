## ADDED Requirements

### Requirement: Onboarding Wizard

The system SHALL display a first-launch onboarding wizard that guides users through initial configuration before accessing the main application.

#### Scenario: First launch shows onboarding
- **WHEN** the application is launched for the first time (onboardingCompleted is false)
- **THEN** the onboarding wizard is displayed full-screen
- **AND** the main application UI is not rendered behind it
- **AND** the wizard starts at Step 1 (Welcome)

#### Scenario: Subsequent launches skip onboarding
- **WHEN** the application is launched and onboardingCompleted is true
- **THEN** the onboarding wizard is not shown
- **AND** the main application UI loads directly

#### Scenario: User navigates forward through steps
- **WHEN** the user clicks "Next" on a step
- **THEN** the wizard advances to the next step
- **AND** the progress indicator updates to reflect the current step
- **AND** the "Back" button becomes visible (except on Step 1)

#### Scenario: User navigates backward through steps
- **WHEN** the user clicks "Back" on a step
- **THEN** the wizard returns to the previous step
- **AND** previously selected values are preserved

#### Scenario: User completes onboarding
- **WHEN** the user clicks "Get Started" on the final step
- **THEN** the onboardingCompleted flag is set to true and persisted
- **AND** the wizard transitions to the main application UI
- **AND** all settings chosen during onboarding are applied

### Requirement: Welcome Step

The system SHALL display a welcome screen as the first onboarding step.

#### Scenario: Welcome step renders
- **WHEN** the onboarding wizard is at Step 1
- **THEN** the Kubeli logo is displayed centered and prominent
- **AND** the heading "Welcome to Kubeli" is shown
- **AND** a subtitle communicates Kubeli's purpose as an open-source Kubernetes management tool
- **AND** only a "Next" button is available (no "Back" on first step)

### Requirement: Theme Selection Step

The system SHALL allow users to choose their preferred theme during onboarding.

#### Scenario: Theme options displayed
- **WHEN** the onboarding wizard is at Step 2
- **THEN** four theme options are displayed as selectable cards: Dark, Classic Dark, Light, System
- **AND** each card shows an icon and a short description
- **AND** the current default theme (Classic Dark) is pre-selected
- **AND** the System option shows the currently resolved theme (e.g., "System (currently: Dark)")

#### Scenario: Theme applied on selection
- **WHEN** the user selects a theme card
- **THEN** the theme is immediately applied to the entire application
- **AND** the selected card shows an accent border to indicate selection
- **AND** the onboarding wizard UI itself reflects the newly selected theme

### Requirement: Privacy Commitment Step

The system SHALL display Kubeli's open-source and privacy commitments during onboarding.

#### Scenario: Privacy information displayed
- **WHEN** the onboarding wizard is at Step 3
- **THEN** the heading "Open Source & Privacy First" is shown
- **AND** four commitment points are displayed with icons:
  - 100% open source
  - Zero telemetry
  - No unauthorized connections
  - Local-only data storage

#### Scenario: No user action required
- **WHEN** the user views the privacy step
- **THEN** no opt-in, opt-out, or checkbox is presented
- **AND** the step is purely informational
- **AND** the user can proceed with "Next"

### Requirement: AI Provider Setup Step

The system SHALL allow users to optionally select their preferred AI provider during onboarding, with "Skip for now" as a selectable third card option.

#### Scenario: AI provider options displayed
- **WHEN** the onboarding wizard is at Step 4
- **THEN** three selectable cards are displayed: Claude Code, Codex, and Skip for now
- **AND** each card has the same visual style (icon, title, description)
- **AND** "Skip for now" is pre-selected by default
- **AND** the "Get Started" button replaces "Next" as this is the final step

#### Scenario: User selects AI provider
- **WHEN** the user selects the Claude Code or Codex card
- **THEN** the selected provider is stored as `aiCliProvider` ("claude" or "codex")
- **AND** no API key is requested during onboarding
- **AND** the user can proceed with "Get Started"

#### Scenario: User skips AI setup
- **WHEN** the user proceeds with "Skip for now" selected (default)
- **THEN** `aiCliProvider` is set to "none"
- **AND** the onboarding completes normally
- **AND** Settings AI tab shows "None" as the selected provider

### Requirement: AI Assistant Empty State

The system SHALL display an empty state in the AI Assistant panel when no provider is configured.

#### Scenario: AI panel opened with no provider
- **WHEN** the user opens the AI Assistant panel
- **AND** `aiCliProvider` is "none"
- **THEN** an empty state is displayed using the `Empty` component
- **AND** the title "No AI Provider Configured" is shown
- **AND** the description reads "Please choose a local provider like Claude Code or Codex in your settings to start using AI assistance."
- **AND** an "Open Settings" button is displayed

#### Scenario: User clicks Open Settings from empty state
- **WHEN** the user clicks the "Open Settings" button in the AI empty state
- **THEN** the Settings dialog opens directly on the AI tab

#### Scenario: Session creation blocked without provider
- **WHEN** `aiCliProvider` is "none"
- **THEN** the user cannot create a new AI session
- **AND** the chat input is disabled or hidden

### Requirement: Onboarding Progress Indicator

The system SHALL display a progress indicator showing the current step within the onboarding wizard.

#### Scenario: Progress indicator reflects current step
- **WHEN** the onboarding wizard is active
- **THEN** a progress indicator is visible in the footer area
- **AND** it shows the current step number and total steps (e.g., "Step 2 of 4")
- **AND** completed steps are visually distinguished from upcoming steps

### Requirement: Onboarding Reset

The system SHALL provide a "Reset Onboarding" button in the Settings General tab, following the same pattern as the existing "Check for Updates" button.

#### Scenario: User resets onboarding from Settings
- **WHEN** the user clicks "Reset Onboarding" in Settings General tab
- **THEN** the onboardingCompleted flag is set to false
- **AND** the onboarding wizard is shown immediately

#### Scenario: Reset button is always accessible
- **WHEN** the user navigates to Settings General tab
- **THEN** the "Reset Onboarding" button is visible with a RotateCcw icon
- **AND** a description explains it resets the first-launch onboarding wizard

### Requirement: Existing User Migration

The system SHALL not show the onboarding wizard to users who update from a version without onboarding.

#### Scenario: Existing user updates to version with onboarding
- **WHEN** a user updates from a version without onboarding support
- **AND** the persisted state has no onboardingCompleted field (undefined)
- **THEN** onboardingCompleted defaults to true during rehydration
- **AND** the onboarding wizard is not shown

#### Scenario: Fresh installation shows onboarding
- **WHEN** a user installs the app for the first time (no persisted state)
- **THEN** onboardingCompleted defaults to false
- **AND** the onboarding wizard is shown on first launch

## MODIFIED Requirements

### Requirement: AI CLI Provider Type

The `AiCliProvider` type SHALL be extended to include a `"none"` value representing no provider configured.

#### Scenario: Provider set to none
- **WHEN** the user skips AI provider selection during onboarding or selects "None" in Settings
- **THEN** `aiCliProvider` is set to `"none"`
- **AND** the AI Assistant panel shows the empty state
- **AND** the Settings AI tab shows "None" as the current provider
