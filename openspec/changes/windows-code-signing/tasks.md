## 1. SignPath Foundation Setup

- [x] 1.1 Submit the completed OSSRequestForm-v4.xlsx to SignPath Foundation
- [x] 1.2 Receive approval and SignPath OSS organization credentials
- [x] 1.3 Configure SignPath project "Kubeli" with artifact configuration (zip-file > pe-file + msi-file > authenticode-sign)
- [x] 1.4 Create signing policy "test-signing" with test certificate
- [x] 1.5 Link Trusted Build System "GitHub.com" to the project
- [x] 1.6 Install SignPath GitHub App on `atilladeniz/Kubeli`

## 2. GitHub Secrets & CI Integration

- [x] 2.1 Add `SIGNPATH_API_TOKEN` secret to GitHub repository
- [x] 2.2 Add `SIGNPATH_ORGANIZATION_ID` secret to GitHub repository
- [x] 2.3 Add `sign-windows` job to `publish.yml` (after build, before finalize)
- [x] 2.4 Upload unsigned .exe + .msi as GitHub Actions artifact, submit to SignPath, replace in release

## 3. Test Signing (current phase)

- [ ] 3.1 Merge `feat/code-signing` branch to `main`
- [ ] 3.2 Create a test release tag (e.g. `v0.3.64`) to trigger the full pipeline
- [ ] 3.3 Verify `sign-windows` job completes successfully in GitHub Actions
- [ ] 3.4 Download signed .exe on Windows and verify test certificate via `Get-AuthenticodeSignature`
- [ ] 3.5 Verify Tauri auto-updater still works with signed binary
- [ ] 3.6 Verify macOS and Linux builds are unaffected
- [ ] 3.7 Fix any issues found and re-test if needed

## 4. Production Certificate Switch

- [ ] 4.1 Notify SignPath that test signing works — request production certificate review
- [ ] 4.2 Wait for SignPath to review setup and import production certificate (CSR PENDING → active)
- [ ] 4.3 Verify "release-signing" policy becomes VALID with production certificate
- [ ] 4.4 Update `publish.yml`: change `signing-policy-slug` from `test-signing` to `release-signing`
- [ ] 4.5 Optionally enable origin verification and approval process on the release-signing policy
- [ ] 4.6 Create a production release and verify: SmartScreen shows "SignPath Foundation" as publisher
- [ ] 4.7 Verify signature via PowerShell: `Get-AuthenticodeSignature` shows Valid + production cert

## 5. Code Signing Policy Page (required by SignPath terms)

- [ ] 5.1 Create `web/src/pages/code-signing-policy.astro` with policy content
- [ ] 5.2 Include: SignPath Foundation statement, link to signpath.org, verification instructions, link to GitHub repo
- [ ] 5.3 Add navigation link from kubeli.dev footer

## 6. Documentation

- [ ] 6.1 Update CLAUDE.md release flow section to document the signing step
- [ ] 6.2 Add signature verification instructions to kubeli.dev download section
