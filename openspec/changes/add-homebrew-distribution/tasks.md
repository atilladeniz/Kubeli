# Tasks: Add Homebrew Distribution

## 1. Create Homebrew Tap Repository
- [ ] 1.1 Create `homebrew-kubeli` repository on GitHub
- [ ] 1.2 Add README with tap installation instructions
- [ ] 1.3 Create `Casks/` directory structure

## 2. Create Kubeli Cask Formula
- [ ] 2.1 Write `Casks/kubeli.rb` formula
- [ ] 2.2 Calculate SHA256 for current DMG release
- [ ] 2.3 Add livecheck block for automatic version detection
- [ ] 2.4 Add zap stanza for complete uninstall
- [ ] 2.5 Test formula locally with `brew install --cask ./Casks/kubeli.rb`

## 3. Automate Cask Updates
- [ ] 3.1 Create `scripts/update-homebrew-cask.sh` script
- [ ] 3.2 Script should: download DMG, calculate SHA256, update formula, commit, push
- [ ] 3.3 Add `make brew-update` target to Makefile
- [ ] 3.4 Integrate into `make build-deploy` pipeline

## 4. CI Integration (Optional)
- [ ] 4.1 Add step to release workflow to update Homebrew tap
- [ ] 4.2 Use GitHub App or PAT for cross-repo push
- [ ] 4.3 Add `HOMEBREW_TAP_TOKEN` secret

## 5. Documentation
- [ ] 5.1 Update README with Homebrew installation instructions
- [ ] 5.2 Update landing page (web/) with Homebrew section
- [ ] 5.3 Add troubleshooting for common Homebrew issues

## 6. Testing
- [ ] 6.1 Test fresh install: `brew tap atilladeniz/kubeli && brew install --cask kubeli`
- [ ] 6.2 Test upgrade: `brew upgrade --cask kubeli`
- [ ] 6.3 Test uninstall: `brew uninstall --cask kubeli --zap`

## 7. Future: Windows Distribution (Deferred)
- [ ] 7.1 Research winget manifest format
- [ ] 7.2 Research Chocolatey package format
- [ ] 7.3 Create separate proposal when Windows builds are ready
