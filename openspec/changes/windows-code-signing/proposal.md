## Why

Kubeli's Windows binaries ship unsigned, which triggers Windows Defender SmartScreen warnings and blocks automatic updates. Users have to manually bypass security prompts to install or update the app. Since March 2024, EV certificates no longer provide instant SmartScreen bypass — reputation builds organically regardless of certificate type. SignPath Foundation offers free code signing for open-source projects with shared reputation across dozens of established projects (Vim, Stellarium, Transmission, etc.), making it the best option for Kubeli.

## What Changes

- Integrate SignPath Foundation's CI-based code signing into the GitHub Actions release pipeline
- Sign all Windows build artifacts (NSIS installer `.exe`) during the `publish.yml` workflow
- Add a code signing policy page to the landing site (required by SignPath Foundation terms)
- Update the download page to display signing/verification information
- Add SignPath organization and signing policy configuration to the repository
- Configure the Windows build job to submit artifacts to SignPath for signing before uploading to the GitHub Release

## Capabilities

### New Capabilities
- `windows-code-signing`: Windows Authenticode code signing via SignPath Foundation, integrated into the CI/CD release pipeline with GitHub Actions

### Modified Capabilities
- `security`: Add code signing verification requirements and policy documentation for Windows binaries

## Impact

- **CI/CD**: `publish.yml` Windows build job gains a SignPath signing step between build and artifact upload
- **GitHub Secrets**: New secrets required: `SIGNPATH_API_TOKEN`, `SIGNPATH_ORGANIZATION_ID`, `SIGNPATH_SIGNING_POLICY_SLUG`, `SIGNPATH_PROJECT_SLUG`
- **Landing page** (`web/`): New code signing policy page at `/code-signing-policy`
- **Dependencies**: SignPath GitHub Action (`signpath/github-action-submit-signing-request`)
- **External accounts**: SignPath Foundation OSS program application required (approval process)
- **Publisher name**: Windows installer will show "SignPath Foundation" as publisher, not "Kubeli" or individual developer name
- **No breaking changes**: macOS and Linux build pipelines remain unchanged
