## Context

Kubeli releases are currently built entirely on the developer's local macOS machine via `make build-deploy`, which chains: version bump → macOS build + sign → Windows cross-compile (cargo-xwin) → FTP deploy (latest.json + artifacts) → changelog generation (Claude CLI) → SBOM → Astro landing page → GitHub release creation.

This works but has key limitations:
- **No Linux builds** — cross-compilation for Linux isn't set up
- **Windows cross-compilation is fragile** — depends on cargo-xwin + LLVM toolchain on macOS
- **Non-reproducible** — no CI trail, depends on local machine state
- **Single point of failure** — only one machine can release

The constraint: **macOS must remain local** because the Apple Developer ID certificate and notarization credentials live on the developer's machine and cannot easily be exported to CI (Apple's security model ties signing identities to specific machines/keychains).

Existing CI already runs lint, test, security scanning, and SBOMs. The disabled `release.yml` shows an earlier attempt at CI builds that was never completed.

## Goals / Non-Goals

**Goals:**
- Windows and Linux built natively on GitHub Actions runners
- macOS continues to build + sign locally, artifacts uploaded to a draft GitHub Release
- CI triggered automatically when macOS artifacts appear on the draft release
- `latest.json` updater manifest assembled from all platforms and deployed to FTP
- Changelog extracted from the release commit body (already written locally before push)
- GitHub Release finalized with all platform artifacts + release notes
- Landing page installers (DMG, EXE, AppImage) deployed to FTP
- Local `make` workflow simplified to: build macOS → push commit → upload to draft release

**Non-Goals:**
- Moving macOS builds to CI (blocked by signing identity locality)
- Windows Authenticode signing (not currently done, out of scope)
- Modifying the version bump process (stays manual/local)
- Changing the Astro landing page build/deploy (separate concern)

## Decisions

### 1. Trigger: GitHub Release `created` event (draft release with macOS artifacts)

**Choice:** The publish workflow triggers on `release: [created]` when a draft release is created with the `v*` tag pattern.

**Alternatives considered:**
- **Push to `v*` tag** (Cardo, PraccJS pattern): Would require CI to also handle macOS, or a complex two-phase approach where local pushes a tag and then separately uploads macOS artifacts. Race condition between CI starting and macOS artifacts being ready.
- **`workflow_dispatch`** (Cap pattern): Fully manual, loses the automation benefit.
- **Commit message pattern match** (`chore(release):` on main): GitHub Actions can't reliably filter on commit message content in `push` triggers. Would need a "detect and tag" helper workflow, adding complexity.
- **PR label + tag** (dbcooper pattern): Over-engineered for a single-developer project.

**Rationale:** The local flow already creates a GitHub Release via `make github-release`. By making this create a **draft** release with macOS artifacts attached, CI can react to the `release: created` event, build Win/Linux, attach their artifacts, assemble `latest.json`, and publish (undraft) the release. This is the simplest approach that preserves the local macOS build while letting CI handle everything else.

**Refined local flow:**
1. `make version-bump` (manual)
2. `make build` (macOS only, signed locally)
3. Generate changelog with Claude CLI → commit `chore(release): bump version to X.Y.Z`
4. `git push` + `git tag vX.Y.Z` + `git push --tags`
5. `make github-release` → creates draft release with macOS DMG + `.app.tar.gz` + `.app.tar.gz.sig`
6. CI takes over from here

### 2. Workflow architecture: Single workflow, 3 jobs with `releaseId` direct upload

**Choice:** One `publish.yml` with jobs: `build-windows`, `build-linux`, `finalize`. Build jobs use `tauri-apps/tauri-action@v0` with `releaseId` (from the draft release) to upload artifacts directly to the GitHub Release. Additionally, `tagName` is provided alongside `releaseId` so tauri-action constructs correct GitHub download URLs in its auto-generated `latest.json`.

**Alternatives considered:**
- **Build-only mode + manual upload**: tauri-action builds without release context → artifacts uploaded via `actions/upload-artifact` → finalize job downloads and uploads to release via `gh`. More steps, more complexity.
- **Two separate workflows** (build + finalize): More files to maintain, harder to reason about.
- **Single monolithic job**: Can't parallelize Win/Linux builds.

**Rationale:** Using `releaseId` lets tauri-action upload artifacts directly to the draft release, skipping the upload-artifact/download-artifact dance. Combined with `uploadUpdaterJson: true`, tauri-action auto-generates and aggregates a GitHub-hosted `latest.json` across matrix jobs. The finalize job only needs to handle FTP deployment, changelog, and publishing.

### 3. Dual updater endpoints: FTP (primary) + GitHub Releases (fallback)

**Choice:** The Tauri updater is configured with two endpoints in `tauri.conf.json`:
1. **Primary**: `https://api.atilla.app/kubeli/updates/latest.json` (FTP-hosted, custom URLs)
2. **Fallback**: `https://github.com/atilladeniz/Kubeli/releases/latest/download/latest.json` (GitHub-hosted, auto-generated by tauri-action)

Each `latest.json` contains different download URLs pointing to its own infrastructure. Tauri's updater tries endpoints in order and falls back automatically.

**How it works:**
- **GitHub `latest.json`**: Auto-generated by `tauri-apps/tauri-action` with `uploadUpdaterJson: true` on each build job. URLs point to GitHub Release assets (e.g., `https://github.com/.../releases/download/v0.3.52/Kubeli_0.3.52_x64-setup.exe`). The action aggregates platform entries across matrix jobs automatically.
- **FTP `latest.json`**: Manually assembled in the `finalize` job with URLs pointing to the FTP server (e.g., `https://api.atilla.app/kubeli/updates/Kubeli_0.3.52_x64-setup.exe`). Uploaded via curl.

