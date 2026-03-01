## Why

The entire release pipeline (`make build-deploy`) runs locally on the developer's macOS machine — including Windows cross-compilation, FTP uploads, changelog generation, and GitHub release creation. This creates a single point of failure, prevents Linux builds entirely, and makes releases non-reproducible. Moving to GitHub Actions CI/CD enables multi-platform builds (Windows native, Linux native), automated changelog from release commits, and a repeatable pipeline — while keeping macOS builds local where Apple signing identity lives.

## What Changes

- **New GitHub Actions publish workflow** that builds Windows (NSIS installer) and Linux (AppImage/deb) natively on GitHub runners, triggered by `chore(release): bump version to X.Y.Z` commits on `main`
- **Hybrid release model**: macOS built + signed locally, artifacts uploaded to GitHub release → CI picks up the release, builds Windows + Linux, attaches their artifacts, assembles `latest.json` updater manifest, deploys to FTP update server
- **Automated changelog extraction**: CI parses the changelog content from the release commit message body (generated locally via Claude before committing) and uses it for GitHub Release notes
- **Automated updater manifest**: `latest.json` assembled from all platform artifacts (macOS local + Windows/Linux CI) and deployed to the FTP update server
- **Linux support**: First-class Linux builds (AppImage + deb) with Tauri updater signing
- **Existing `make build-deploy` simplified**: Local flow reduced to macOS build + sign + push release commit + upload macOS artifacts to draft release; CI handles the rest

## Capabilities

### New Capabilities

- `ci-publish`: GitHub Actions workflow for multi-platform Tauri builds (Windows, Linux), artifact signing, updater manifest generation, FTP deployment, and GitHub Release management
- `release-flow`: End-to-end release orchestration — local macOS build trigger, CI multi-platform builds, changelog extraction, updater manifest assembly, and deployment coordination

### Modified Capabilities

_None — this change introduces new CI/CD infrastructure without modifying existing application specs._

## Impact

- **New files**: `.github/workflows/publish.yml` (main workflow), possibly `.github/workflows/upload-macos.yml` (helper for local artifact upload)
- **Modified files**: `Makefile` (simplified `build-deploy` target), `src-tauri/tauri.conf.json` (updater endpoints if needed), `scripts/generate-changelog.js` (adapt for CI context)
- **GitHub Secrets required**: `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD`, `DEPLOY_API_FTP_PATH`, `DEPLOY_API_URL`, `DEPLOY_LANDING_FTP_PATH`
- **Dependencies**: `tauri-apps/tauri-action@v0` (GitHub Action), Linux system deps (`libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, etc.)
- **Existing CI**: `ci.yml` (lint/test) unaffected; disabled `release.yml` to be replaced by new `publish.yml`; `sbom.yml` can be integrated or triggered after publish
