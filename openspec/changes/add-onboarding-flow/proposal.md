# Change: Add First-Launch Onboarding Flow

## Why

Kubeli currently drops users directly into the cluster selection screen without any introduction, theme preference, or explanation of key features like AI integration. Competing Kubernetes desktop tools use polished multi-step onboarding wizards that set user preferences and build trust. A well-designed onboarding flow improves first impressions, communicates Kubeli's open-source and privacy-first values, and guides users to configure AI features that they might otherwise never discover.

## What Changes

- **ADDED**: 4-step onboarding wizard shown on first launch only
  - Step 1: Welcome screen with Kubeli logo and tagline
  - Step 2: Theme selection (Dark, Classic Dark, Light, System)
  - Step 3: Open Source & Privacy commitment statement
  - Step 4: AI provider configuration (Claude Code / Codex / Skip for now)
- **ADDED**: `onboardingCompleted` flag in ui-store persisted to localStorage
- **ADDED**: `OnboardingWizard` component with step navigation (Back/Next/Get Started)
- **ADDED**: Progress indicator (step dots or bar) in wizard footer
- **ADDED**: Empty state in AI Assistant when no provider is configured (using existing `Empty` component)
- **MODIFIED**: `AiCliProvider` type extended with `"none"` value
- **MODIFIED**: App entry point to check onboarding status before showing main UI
- **MODIFIED**: Settings AI tab shows "None" when no provider is selected

## Impact

- Affected specs: `architecture` (new onboarding component, ui-store changes)
- Affected code:
  - `src/components/features/onboarding/OnboardingWizard.tsx` (new)
  - `src/components/features/onboarding/steps/WelcomeStep.tsx` (new)
  - `src/components/features/onboarding/steps/ThemeStep.tsx` (new)
  - `src/components/features/onboarding/steps/PrivacyStep.tsx` (new)
  - `src/components/features/onboarding/steps/AISetupStep.tsx` (new)
  - `src/lib/stores/ui-store.ts` (modified - onboardingCompleted flag, AiCliProvider type)
  - `src/components/features/ai/AIAssistant.tsx` (modified - empty state for no provider)
  - `src/components/features/settings/components/AiTab.tsx` (modified - None option)
  - `src/app/page.tsx` or root layout (modified - conditional rendering)

## Trade-offs

### Benefits
1. **Professional first impression**: Polished onboarding builds trust and signals product maturity
2. **Privacy communication**: Explicitly communicates open-source and no-telemetry stance, differentiating from competitors
3. **Feature discovery**: Users configure AI integration during setup instead of never finding it
4. **Theme preference**: Users start with their preferred appearance from the first moment

### Costs
1. **Friction**: Adds 4 clicks before users can start using the app (mitigated by keeping steps minimal)
2. **Maintenance**: New component tree to maintain
3. **Complexity**: Conditional rendering logic at app entry point

## Alternatives Considered

1. **No onboarding, inline hints**: Show tooltip hints on first use
   - Rejected: Doesn't communicate privacy values, misses theme setup opportunity

2. **Single welcome modal**: One-page modal with all settings
   - Rejected: Too cramped, loses the guided experience feel

3. **5-step wizard with Terms of Use**: Add a ToS/legal step like commercial competitors
   - Rejected: As a 100% open-source project (MIT/Apache), no ToS checkbox is needed. The license speaks for itself.

## Recommendation

Implement a lean 4-step wizard. No ToS step needed since Kubeli is fully open-source. The privacy step replaces what competitors use for telemetry opt-in - we flip the narrative by proudly stating we collect nothing. The AI step is skippable so users who don't want AI can proceed without friction.
