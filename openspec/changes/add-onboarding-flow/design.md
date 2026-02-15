## Context

Kubeli lacks a first-launch experience. Users land directly on the cluster selection screen without any introduction to the app's values, theme preferences, or AI capabilities. Competitor analysis shows that modern Kubernetes desktop tools use multi-step onboarding wizards with telemetry opt-in and ToS acceptance. Kubeli's onboarding differentiates by emphasizing open-source transparency and privacy-first design - no telemetry toggle needed because there is no telemetry.

### References
- Competitor onboarding analysis (multi-step wizards with ToS, telemetry opt-in, sign-in upsell)
- Existing theme system in `ui-store.ts` (4 themes: dark, classic-dark, light, system)
- Existing AI integration in `ai-store/` (Claude Code + OpenAI support)
- Existing update debug button in Settings (AboutTab.tsx) as pattern reference

## Goals / Non-Goals

### Goals
- Provide a polished, professional first-launch experience
- Let users set their theme preference immediately
- Communicate Kubeli's open-source and privacy-first values
- Guide users to AI provider selection (optional)
- Provide a debug/reset button in Settings for development testing

### Non-Goals
- Account creation or sign-in flow (Kubeli has no accounts)
- Telemetry opt-in/opt-out (there is no telemetry)
- Terms of Service acceptance (100% open-source, no legal checkbox needed)
- Cluster configuration during onboarding (handled by existing HomePage)
- Tutorial or feature walkthrough (keep onboarding focused on preferences)

## Decisions

### 1. 4 Steps Instead of 5

Commercial competitors use 5 steps including ToS acceptance and telemetry opt-in. Since Kubeli is fully open-source (MIT license), no legal acceptance is required. The telemetry step is replaced with a privacy commitment statement that requires no user action - just communication of values.

**Rationale**: Fewer steps = less friction. Every eliminated click improves completion rate.

### 2. UI Layout Pattern

Follow the proven centered-card wizard layout used by modern desktop apps:

```
┌──────────────────────────────────────────┐
│  [window controls]                       │
│                                          │
│              [Icon]                       │
│           [Heading]                       │
│          [Subtitle]                       │
│                                          │
│        ┌─────────────────┐               │
│        │  [Card Option]  │               │
│        └─────────────────┘               │
│        ┌─────────────────┐               │
│        │  [Card Option]  │               │
│        └─────────────────┘               │
│                                          │
├──────────────────────────────────────────┤
│ ← Back    [● ● ○ ○]    Next →           │
│           Step 2 of 4                    │
└──────────────────────────────────────────┘
```

- Full-screen dark background (matches app default)
- Content centered vertically and horizontally
- Max content width: ~480px for text, ~560px for cards
- Fixed bottom footer bar with navigation

**Rationale**: This is the standard layout for modern desktop app onboarding wizards. Users expect this pattern.

### 3. State Persistence

```typescript
// In ui-store.ts
interface UISettings {
  // ... existing settings
  onboardingCompleted: boolean;  // new field
}

// Default
onboardingCompleted: false

// After completion
completeOnboarding: () => set((state) => ({
  settings: { ...state.settings, onboardingCompleted: true }
}))
```

Persisted via existing Zustand `persist` middleware to localStorage. No additional storage mechanism needed.

**Rationale**: Reuse existing persistence infrastructure. Single boolean flag is sufficient.

### 4. Theme Preview During Onboarding

When the user selects a theme in Step 2, it is applied immediately via the existing `setTheme()` action. This means:
- The onboarding wizard itself changes appearance
- The background adapts to the selected theme
- No "preview" vs "apply" distinction - selection IS application
- The "System" option shows the resolved theme label: "System (currently: Dark)"

**Rationale**: Immediate feedback is more satisfying than a deferred preview. Existing theme system handles this natively. Showing the resolved system theme prevents confusion.

### 5. AI Provider Selection with "Skip for now" as Third Card

The AI step presents three selectable cards (not a link):

