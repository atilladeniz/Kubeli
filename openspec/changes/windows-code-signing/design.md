## Context

Kubeli ships unsigned Windows binaries. This triggers SmartScreen warnings that block installation and break the auto-update flow. macOS binaries are already signed and notarized via Apple Developer ID. Linux does not require code signing.

Since March 2024, EV certificates no longer bypass SmartScreen automatically — all certificates build reputation through download volume. Since June 2023, all code-signing keys must reside on FIPS 140-2 Level 2 hardware (USB tokens or cloud HSMs). These changes make SignPath Foundation the strongest free option for open-source projects.

The current `publish.yml` workflow builds Windows on `windows-latest` via `tauri-apps/tauri-action@v0` and uploads artifacts to a draft GitHub Release. No Authenticode signing happens during this process.

## Goals / Non-Goals

**Goals:**
- Sign the Windows NSIS installer (`.exe`) with a trusted Authenticode certificate via SignPath Foundation
- Integrate signing into the existing GitHub Actions release pipeline with zero manual intervention
- Maintain the current release flow (`make release` -> tag push -> CI builds -> finalize)
- Add a public code signing policy page (required by SignPath Foundation terms)

**Non-Goals:**
- Signing macOS binaries differently (already handled via Apple Developer ID)
- Signing Linux binaries (AppImage signing is not standard practice)
- Purchasing a commercial code-signing certificate
- Changing the Tauri updater signing mechanism (orthogonal to Authenticode)
- Driver signing or kernel-mode signing

## Decisions

### 1. Use SignPath Foundation over alternatives

**Choice:** SignPath Foundation (free, CI-native)

**Alternatives considered:**
- **Azure Trusted Signing ($9.99/mo):** Instant SmartScreen trust but costs money, geographic restrictions for individuals, requires Azure subscription
- **Certum Open Source (~29-69 EUR/yr):** Physical smartcard required, breaks CI/CD automation, currently out of stock
- **OSSign:** Newer initiative, less established track record
- **Commercial EV certificate:** $300-500/yr, no longer bypasses SmartScreen instantly

**Rationale:** SignPath Foundation is free, integrates natively with GitHub Actions, and shares accumulated SmartScreen reputation across all its signed projects. The trade-off is that the publisher name shows "SignPath Foundation" instead of "Kubeli" — acceptable for an open-source project.

### 2. Sign after build, before release upload

**Choice:** Add a signing step between the Tauri build and the artifact upload to GitHub Release.

**Approach:** The Windows build job will:
1. Build the NSIS installer via `tauri-apps/tauri-action@v0`
2. Submit the unsigned `.exe` to SignPath for signing via `signpath/github-action-submit-signing-request`
3. Replace the unsigned artifact with the signed one
4. Upload the signed artifact to the GitHub Release

**Rationale:** SignPath requires the built artifact to be submitted for signing. The Tauri action handles the build; SignPath handles the signing. The two steps are sequential within the same job.

### 3. Use SignPath's GitHub Actions integration

**Choice:** `signpath/github-action-submit-signing-request@v1`

**How it works:**
- SignPath verifies the build origin (must come from the configured GitHub repository and branch)
- The action submits the artifact, waits for signing, and downloads the signed result
- An approver (configured in SignPath) must approve each release signing (can be automated for test builds)

**Required GitHub Secrets:**
- `SIGNPATH_API_TOKEN` — API token for the SignPath organization
- `SIGNPATH_ORGANIZATION_ID` — SignPath organization UUID
- `SIGNPATH_PROJECT_SLUG` — Project identifier in SignPath (e.g., "kubeli")
- `SIGNPATH_SIGNING_POLICY_SLUG` — Signing policy (e.g., "release-signing")

### 4. Code signing policy page on kubeli.dev

**Choice:** Add `/code-signing-policy` to the Astro landing page.

**Content required by SignPath Foundation terms:**
- Statement that binaries are signed via SignPath Foundation
- Link to SignPath Foundation website
- Information on how users can verify signatures
- Link to the project's repository

## Risks / Trade-offs

- **SignPath approval delay** -> Each release requires manual approval by a designated approver in SignPath. Mitigation: Set up a dedicated approver with email notifications; approval is a single click.
- **SignPath service availability** -> If SignPath is down during a release, Windows signing fails. Mitigation: The workflow can be re-run; the draft release persists. Consider making signing optional with a fallback to unsigned.
- **Publisher name shows "SignPath Foundation"** -> Users see "SignPath Foundation" in the Windows SmartScreen dialog, not "Kubeli". Mitigation: Acceptable trade-off for free signing; the app name "Kubeli" still appears in the installer UI itself.
- **Application rejection** -> SignPath Foundation may reject the application if they consider the project insufficiently established. Mitigation: Kubeli has 319+ stars, active development, and published releases — well within their criteria based on comparable accepted projects.

## Migration Plan

1. **Apply to SignPath Foundation** — Submit the OSS Request Form, wait for approval (typically 1-2 weeks)
2. **Configure SignPath project** — Set up the project, signing policy, and artifact configuration in SignPath dashboard
3. **Add GitHub Secrets** — Configure `SIGNPATH_API_TOKEN`, `SIGNPATH_ORGANIZATION_ID`, `SIGNPATH_PROJECT_SLUG`, `SIGNPATH_SIGNING_POLICY_SLUG`
4. **Update publish.yml** — Add the signing step to the Windows build job
5. **Add code signing policy page** — Create the page on kubeli.dev
6. **Test with a pre-release** — Tag a test release, verify the signed installer on a Windows machine
7. **Rollback** — If signing fails, remove the signing step from publish.yml; the workflow reverts to unsigned builds

## Open Questions

- How long will SignPath Foundation take to approve the application?
- Should we make the signing step optional (continue with unsigned if signing fails) or required (fail the release)?
- Do we need to update the download page to mention that Windows binaries are now signed?