**Alternatives considered:**
- **FTP only** (current state): Single point of failure. If the FTP server is down, no updates.
- **GitHub only**: Would break the existing updater endpoint for already-deployed versions.
- **CDN proxy**: Better long-term but requires infrastructure changes.

**Rationale:** Zero-downtime redundancy with minimal effort. GitHub Releases are highly available and free. FTP remains the primary source for backward compatibility. Both `latest.json` files are generated from the same build artifacts and share the same updater signing key, so either source delivers identical, verified updates.

### 4. Updater manifest (FTP): Assembled in finalize job from all platforms

**Choice:** The `finalize` job downloads signature files from the GitHub Release, constructs an FTP-specific `latest.json` with FTP download URLs, and uploads to the FTP server via curl.

**Rationale:** The FTP `latest.json` needs URLs pointing to `https://api.atilla.app/kubeli/updates/...`, which differs from the GitHub-hosted version. Centralizing assembly in the finalize job ensures all platforms are present before deploying.

### 5. Changelog: Extracted from CHANGELOG.md in the release commit

**Choice:** CI reads `CHANGELOG.md` from the tagged commit, extracts the section for the current version, and uses it as GitHub Release notes.

**Alternatives considered:**
- **Parse commit message body**: Fragile, limited by commit message length, and the commit body format may vary.
- **Run Claude CLI in CI**: Requires Claude API key as a secret, adds cost and complexity, and the changelog should be reviewed by the developer before release.
- **Generate from git log in CI**: Loses the curated Claude-generated quality.

**Rationale:** The developer already generates the changelog locally with Claude CLI and commits it to `CHANGELOG.md` as part of the release commit. CI just needs to extract the relevant version section. This is deterministic and gives the developer full control over release notes content.

### 6. FTP deployment: curl from finalize job

**Choice:** Use `curl --ftp-create-dirs -T` for FTP uploads, same as the current Makefile approach.

**Alternatives considered:**
- **GitHub Action for FTP** (`SamKirkland/FTP-Deploy-Action`): Designed for full directory sync, not individual file uploads.
- **Replace FTP with GitHub Releases as update source**: Would require changing `tauri.conf.json` updater endpoint and the update URL format. Breaking change.
- **S3/CloudFlare R2**: Better than FTP but requires infrastructure migration.

**Rationale:** Keep the existing FTP infrastructure. The curl commands are simple and proven. FTP credentials stored as GitHub Secrets. Future migration to a better hosting solution is a separate concern.

### 7. Platform matrix

**Choice:**
- Windows: `windows-latest`, target `x86_64-pc-windows-msvc` (NSIS installer)
- Linux: `ubuntu-22.04`, target `x86_64-unknown-linux-gnu` (AppImage + deb)

**Alternatives considered:**
- **Linux ARM** (like Rivet): Low demand for a Kubernetes management desktop app on ARM Linux.
- **macOS universal binary in CI** (like Rivet): Blocked by signing identity constraint.
- **Windows ARM**: Tauri doesn't officially support Windows ARM NSIS bundles.

**Rationale:** Match the existing platform targets (Win x64 + macOS aarch64) plus add Linux x64. This covers the vast majority of the desktop user base.

### 8. Existing `release.yml` replacement

**Choice:** Delete the disabled `release.yml` and replace it with the new `publish.yml`.

**Rationale:** The existing `release.yml` has `if: false` on all jobs and was never operational. Keeping it alongside a new workflow would be confusing. Clean replacement.

## Risks / Trade-offs

**[Race condition: macOS artifacts not ready when CI triggers]**
→ Mitigation: CI triggers on `release: created` event. The local `make github-release` creates the draft release *with* macOS artifacts already attached. CI can verify macOS artifacts exist before proceeding.

**[FTP credentials in GitHub Secrets]**
→ Mitigation: Secrets are encrypted at rest and only exposed to workflow runs. This is standard practice. Consider rotating credentials after initial setup.

**[Tauri updater format changes across versions]**
→ Mitigation: Pin `tauri-apps/tauri-action@v0` and validate `latest.json` format against the existing working manifest before deploying.

**[Linux builds may have different visual behavior]**
→ Mitigation: The app already uses platform-adaptive UI patterns via `usePlatform` hook. Linux-specific issues can be addressed incrementally after the first release.

**[CI build times]**
→ Trade-off: Windows Tauri builds on GitHub Actions typically take 10-15 minutes, Linux 5-10 minutes. This is acceptable since it runs in parallel and doesn't block the developer. Rust caching via `swatinem/rust-cache` mitigates cold-start builds.

**[Dual deploy path during transition]**
→ Mitigation: Keep `make build-deploy` functional during transition. Once CI is validated, simplify the Makefile to remove Windows cross-compile and FTP deploy steps.

## Migration Plan

1. **Phase 1 — Setup**: Add GitHub Secrets, create `publish.yml`, test with a dry-run release
2. **Phase 2 — Validate**: Run one release through the new pipeline while keeping local deploy as fallback
3. **Phase 3 — Simplify**: Remove Windows cross-compile from Makefile, update `make build-deploy` to local-only flow
4. **Rollback**: If CI fails, the existing `make build-deploy` still works as-is since no local tooling is removed in Phase 1-2

## Open Questions

- Should the landing page deploy (Astro + installer FTP) also move to CI, or remain a separate manual step?
- Should `sbom.yml` be triggered as part of the publish workflow or kept as a separate workflow triggered by the release?
- Is Linux AppImage sufficient, or should we also produce `.deb` and/or `.rpm` packages?
