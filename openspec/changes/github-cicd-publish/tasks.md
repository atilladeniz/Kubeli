## 1. GitHub Secrets Setup (manual, by developer)

- [ ] 1.1 Export Apple Developer ID certificate as .p12, base64 encode, add as `APPLE_CERTIFICATE`
- [ ] 1.2 Add `APPLE_CERTIFICATE_PASSWORD` secret
- [ ] 1.3 Add `APPLE_SIGNING_IDENTITY` secret (e.g., "Developer ID Application: Name (TEAMID)")
- [ ] 1.4 Add App Store Connect API key secrets: `APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_KEY_PATH`
- [ ] 1.5 Add `TAURI_SIGNING_PRIVATE_KEY` (content of `~/.tauri/kubeli.key`) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- [ ] 1.6 Add FTP secrets: `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD`
- [ ] 1.7 Add deploy path secrets: `DEPLOY_API_FTP_PATH`, `DEPLOY_API_URL`, `DEPLOY_LANDING_FTP_PATH`

## 2. Publish Workflow — Skeleton

- [ ] 2.1 Delete `.github/workflows/release.yml`
- [ ] 2.2 Create `.github/workflows/publish.yml` with triggers: `push: tags: ['v*']` and `workflow_dispatch`
- [ ] 2.3 Add concurrency group to prevent parallel runs

## 3. Create-Release Job

- [ ] 3.1 Add `create-release` job on `ubuntu-latest` that extracts version from tag
- [ ] 3.2 Extract changelog section from `CHANGELOG.md` for the current version
- [ ] 3.3 Create draft GitHub Release with changelog as body, output `release_id`

## 4. Build Matrix Job

- [ ] 4.1 Add `build` job with matrix: macOS aarch64, macOS x86_64, Windows x64, Linux x64
- [ ] 4.2 Add Node.js setup (`actions/setup-node@v6`, cache: npm) for all platforms
- [ ] 4.3 Add Rust setup (`dtolnay/rust-toolchain@stable`) with conditional targets for macOS
- [ ] 4.4 Add Rust cache (`swatinem/rust-cache@v2`, workspaces: `src-tauri`)
- [ ] 4.5 Add Linux system deps step (conditional on ubuntu): `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`
- [ ] 4.6 Add `npm ci` step
- [ ] 4.7 Add `tauri-apps/tauri-action@v0` with `releaseId`, `tagName`, `uploadUpdaterJson: true`
- [ ] 4.8 Pass Apple signing env vars (conditional on macOS): `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_KEY_PATH`
- [ ] 4.9 Pass Tauri signing env vars: `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

## 5. Finalize Job — FTP Updater Manifest

- [ ] 5.1 Add `finalize` job on `ubuntu-latest` with `needs: [create-release, build]`
- [ ] 5.2 Download all `.sig` files and updater artifacts from the GitHub Release via `gh release download`
- [ ] 5.3 Read signature files for all platforms into variables
- [ ] 5.4 Construct FTP-specific `latest.json` with FTP download URLs for all platforms

## 6. Finalize Job — FTP Deployment

- [ ] 6.1 Download macOS `.app.tar.gz`, Windows `.exe`, Linux `.AppImage` + all `.sig` files from the release
- [ ] 6.2 Upload versioned update artifacts (all platforms + sigs) to FTP update path via `curl -T`
- [ ] 6.3 Upload FTP `latest.json` to FTP update path
- [ ] 6.4 Upload installers (DMG, EXE, AppImage) to landing page FTP path (versioned + `_latest` alias)

## 7. Finalize Job — Publish Release

- [ ] 7.1 Mark the GitHub Release as published (non-draft) via `gh release edit --draft=false`

## 8. Dual Updater Endpoints

- [ ] 8.1 Add GitHub Releases endpoint as second entry in `tauri.conf.json` `plugins.updater.endpoints` array

## 9. Makefile Updates

- [ ] 9.1 Add `make release` target: version-bump → generate-changelog → commit → tag → push (triggers CI)
- [ ] 9.2 Rename current `make build-deploy` to `make build-deploy-legacy`
- [ ] 9.3 Create new `make build-deploy` that aliases to `make release`

## 10. Validation

- [ ] 10.1 Push workflow to a feature branch and verify syntax in GitHub Actions UI
- [ ] 10.2 Test full release: version bump → changelog → commit → tag push → CI builds all platforms
- [ ] 10.3 Verify macOS builds are signed and notarized
- [ ] 10.4 Verify GitHub Release `latest.json` contains all platform entries
- [ ] 10.5 Verify FTP `latest.json` deployed with correct FTP URLs
- [ ] 10.6 Verify landing page FTP files updated
- [ ] 10.7 Verify GitHub Release published with changelog notes
- [ ] 10.8 Test `workflow_dispatch` manual trigger
- [ ] 10.9 Test updater failover: FTP down → GitHub endpoint works
