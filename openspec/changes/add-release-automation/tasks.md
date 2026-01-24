# Tasks: Add Release Automation

## 1. Enable Release Workflow
- [ ] 1.1 Remove `if: false` conditions from `.github/workflows/release.yml`
- [ ] 1.2 Update runner to `macos-14` (Apple Silicon native)
- [ ] 1.3 Add `workflow_dispatch` trigger for manual releases
- [ ] 1.4 Update action versions (checkout@v4, setup-node@v4)
- [ ] 1.5 Add `windows-latest` to build matrix

## 2. Add SBOM Generation to CI
- [ ] 2.1 Install `cargo-cyclonedx` in workflow
- [ ] 2.2 Add npm SBOM generation step
- [ ] 2.3 Attach SBOMs to GitHub release

## 3. Add FTP Deployment Job (Optional)
- [x] 3.1 Create conditional FTP deploy job (`make deploy`)
- [x] 3.2 Generate `latest.json` for Tauri updater (macOS + Windows)
- [x] 3.3 Upload update artifacts to FTP

## 4. Create Local Release Command
- [ ] 4.1 Add `make release` target combining: version-bump, changelog, tag
- [ ] 4.2 Add interactive confirmation before tagging
- [ ] 4.3 Add `make release-push` for tagging and pushing

## 5. Documentation
- [ ] 5.1 Document required GitHub secrets in README
- [x] 5.2 Update CLAUDE.md with release workflow
- [ ] 5.3 Add troubleshooting guide for signing issues
- [x] 5.4 Add Windows development setup documentation (`.dev/windows/WINDOWS-SETUP.md`)

## 6. Windows Build Configuration
- [ ] 6.1 Add Windows build job to release workflow (GitHub Actions)
- [x] 6.2 Configure NSIS settings in `tauri.conf.json` (languages, WebView2 embedBootstrapper)
- [x] 6.3 Add cross-compile Windows build from macOS (`make build-windows`)
- [x] 6.4 Add Tauri signing for Windows auto-updates (`.exe` + `.exe.sig`)
- [x] 6.5 Add `make build-all` target for macOS + Windows builds
- [x] 6.6 Add `make github-release` with Windows EXE support
- [x] 6.7 Add `make deploy-web` with Windows EXE upload

## 7. Windows Code Signing (SignPath Foundation) - Optional
- [ ] 7.1 Apply for SignPath Foundation open-source program
- [ ] 7.2 Configure SignPath project and signing policy
- [ ] 7.3 Add `SIGNPATH_API_TOKEN` secret to GitHub
- [ ] 7.4 Add `SIGNPATH_ORGANIZATION_ID` secret to GitHub
- [ ] 7.5 Add SignPath GitHub Action to release workflow
- [ ] 7.6 Verify signed installer passes SmartScreen

## 8. Testing
- [ ] 8.1 Test workflow with manual trigger
- [ ] 8.2 Verify macOS DMG is properly signed and notarized
- [x] 8.3 Verify Windows NSIS installer is generated via cross-compile
- [x] 8.4 Verify Tauri signing works for Windows auto-updates
- [ ] 8.5 Verify SBOM files are attached to release

## 9. Windows Development Environment (NEW - Completed)
- [x] 9.1 Add PowerShell setup script for Windows minikube (`setup-minikube.ps1`)
- [x] 9.2 Add remote minikube connection for VMs (`connect-minikube.ps1`)
- [x] 9.3 Add `make minikube-serve` for exposing API to Windows VMs
- [x] 9.4 Fix kubeconfig BOM issue for YAML parsing
- [x] 9.5 Add OS-specific UX (paths, commands, keyboard shortcuts)
- [x] 9.6 Add centralized `usePlatform` hook for platform detection
