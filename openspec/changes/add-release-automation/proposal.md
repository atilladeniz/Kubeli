# Change: Add Release Automation via GitHub Actions

## Why
The current release workflow in `.github/workflows/release.yml` is disabled (`if: false`) and requires
manual local builds via `make build-deploy`. This creates friction, lacks reproducibility, and requires
a macOS machine for Apple code signing. Automating the release process will ensure consistent builds,
proper signing/notarization, and faster release cycles.

## What Changes
- Enable and update `.github/workflows/release.yml` to build on tag push
- Add multi-architecture builds (ARM64 + x86_64) for macOS
- Add Windows builds (x64) on `windows-latest` runner
- Generate MSI and NSIS installers for Windows
- Integrate SBOM generation into CI workflow
- Add optional FTP deployment for Tauri updater endpoint
- Create `make release` command for local pre-release steps (version bump, changelog, tagging)
- Keep Claude CLI changelog generation local (not available in CI)
- Future: Add Linux builds and Windows ARM64 support

## Workflow Architecture

```
LOCAL (pre-release)                CI (on tag push)                   LOCAL (post-release)
┌─────────────────┐               ┌─────────────────────────┐        ┌─────────────────┐
│ make release    │               │ GitHub Actions          │        │ Optional        │
│ ├─ version-bump │  git push     │ ├─ macOS (macos-14)     │        │ ├─ astro-public │
│ ├─ changelog    │ ──────────>   │ │  ├─ Build ARM64       │ ────>  │ └─ Manual review│
│ └─ git tag      │  --tags       │ │  ├─ Build x86_64      │        │                 │
└─────────────────┘               │ │  └─ Sign & Notarize   │        └─────────────────┘
                                  │ ├─ Windows (windows-latest)
                                  │ │  ├─ Build x64         │
                                  │ │  └─ Generate MSI/NSIS │
                                  │ ├─ Generate SBOM        │
                                  │ ├─ Create Draft Release │
                                  │ └─ Upload all artifacts │
                                  └─────────────────────────┘
```

## Required GitHub Secrets

### macOS Signing
| Secret | Purpose | Required |
|--------|---------|----------|
| `APPLE_CERTIFICATE` | Base64 encoded .p12 certificate | Yes |
| `APPLE_CERTIFICATE_PASSWORD` | Certificate password | Yes |
| `APPLE_SIGNING_IDENTITY` | "Developer ID Application: Name (TeamID)" | Yes |
| `APPLE_API_ISSUER` | App Store Connect API Issuer ID | Yes |
| `APPLE_API_KEY` | App Store Connect API Key ID | Yes |
| `APPLE_API_KEY_PATH` | Path to API key file | Yes |

### Windows Signing (SignPath - Recommended)
| Secret | Purpose | Required |
|--------|---------|----------|
| `SIGNPATH_API_TOKEN` | SignPath API token | Yes |
| `SIGNPATH_ORGANIZATION_ID` | SignPath organization ID | Yes |

### Windows Signing (Alternative: Own Certificate)
| Secret | Purpose | Required |
|--------|---------|----------|
| `WINDOWS_CERTIFICATE` | Base64 encoded .pfx code signing certificate | No |
| `WINDOWS_CERTIFICATE_PASSWORD` | Certificate password | No |

### Tauri Updater
| Secret | Purpose | Required |
|--------|---------|----------|
| `TAURI_SIGNING_PRIVATE_KEY` | Tauri update signing key | Yes |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Key password (can be empty) | Yes |

### Deployment (Optional)
| Secret | Purpose | Required |
|--------|---------|----------|
| `FTP_HOST` | FTP server for updates | Optional |
| `FTP_USER` | FTP username | Optional |
| `FTP_PASSWORD` | FTP password | Optional |

## Windows Build Details

### Runner and Dependencies
- Runner: `windows-latest` (Windows Server 2022)
- No additional system dependencies required (unlike Ubuntu)
- Node.js 20 via `actions/setup-node@v4`
- Rust stable via `dtolnay/rust-toolchain@stable`

### Build Artifacts
| Artifact | Path | Description |
|----------|------|-------------|
| MSI Installer | `src-tauri/target/release/bundle/msi/*.msi` | Windows Installer package |
| NSIS Installer | `src-tauri/target/release/bundle/nsis/*.exe` | Nullsoft installer (preferred for winget) |

