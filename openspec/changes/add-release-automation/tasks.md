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
- [ ] 3.1 Create conditional FTP deploy job
- [ ] 3.2 Generate `latest.json` for Tauri updater
- [ ] 3.3 Upload update artifacts to FTP

## 4. Create Local Release Command
- [ ] 4.1 Add `make release` target combining: version-bump, changelog, tag
- [ ] 4.2 Add interactive confirmation before tagging
- [ ] 4.3 Add `make release-push` for tagging and pushing

## 5. Documentation
- [ ] 5.1 Document required GitHub secrets in README
- [ ] 5.2 Update CLAUDE.md with release workflow
- [ ] 5.3 Add troubleshooting guide for signing issues

## 6. Windows Build Configuration
- [ ] 6.1 Add Windows build job to release workflow
- [ ] 6.2 Configure NSIS settings in `tauri.conf.json`
- [ ] 6.3 Add Windows artifact upload (MSI + NSIS exe)
- [ ] 6.4 Verify Windows builds work with `workflow_dispatch`

## 7. Windows Code Signing (SignPath Foundation)
- [ ] 7.1 Apply for SignPath Foundation open-source program
- [ ] 7.2 Configure SignPath project and signing policy
- [ ] 7.3 Add `SIGNPATH_API_TOKEN` secret to GitHub
- [ ] 7.4 Add `SIGNPATH_ORGANIZATION_ID` secret to GitHub
- [ ] 7.5 Add SignPath GitHub Action to release workflow
- [ ] 7.6 Verify signed installer passes SmartScreen

## 8. Testing
- [ ] 8.1 Test workflow with manual trigger
- [ ] 8.2 Verify macOS DMG is properly signed and notarized
- [ ] 8.3 Verify Windows MSI and NSIS installers are generated and signed
- [ ] 8.4 Verify signed Windows installer passes SmartScreen on clean machine
- [ ] 8.5 Verify SBOM files are attached to release
