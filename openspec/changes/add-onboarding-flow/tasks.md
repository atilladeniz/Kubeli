# Tasks: Add First-Launch Onboarding Flow

## 1. State Management

- [ ] 1.1 Add `onboardingCompleted: boolean` to `ui-store.ts` (default: `false`, persisted)
- [ ] 1.2 Add `completeOnboarding()` action that sets flag to `true`
- [ ] 1.3 Add `resetOnboarding()` action that sets flag to `false` and triggers wizard display
- [ ] 1.4 Add rehydration validation: if `onboardingCompleted` is `undefined` (existing user), default to `true`

## 2. Wizard Container Component

- [ ] 2.1 Create `OnboardingWizard.tsx` with step navigation state
  - Current step index (0-3)
  - Back/Next/Get Started buttons in footer
  - Step progress indicator (4 dots or segmented bar)
  - Centered card layout (dark background, centered content)
- [ ] 2.2 Implement step transition animations (subtle fade or slide)
- [ ] 2.3 Fixed footer bar with: Back (left), Step indicator (center), Next/Get Started (right)

## 3. Step 1: Welcome

- [ ] 3.1 Create `WelcomeStep.tsx`
  - Kubeli logo (centered, prominent)
  - "Welcome to Kubeli" heading
  - Subtitle: "Your open-source Kubernetes management companion. Let's get you set up in just a few steps."
  - No interactive elements (pure welcome screen)
- [ ] 3.2 "Next" button only (no "Back" on first step)

## 4. Step 2: Choose Your Theme

- [ ] 4.1 Create `ThemeStep.tsx`
  - Sun/moon icon at top (centered)
  - "Choose Your Theme" heading
  - Subtitle: "Select your preferred appearance. You can change this anytime in Settings."
  - 4 selectable cards in vertical stack:
    - Dark: Moon icon, "Easy on the eyes, perfect for low-light environments"
    - Classic Dark: Palette icon, "Kubeli's signature dark theme with refined contrast"
    - Light: Sun icon, "Bright and clear, great for well-lit spaces"
    - System: Monitor icon, "Automatically match your operating system's theme (currently: [resolved])"
  - Pre-select current theme (default: Classic Dark)
- [ ] 4.2 Apply theme immediately on selection (live preview)
- [ ] 4.3 Card-style radio selection with accent border on selected card
- [ ] 4.4 System theme card shows resolved value, e.g. "System (currently: Dark)"

## 5. Step 3: Open Source & Privacy

- [ ] 5.1 Create `PrivacyStep.tsx`
  - Shield/Lock icon at top (centered)
  - "Open Source & Privacy First" heading
  - Body text explaining Kubeli's commitments:
    - 100% open source - full transparency, community-driven
    - Zero telemetry - no usage data, no analytics, no tracking
    - No unauthorized connections - the app only connects to your Kubernetes clusters
    - Your data stays yours - all configuration stored locally on your machine
  - Each point as a card/list item with icon (CheckCircle or Shield)
  - No interactive elements needed (informational step, no opt-in/opt-out)
- [ ] 5.2 Subtle visual styling: muted text for descriptions, icons with accent color

## 6. Step 4: AI Features (Optional)

- [ ] 6.1 Create `AISetupStep.tsx`
  - Sparkles/Wand icon at top (centered)
  - "AI-Powered Assistance" heading
  - Subtitle: "Connect an AI provider to get intelligent help with your Kubernetes clusters."
  - Three selectable cards (same card style as theme step):
    - Claude Code: Anthropic icon, "Anthropic's coding assistant - excellent for Kubernetes troubleshooting"
    - Codex: OpenAI icon, "OpenAI's coding assistant - versatile AI assistance"
    - Skip for now: CircleOff icon, "You can configure AI anytime in Settings"
  - "Skip for now" pre-selected by default (no provider forced)
- [ ] 6.2 Extend `AiCliProvider` type to `"claude" | "codex" | "none"`
- [ ] 6.3 On selection, persist provider to `settings.aiCliProvider` in ui-store
  - Claude Code -> `"claude"`, Codex -> `"codex"`, Skip -> `"none"`
- [ ] 6.4 Do NOT require API key during onboarding (just preference selection)
- [ ] 6.5 "Get Started" button (checkmark icon) replaces "Next" on final step

## 7. AI Assistant Empty State

- [ ] 7.1 Add empty state to AI Assistant panel when `aiCliProvider === "none"`
  - Use existing `Empty` component from `src/components/ui/empty.tsx`
  - Sparkles icon in EmptyMedia
  - Title: "No AI Provider Configured"
  - Description: "Please choose a local provider like Claude Code or Codex in your settings to start using AI assistance."
  - "Open Settings" button that navigates to Settings AI tab
- [ ] 7.2 Prevent session creation when provider is `"none"` (disable send button or intercept)
- [ ] 7.3 Update Settings AI tab to show "None" option in provider dropdown

## 8. App Entry Integration

- [ ] 8.1 Modify root layout/page to conditionally render OnboardingWizard
  - If `onboardingCompleted === false` -> show OnboardingWizard (full-screen)
  - If `onboardingCompleted === true` -> show normal app (HomePage/Dashboard)
- [ ] 8.2 After "Get Started" click: call `completeOnboarding()`, transition to main app
- [ ] 8.3 Ensure onboarding only blocks the main UI, not Tauri window initialization

## 9. Settings Debug Button

- [ ] 9.1 Add "Reset Onboarding" button to Settings GeneralTab (same pattern as "Check for Updates" in AboutTab)
  - SettingSection with title "Onboarding" and description "Reset the first-launch onboarding wizard"
  - Button with RotateCcw icon and "Reset Onboarding" label
  - On click: call `resetOnboarding()` to set flag to false and show wizard immediately
- [ ] 9.2 Add i18n strings for the reset button (EN + DE)

## 10. Visual Design

- [ ] 10.1 Dark background matching app theme (or adapting to selected theme in step 2)
- [ ] 10.2 Centered content area with max-width constraint (~500px content, ~700px card)
- [ ] 10.3 Consistent spacing: icon -> heading -> subtitle -> content -> footer
- [ ] 10.4 Selection cards: rounded borders, subtle background, accent border when selected
- [ ] 10.5 Footer: fixed bottom bar with subtle top border, consistent padding
- [ ] 10.6 Responsive: works on small window sizes (min ~600x400)

## 11. Testing

- [ ] 11.1 Unit test: ui-store onboarding flag persistence and rehydration migration
- [ ] 11.2 Unit test: AiCliProvider `"none"` state handled correctly
- [ ] 11.3 Component test: wizard step navigation (forward/back)
- [ ] 11.4 Component test: theme selection applies immediately
- [ ] 11.5 Component test: AI step "Skip for now" card sets provider to "none"
- [ ] 11.6 Component test: AI Assistant empty state when provider is "none"
- [ ] 11.7 Component test: reset onboarding button in Settings
- [ ] 11.8 E2E test: complete onboarding flow end-to-end
- [ ] 11.9 E2E test: onboarding not shown on subsequent launches
- [ ] 11.10 E2E test: reset onboarding from Settings triggers wizard again
- [ ] 11.11 E2E test: AI panel shows empty state after skipping provider in onboarding
