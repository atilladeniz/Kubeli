# Change: Add Release Automation via GitHub Actions

## Why
The current release workflow in `.github/workflows/release.yml` is disabled (`if: false`) and requires
manual local builds via `make build-deploy`. This creates friction, lacks reproducibility, and requires
a macOS machine for Apple code signing. Automating the release process will ensure consistent builds,
proper signing/notarization, and faster release cycles.

## What Changes
- Enable and update `.github/workflows/release.yml` to build on tag push
- Add multi-architecture builds (ARM64 + x86_64) for macOS
- Integrate SBOM generation into CI workflow
- Add optional FTP deployment for Tauri updater endpoint
- Create `make release` command for local pre-release steps (version bump, changelog, tagging)
- Keep Claude CLI changelog generation local (not available in CI)
- Future: Add Windows and Linux builds

## Workflow Architecture

```
LOCAL (pre-release)                CI (on tag push)                   LOCAL (post-release)
┌─────────────────┐               ┌─────────────────┐                ┌─────────────────┐
│ make release    │               │ GitHub Actions  │                │ Optional        │
│ ├─ version-bump │  git push     │ ├─ Build ARM64  │                │ ├─ astro-public │
│ ├─ changelog    │ ──────────>   │ ├─ Build x86_64 │ ──────────>    │ └─ Manual review│
│ └─ git tag      │  --tags       │ ├─ Sign & Notarize              │                 │
└─────────────────┘               │ ├─ Generate SBOM │               └─────────────────┘
                                  │ ├─ Create Draft Release
                                  │ └─ Upload artifacts
                                  └─────────────────┘
```

## Required GitHub Secrets

| Secret | Purpose | Required |
|--------|---------|----------|
| `APPLE_CERTIFICATE` | Base64 encoded .p12 certificate | Yes (macOS) |
| `APPLE_CERTIFICATE_PASSWORD` | Certificate password | Yes (macOS) |
| `APPLE_SIGNING_IDENTITY` | "Developer ID Application: Name (TeamID)" | Yes (macOS) |
| `APPLE_API_ISSUER` | App Store Connect API Issuer ID | Yes (notarization) |
| `APPLE_API_KEY` | App Store Connect API Key ID | Yes (notarization) |
| `APPLE_API_KEY_PATH` | Path to API key file | Yes (notarization) |
| `TAURI_SIGNING_PRIVATE_KEY` | Tauri update signing key | Yes (updater) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Key password (can be empty) | Yes |
| `FTP_HOST` | FTP server for updates | Optional |
| `FTP_USER` | FTP username | Optional |
| `FTP_PASSWORD` | FTP password | Optional |

## Impact
- Affected specs: distribution (new)
- Affected code:
  - `.github/workflows/release.yml`
  - `Makefile` (new `release` target)
  - `scripts/` (helper scripts)
  - `CLAUDE.md` (documentation)
