## 1. GitHub Secrets Setup

- [ ] 1.1 Add `TAURI_SIGNING_PRIVATE_KEY` secret to GitHub repo (content of `~/.tauri/kubeli.key`)
- [ ] 1.2 Add `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secret (empty string if no password)
- [ ] 1.3 Add FTP secrets: `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD` from `.env`
- [ ] 1.4 Add deploy path secrets: `DEPLOY_API_FTP_PATH`, `DEPLOY_API_URL`, `DEPLOY_LANDING_FTP_PATH` from `.env`

## 2. Publish Workflow — Skeleton and Triggers

- [ ] 2.1 Delete `.github/workflows/release.yml`
- [ ] 2.2 Create `.github/workflows/publish.yml` with `on: release: types: [created]` and `workflow_dispatch` triggers
- [ ] 2.3 Add version extraction step that reads version from the release tag (`${GITHUB_REF#refs/tags/v}`)
- [ ] 2.4 Add concurrency group to prevent parallel runs for the same version
- [ ] 2.5 Extract `release_id` from the triggering release event for passing to build jobs

## 3. Windows Build Job

- [ ] 3.1 Add `build-windows` job on `windows-latest`
- [ ] 3.2 Add Node.js setup (`actions/setup-node@v6`, cache: npm)
- [ ] 3.3 Add Rust setup (`dtolnay/rust-toolchain@stable`) with target `x86_64-pc-windows-msvc`
- [ ] 3.4 Add Rust cache (`swatinem/rust-cache@v2`, workspaces: `src-tauri`)
- [ ] 3.5 Add `npm ci` and Tauri build via `tauri-apps/tauri-action@v0` with `releaseId`, `tagName`, `TAURI_SIGNING_PRIVATE_KEY`, and `uploadUpdaterJson: true`

## 4. Linux Build Job

- [ ] 4.1 Add `build-linux` job on `ubuntu-22.04`
- [ ] 4.2 Add system dependencies step: `sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`
- [ ] 4.3 Add Node.js, Rust, and Rust cache setup (same as Windows job)
- [ ] 4.4 Add `npm ci` and Tauri build via `tauri-apps/tauri-action@v0` with `releaseId`, `tagName`, `TAURI_SIGNING_PRIVATE_KEY`, and `uploadUpdaterJson: true`

## 5. Finalize Job — FTP Updater Manifest (latest.json)

- [ ] 5.1 Add `finalize` job on `ubuntu-latest` with `needs: [build-windows, build-linux]`
- [ ] 5.2 Download all `.sig` files from the GitHub Release via `gh release download --pattern '*.sig'`
- [ ] 5.3 Read signature files for macOS, Windows, and Linux into variables
- [ ] 5.4 Construct FTP-specific `latest.json` with `version`, `notes`, `pub_date`, and platform entries for `darwin-aarch64`, `darwin-x86_64`, `windows-x86_64`, `linux-x86_64` — all URLs pointing to `https://${DEPLOY_API_URL}/...`

## 6. Finalize Job — FTP Deployment

- [ ] 6.1 Download macOS `.app.tar.gz`, Windows `.exe`, Linux `.AppImage` + all `.sig` files from the release
- [ ] 6.2 Upload versioned macOS `.app.tar.gz` + `.sig` to FTP update path via `curl -T`
- [ ] 6.3 Upload versioned Windows `.exe` + `.sig` to FTP update path
- [ ] 6.4 Upload versioned Linux `.AppImage` + `.sig` to FTP update path
- [ ] 6.5 Upload FTP `latest.json` to FTP update path
- [ ] 6.6 Upload macOS DMG, Windows EXE, Linux AppImage to landing page FTP path (versioned + `_latest` alias)

## 7. Finalize Job — Changelog and Release Publishing

- [ ] 7.1 Extract changelog section for current version from `CHANGELOG.md` (match `## [{version}]` to next `## [`)
- [ ] 7.2 Update GitHub Release body with extracted changelog (fallback to CHANGELOG.md link if not found)
- [ ] 7.3 Mark the GitHub Release as published (non-draft) via `gh release edit --draft=false`

## 8. Dual Updater Endpoints in tauri.conf.json

- [ ] 8.1 Add GitHub Releases endpoint as second entry in `tauri.conf.json` `plugins.updater.endpoints` array: `https://github.com/atilladeniz/Kubeli/releases/latest/download/latest.json`

## 9. Makefile Updates

- [ ] 9.1 Add `make release` target that chains: `build` (macOS only) → tag + push → `github-release` (draft with macOS DMG + .app.tar.gz + .sig)
- [ ] 9.2 Update `make github-release` to create draft releases (add `--draft` flag) and upload `.app.tar.gz` + `.app.tar.gz.sig` in addition to DMG
- [ ] 9.3 Rename current `make build-deploy` to `make build-deploy-legacy` for transition period
- [ ] 9.4 Create new `make build-deploy` that aliases to `make release`

## 10. Validation and Dry Run

- [ ] 10.1 Push workflow to a feature branch and verify it loads in GitHub Actions UI without syntax errors
- [ ] 10.2 Test with a real patch release: run the full local flow (version bump, changelog, build, draft release)
- [ ] 10.3 Verify CI triggers and builds Windows + Linux successfully
- [ ] 10.4 Verify GitHub Release `latest.json` contains all platform entries with GitHub download URLs
- [ ] 10.5 Verify FTP `latest.json` is deployed and contains all 4 platform entries with FTP URLs
- [ ] 10.6 Verify landing page FTP files are updated (versioned + latest aliases)
- [ ] 10.7 Verify GitHub Release is published with all platform artifacts and changelog notes
- [ ] 10.8 Test `workflow_dispatch` manual trigger as fallback
- [ ] 10.9 Test updater failover: verify app falls back to GitHub endpoint when FTP is unreachable
