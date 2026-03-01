## ADDED Requirements

### Requirement: Local release command builds macOS and creates draft release

The Makefile SHALL provide a `make release` target (or simplified `make build-deploy`) that performs the local portion of the release: build macOS app (signed), create a git tag `v{version}`, push the tag, and create a draft GitHub Release with macOS artifacts attached (`.dmg`, `.app.tar.gz`, `.app.tar.gz.sig`).

#### Scenario: Full local release flow

- **WHEN** the developer runs `make release` (or `make build-deploy`) after version bump and changelog generation
- **THEN** the system builds macOS, creates and pushes a `v{version}` tag, and creates a draft GitHub Release with macOS `.dmg`, `.app.tar.gz`, and `.app.tar.gz.sig` attached

#### Scenario: Version already tagged

- **WHEN** the developer runs the release command and tag `v{version}` already exists
- **THEN** the system updates the existing draft release and uploads (clobber) the macOS artifacts

### Requirement: Changelog generated locally before release commit

The developer SHALL generate the changelog using `scripts/generate-changelog.js` (Claude CLI) before creating the release commit. The changelog SHALL be committed to `CHANGELOG.md` and `web/src/pages/changelog.mdx` as part of the release commit with message format `chore(release): bump version to {version} and update changelog`.

#### Scenario: Changelog commit created

- **WHEN** the developer runs changelog generation after version bump
- **THEN** `CHANGELOG.md` and `changelog.mdx` are updated with the new version section, and `.release-notes.md` is written for the GitHub release

#### Scenario: CI extracts changelog from committed file

- **WHEN** the CI finalize job runs on the tagged commit
- **THEN** CI reads `CHANGELOG.md` from that commit and extracts the section for the current version to use as release notes

### Requirement: Release orchestration sequence

The end-to-end release flow SHALL follow this exact sequence:

1. Developer: `make version-bump` (bumps `package.json`, `Cargo.toml`, `tauri.conf.json`)
2. Developer: `make generate-changelog` (Claude CLI generates changelog entries)
3. Developer: commits with `chore(release): bump version to {version} and update changelog`
4. Developer: `make build` (macOS build + sign)
5. Developer: `git push && git tag v{version} && git push --tags`
6. Developer: `make github-release` (creates draft release with macOS artifacts)
7. CI: `publish.yml` triggers on `release: created`
8. CI: Builds Windows + Linux in parallel
9. CI: Uploads Win/Linux artifacts to the release
10. CI: Extracts changelog, assembles `latest.json`, deploys to FTP
11. CI: Publishes (undrafts) the release

#### Scenario: Happy path end-to-end

- **WHEN** the developer completes steps 1-6 and CI completes steps 7-11
- **THEN** a published GitHub Release exists with all platform artifacts, `latest.json` is live on the FTP server with all platforms, landing page files are updated, and the release is visible to users

#### Scenario: CI failure does not affect local artifacts

- **WHEN** CI fails during steps 7-11 (build error, FTP failure)
- **THEN** the draft release with macOS artifacts remains intact, and the developer can re-trigger by deleting and recreating the release or using `workflow_dispatch`

### Requirement: Makefile simplified for hybrid flow

The Makefile SHALL be updated so that `make build-deploy` (or a new `make release` target) only performs the local steps: macOS build, changelog generation, git tag/push, and draft release creation. Windows cross-compilation and FTP deployment SHALL be removed from the local flow since CI handles them.

#### Scenario: Local-only build-deploy

- **WHEN** the developer runs `make build-deploy` after the CI publish workflow is active
- **THEN** only macOS is built locally, the tag is pushed, and a draft release is created — no Windows cross-compile, no FTP uploads

#### Scenario: Backward compatibility during transition

- **WHEN** the CI publish workflow is not yet validated
- **THEN** the old `make build-deploy` flow (with Windows cross-compile and FTP) SHALL remain available under a different target name (e.g., `make build-deploy-legacy`) until the transition is complete

### Requirement: Manual workflow dispatch as fallback

The publish workflow SHALL support `workflow_dispatch` as an additional trigger, allowing manual re-runs if the automatic trigger fails or if a rebuild is needed.

#### Scenario: Manual dispatch

- **WHEN** the developer triggers the workflow manually via GitHub Actions UI and provides a release tag
- **THEN** the workflow runs the same build/finalize pipeline using the specified release

#### Scenario: Re-run after failure

- **WHEN** a previous CI run failed (e.g., FTP timeout) and the developer triggers a manual re-run
- **THEN** the workflow rebuilds and re-deploys, overwriting any partial artifacts from the failed run

### Requirement: Disabled release.yml replaced

The existing `.github/workflows/release.yml` (currently disabled with `if: false` on all jobs) SHALL be deleted and replaced by the new `.github/workflows/publish.yml`.

#### Scenario: Clean workflow directory

- **WHEN** the publish workflow is implemented
- **THEN** `.github/workflows/release.yml` no longer exists, and `.github/workflows/publish.yml` is the sole release workflow