### Code Signing (Required)
Windows code signing is **required** for production releases:
- Avoids Windows SmartScreen "Unknown publisher" warnings
- Required for winget package validation and approval
- Enables enterprise deployment and trusted installation
- Prevents antivirus false positives

| Secret | Purpose | Required |
|--------|---------|----------|
| `WINDOWS_CERTIFICATE` | Base64 encoded .pfx code signing certificate | Yes |
| `WINDOWS_CERTIFICATE_PASSWORD` | Certificate password | Yes |

#### Certificate Options

**Free Options (Open Source):**
| Provider | Cost | Requirements | SmartScreen |
|----------|------|--------------|-------------|
| [SignPath Foundation](https://signpath.org/) | Free | Open-source on GitHub | ✅ EV-equivalent |
| [OSSign](https://ossign.org/) | Free | Open-source project | ✅ Trusted |
| [SSL.com Open Source](https://ssl.com) | Free | Open-source license | ✅ Trusted |

**Budget Options:**
| Provider | Cost/Year | SmartScreen | Notes |
|----------|-----------|-------------|-------|
| [Certum Open Source](https://certum.store/open-source-code-signing-code.html) | ~$50 | ⚠️ Reputation | For OSS developers |
| [Certum Standard](https://certum.store/data-safety/code-signing-certificates.html) | ~$90-110 | ⚠️ Reputation | OV certificate |
| [Azure Trusted Signing](https://azure.microsoft.com/en-us/pricing/details/trusted-signing/) | ~$120 ($9.99/mo) | ✅ Immediate | Cloud-based, no HSM needed |

**Premium Options:**
| Provider | Cost/Year | SmartScreen | Notes |
|----------|-----------|-------------|-------|
| [Certum EV Cloud](https://www.sslmentor.com/certum/certumcodecloudev) | ~$226-290 | ✅ Immediate | Cloud HSM included |
| [Sectigo EV](https://sectigo.com) | ~$300-400 | ✅ Immediate | Hardware token |
| [DigiCert EV](https://digicert.com) | ~$400-500 | ✅ Immediate | Premium support |

**Recommendation for Kubeli:**
1. 🥇 **SignPath Foundation** - Free, EV-equivalent, GitHub Actions integration
2. 🥈 **Azure Trusted Signing** - $9.99/mo, Microsoft-backed, no hardware token
3. 🥉 **Certum Open Source** - $50/year, fallback option

**Important Changes (2023-2025):**
- OV certificates now build SmartScreen reputation very slowly (can take years)
- EV certificates no longer have instant SmartScreen trust since March 2024
- Hardware tokens are required for new OV/EV certificates since June 2023 (except cloud options)
- Azure Trusted Signing is the cheapest option with immediate trust ($9.99/mo)

#### SignPath Integration
SignPath provides a GitHub Action for seamless CI integration:
```yaml
- uses: SignPath/github-action-submit-signing-request@v1
  with:
    api-token: ${{ secrets.SIGNPATH_API_TOKEN }}
    organization-id: ${{ secrets.SIGNPATH_ORGANIZATION_ID }}
    project-slug: kubeli
    signing-policy-slug: release-signing
    artifact-configuration-slug: windows-installer
```

#### Signing in Tauri
Tauri uses `signtool.exe` automatically when `TAURI_SIGNING_IDENTITY` is set on Windows:
```yaml
env:
  TAURI_SIGNING_IDENTITY: ${{ secrets.WINDOWS_CERTIFICATE }}
```

## Impact
- Affected specs: distribution (new)
- Affected code:
  - `.github/workflows/release.yml`
  - `Makefile` (new `release` target)
  - `scripts/` (helper scripts)
  - `CLAUDE.md` (documentation)

## References
- [Tauri Windows Code Signing Guide](https://v2.tauri.app/distribute/sign/windows/)
- [Azure Trusted Signing Pricing](https://azure.microsoft.com/en-us/pricing/details/trusted-signing/)
- [SignPath Foundation](https://signpath.org/)
- [Certum Code Signing Certificates](https://certum.store/data-safety/code-signing-certificates.html)
- [Code Signing on Windows with Azure Trusted Signing](https://melatonin.dev/blog/code-signing-on-windows-with-azure-trusted-signing/)
- [Electron Code Signing Guide](https://www.electronjs.org/docs/latest/tutorial/code-signing)
