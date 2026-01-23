# Tasks: Add Release Automation

## 1. Enable Release Workflow
- [ ] 1.1 Remove `if: false` conditions from `.github/workflows/release.yml`
- [ ] 1.2 Update runner to `macos-14` (Apple Silicon native)
- [ ] 1.3 Add `workflow_dispatch` trigger for manual releases
- [ ] 1.4 Update action versions (checkout@v4, setup-node@v4)

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

## 6. Testing
- [ ] 6.1 Test workflow with manual trigger
- [ ] 6.2 Verify DMG is properly signed and notarized
- [ ] 6.3 Verify SBOM files are attached to release