```typescript
// Extend existing AiCliProvider type in ui-store.ts
export type AiCliProvider = "claude" | "codex" | "none";

// Cards in AISetupStep:
// 1. Claude Code - "Anthropic's coding assistant - excellent for K8s troubleshooting"
// 2. Codex (OpenAI) - "OpenAI's coding assistant - versatile AI assistance"
// 3. Skip for now - "You can configure AI anytime in Settings"
```

"Skip for now" is a proper selectable card (same style, with an X/CircleOff icon), not a text link. Selecting it sets `aiCliProvider` to `"none"`. The existing default (`"claude"`) changes: fresh installs via onboarding start with `"none"` until the user explicitly picks a provider.

Settings AI tab shows "None" in the provider dropdown when `aiCliProvider === "none"`.

**Rationale**: Making skip a card gives it equal visual weight, preventing users from feeling pressured into a choice. Using the existing `AiCliProvider` type (extended with `"none"`) avoids a separate field.

### 6. AI Assistant Empty State When No Provider

When the user opens the AI Assistant panel and `aiCliProvider === "none"`, show an empty state using the existing `Empty` component (`src/components/ui/empty.tsx`):

```tsx
<Empty>
  <EmptyHeader>
    <EmptyMedia variant="icon">
      <Sparkles />
    </EmptyMedia>
    <EmptyTitle>No AI Provider Configured</EmptyTitle>
    <EmptyDescription>
      Please choose a local provider like Claude Code or Codex
      in your settings to start using AI assistance.
    </EmptyDescription>
  </EmptyHeader>
  <EmptyContent>
    <Button onClick={openAiSettings}>
      <Settings className="size-4 mr-2" />
      Open Settings
    </Button>
  </EmptyContent>
</Empty>
```

The "Open Settings" button navigates directly to the Settings AI tab. No session can be created while provider is `"none"`.

**Rationale**: Clear, actionable feedback. Uses the existing Empty component for consistency. The button removes friction by taking users directly to the right settings page.

### 7. Selection Card Component

Reusable card component for Steps 2 and 4:

```typescript
interface SelectionCard {
  icon: LucideIcon;
  title: string;
  description: string;
  selected?: boolean;
  onClick?: () => void;
}
```

Cards use:
- `border border-border` default state
- `border-primary ring-1 ring-primary/30` selected state (accent border)
- Rounded corners, subtle hover effect
- Icon on the left, text on the right

**Rationale**: Consistent visual language across steps.

### 8. Debug/Reset Button in Settings

Add a "Reset Onboarding" button in the Settings General tab, following the same pattern as the existing "Check for Updates" button in AboutTab. The button resets `onboardingCompleted` to `false` and immediately shows the onboarding wizard.

```typescript
// In GeneralTab.tsx or a new DebugSection
<SettingSection
  title="Onboarding"
  description="Reset the first-launch onboarding wizard for testing"
>
  <Button variant="outline" onClick={resetOnboarding}>
    <RotateCcw className="size-4 mr-2" />
    Reset Onboarding
  </Button>
</SettingSection>
```

This button is always visible (not dev-mode gated) since it's a harmless action that lets users re-experience the onboarding.

**Rationale**: Same pattern as update check button. Useful for development testing and for users who want to change their initial preferences.

### 9. Existing User Migration

For users updating from a version without onboarding, `onboardingCompleted` defaults to `true` via Zustand rehydration validation. This ensures existing users are never shown the onboarding wizard - it only appears on fresh installations.

```typescript
// In ui-store rehydration validation
if (persistedState.settings.onboardingCompleted === undefined) {
  persistedState.settings.onboardingCompleted = true; // existing user
}
```

**Rationale**: Existing users already know the app. Forcing them through onboarding would be annoying and disrespectful of their time.

## Risks / Trade-offs

- **Risk**: Users may rush through without reading privacy step
  - Mitigation: Keep text short and impactful, use visual icons to draw attention
- **Risk**: Theme change during onboarding could cause visual jarring
  - Mitigation: Use CSS transitions for smooth theme switching (already supported)
- **Trade-off**: No skip-all button to jump past onboarding entirely
  - Acceptance: 4 steps with "Next" is fast enough (~10 seconds). A skip-all undermines the purpose.
