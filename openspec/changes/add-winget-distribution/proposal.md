# Change: Add Windows Package Manager (winget) Distribution

## Why
Windows users expect to install applications via `winget install kubeli`. Currently, Kubeli only
supports macOS, but when Windows builds are added, distribution via winget will provide the best
user experience. Winget is Microsoft's official package manager, pre-installed on Windows 11 and
available for Windows 10.

## What Changes
- Add Windows build targets to release workflow (NSIS installer)
- Create winget manifest files for Microsoft's winget-pkgs repository
- Submit package to winget-pkgs via Pull Request
- Automate manifest updates on new releases
- Add `make winget-update` command for manual manifest updates

## Prerequisites
Before implementing this proposal:
1. Windows builds must be enabled in `release.yml`
2. Code signing certificate for Windows (optional but recommended)
3. NSIS installer configured in `tauri.conf.json`

## Distribution Strategy

### Winget Community Repository
```powershell
winget install Kubeli.Kubeli
# or after approval:
winget install kubeli
```

- Submit to `microsoft/winget-pkgs` repository
- Goes through automated validation
- Manual review for first submission
- Updates can be automated via GitHub Actions

## Manifest Structure

```
manifests/
└── k/
    └── Kubeli/
        └── Kubeli/
            └── 0.2.41/
                ├── Kubeli.Kubeli.installer.yaml
                ├── Kubeli.Kubeli.locale.en-US.yaml
                └── Kubeli.Kubeli.yaml
```

### Version Manifest (Kubeli.Kubeli.yaml)
```yaml
PackageIdentifier: Kubeli.Kubeli
PackageVersion: 0.2.41
DefaultLocale: en-US
ManifestType: version
ManifestVersion: 1.6.0
```

### Installer Manifest (Kubeli.Kubeli.installer.yaml)
```yaml
PackageIdentifier: Kubeli.Kubeli
PackageVersion: 0.2.41
Platform:
  - Windows.Desktop
MinimumOSVersion: 10.0.17763.0
InstallerType: nsis
Scope: user
InstallModes:
  - interactive
  - silent
  - silentWithProgress
Installers:
  - Architecture: x64
    InstallerUrl: https://github.com/atilladeniz/Kubeli/releases/download/v0.2.41/Kubeli_0.2.41_x64-setup.exe
    InstallerSha256: ABC123...
  - Architecture: arm64
    InstallerUrl: https://github.com/atilladeniz/Kubeli/releases/download/v0.2.41/Kubeli_0.2.41_arm64-setup.exe
    InstallerSha256: DEF456...
ManifestType: installer
ManifestVersion: 1.6.0
```

### Locale Manifest (Kubeli.Kubeli.locale.en-US.yaml)
```yaml
PackageIdentifier: Kubeli.Kubeli
PackageVersion: 0.2.41
PackageLocale: en-US
Publisher: Atilla Deniz
PublisherUrl: https://kubeli.app
PackageName: Kubeli
PackageUrl: https://kubeli.app
License: MIT
ShortDescription: Modern Kubernetes management desktop application
Description: |
  Kubeli is a lightweight and intuitive desktop application for managing
  Kubernetes clusters. Built with Next.js and Tauri, it provides a native
  desktop experience with real-time cluster monitoring, pod management,
  log streaming, and shell access.
Tags:
  - kubernetes
  - k8s
  - devops
  - containers
  - cluster-management
ManifestType: defaultLocale
ManifestVersion: 1.6.0
```

## Alternative: Chocolatey / Scoop

| Manager | Pros | Cons |
|---------|------|------|
| **winget** | Official, pre-installed Win11 | Review process |
| **Chocolatey** | Large community, easy setup | Requires separate account |
| **Scoop** | Developer-focused, no admin | Less mainstream |

Recommendation: Start with winget, add Chocolatey later if demand exists.

## Impact
- Affected specs: distribution
- Affected code:
  - `.github/workflows/release.yml` (Windows build + manifest update)
  - `src-tauri/tauri.conf.json` (NSIS configuration)
  - `scripts/update-winget-manifest.sh`
  - `Makefile` (winget-update target)
  - `README.md` (Windows installation instructions)
