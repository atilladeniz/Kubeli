## ADDED Requirements

### Requirement: Full CI release triggered by tag push

The publish workflow SHALL trigger on `push: tags: ['v*']`. When a version tag is pushed, CI SHALL build all platforms, create a GitHub Release, deploy to FTP, and publish — with no local builds required.

#### Scenario: Tag push triggers full pipeline

- **WHEN** the developer pushes a tag matching `v*` (e.g., `v0.3.52`)
- **THEN** CI creates a draft release, builds macOS (aarch64 + x86_64), Windows, and Linux in parallel, uploads artifacts, deploys to FTP, and publishes the release

#### Scenario: Non-tag push ignored

- **WHEN** a regular commit is pushed without a tag
- **THEN** the publish workflow SHALL NOT trigger

### Requirement: Local workflow reduced to commit and tag

The developer's local release workflow SHALL consist of only:
1. `make version-bump` (bumps package.json, Cargo.toml, tauri.conf.json)
2. `make generate-changelog` (Claude CLI generates changelog entries)
3. Commit with `chore(release): bump version to {version} and update changelog`
4. `git push && git tag v{version} && git push --tags`

No local builds, no FTP uploads, no GitHub Release creation required.

#### Scenario: Developer releases with make release

- **WHEN** the developer runs `make release` (which chains all local steps)
- **THEN** version is bumped, changelog is generated, changes are committed, tag is pushed, and CI takes over

### Requirement: Release orchestration sequence

The end-to-end release flow SHALL follow this sequence:

1. Developer: `make version-bump`
2. Developer: `make generate-changelog`
3. Developer: commit + `git push` + `git tag v{version}` + `git push --tags`
4. CI: `publish.yml` triggers on tag push
5. CI: Creates draft GitHub Release with changelog
6. CI: Builds macOS (aarch64 + x86_64), Windows, Linux in parallel
7. CI: Each build uploads artifacts + merges GitHub `latest.json` on the release
8. CI: Finalize assembles FTP `latest.json`, deploys to FTP
9. CI: Publishes (undrafts) the release

#### Scenario: Happy path end-to-end

- **WHEN** the developer completes steps 1-3 and CI completes steps 4-9
- **THEN** a published GitHub Release exists with all platform artifacts, both `latest.json` files are live, landing page files are updated

#### Scenario: CI failure

- **WHEN** CI fails during any step
- **THEN** the draft release remains with whatever artifacts were uploaded, and the developer can re-trigger via `workflow_dispatch`

### Requirement: Manual workflow dispatch as fallback

The publish workflow SHALL support `workflow_dispatch` as an additional trigger for re-runs and manual releases.

#### Scenario: Manual re-trigger after failure

- **WHEN** the developer triggers the workflow manually via GitHub Actions UI
- **THEN** the workflow runs the same pipeline, overwriting any partial artifacts from the failed run

### Requirement: Makefile simplified for CI-only flow

The Makefile SHALL provide a `make release` target that chains: version-bump → generate-changelog → commit → tag → push. The current `make build-deploy` SHALL be renamed to `make build-deploy-legacy` for transition.

#### Scenario: make release

- **WHEN** the developer runs `make release`
- **THEN** version is bumped, changelog is generated, a release commit is created, and a `v{version}` tag is pushed — triggering CI

### Requirement: Disabled release.yml replaced

The existing `.github/workflows/release.yml` SHALL be deleted and replaced by `.github/workflows/publish.yml`.

#### Scenario: Clean workflow directory

- **WHEN** the publish workflow is implemented
- **THEN** `release.yml` no longer exists and `publish.yml` is the sole release workflow
