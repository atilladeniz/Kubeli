# Tasks: Add Windows Package Manager (winget) Distribution

## 0. Prerequisites (from add-release-automation)
- [ ] 0.1 Enable Windows builds in release workflow
- [ ] 0.2 Configure NSIS installer in tauri.conf.json
- [ ] 0.3 (Optional) Set up Windows code signing certificate

## 1. Create Initial Winget Manifest
- [ ] 1.1 Fork `microsoft/winget-pkgs` repository
- [ ] 1.2 Create manifest directory structure `manifests/k/Kubeli/Kubeli/<version>/`
- [ ] 1.3 Write version manifest (`Kubeli.Kubeli.yaml`)
- [ ] 1.4 Write installer manifest (`Kubeli.Kubeli.installer.yaml`)
- [ ] 1.5 Write locale manifest (`Kubeli.Kubeli.locale.en-US.yaml`)
- [ ] 1.6 Validate manifests with `winget validate`

## 2. Submit to Winget Repository
- [ ] 2.1 Create Pull Request to `microsoft/winget-pkgs`
- [ ] 2.2 Pass automated validation checks
- [ ] 2.3 Address review feedback if any
- [ ] 2.4 Wait for merge approval

## 3. Automate Manifest Updates
- [ ] 3.1 Create `scripts/update-winget-manifest.sh` script
- [ ] 3.2 Script should: generate manifests, calculate SHA256, create PR
- [ ] 3.3 Add `make winget-update` target to Makefile
- [ ] 3.4 Consider using `wingetcreate` CLI tool for automation

## 4. CI Integration
- [ ] 4.1 Add Windows build job to release workflow (x64 + arm64)
- [ ] 4.2 Add step to generate winget manifests after build
- [ ] 4.3 Add step to create PR to winget-pkgs (using GitHub token)
- [ ] 4.4 Add `WINGET_PKGS_TOKEN` secret (PAT with repo scope)

## 5. Documentation
- [ ] 5.1 Update README with Windows/winget installation instructions
- [ ] 5.2 Update landing page (web/) with Windows download section
- [ ] 5.3 Document manual manifest update process

## 6. Testing
- [ ] 6.1 Test NSIS installer on Windows VM
- [ ] 6.2 Test `winget install` from local manifest
- [ ] 6.3 Test silent install: `winget install Kubeli.Kubeli --silent`
- [ ] 6.4 Test upgrade: `winget upgrade Kubeli.Kubeli`
- [ ] 6.5 Test uninstall: `winget uninstall Kubeli.Kubeli`

## 7. Future Enhancements (Deferred)
- [ ] 7.1 Add Chocolatey package
- [ ] 7.2 Add Scoop bucket
- [ ] 7.3 Add Microsoft Store listing
