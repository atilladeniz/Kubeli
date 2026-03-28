## 1. SignPath Foundation Application

- [x] 1.1 Submit the completed OSSRequestForm-v4.xlsx to SignPath Foundation via their application process
- [x] 1.2 Wait for approval and receive SignPath organization credentials (API token, organization ID)
- [ ] 1.3 Configure the SignPath project: create project slug "kubeli", set up artifact configuration for NSIS `.exe` files
- [ ] 1.4 Create a signing policy "release-signing" in SignPath with manual approval for production releases

## 2. GitHub Secrets Configuration

- [ ] 2.1 Add `SIGNPATH_API_TOKEN` secret to the GitHub repository
- [ ] 2.2 Add `SIGNPATH_ORGANIZATION_ID` secret to the GitHub repository
- [ ] 2.3 Install the [SignPath GitHub App](https://github.com/apps/signpath) and grant access to `atilladeniz/Kubeli`
- [ ] 2.4 Link the predefined Trusted Build System "GitHub.com" to the organization and project in SignPath

## 3. CI/CD Pipeline Integration

- [ ] 3.1 Update `.github/workflows/publish.yml`: add a `sign-windows` job after the Windows build
- [ ] 3.2 Upload unsigned `.exe` via `actions/upload-artifact@v7` before signing
- [ ] 3.3 Use `signpath/github-action-submit-signing-request@v2` action to submit the unsigned NSIS `.exe` to SignPath
- [ ] 3.4 Configure the action with `wait-for-completion: true` and appropriate timeout (10 minutes)
- [ ] 3.5 Replace the unsigned `.exe` artifact with the signed version before upload to GitHub Release
- [ ] 3.6 Ensure the Tauri updater `.sig` file is generated from the unsigned binary (before Authenticode signing) to maintain updater compatibility
- [ ] 3.7 Add conditional logic: only run signing step when `SIGNPATH_API_TOKEN` secret is available (graceful degradation)

## 4. Code Signing Policy Page

- [ ] 4.1 Create `web/src/pages/code-signing-policy.astro` with the required policy content
- [ ] 4.2 Include: statement about SignPath Foundation signing, link to signpath.org, signature verification instructions (Properties > Digital Signatures and PowerShell `Get-AuthenticodeSignature`), link to GitHub repository
- [ ] 4.3 Add navigation link to the policy page from the footer or legal section of kubeli.dev

## 5. Documentation Updates

- [ ] 5.1 Update `CLAUDE.md` to document the SignPath signing step in the release flow section
- [ ] 5.2 Add signature verification instructions to the download section of kubeli.dev (or README)

## 6. Testing and Verification

- [ ] 6.1 Create a test release (pre-release tag) to verify the full signing pipeline
- [ ] 6.2 Download the signed `.exe` on a Windows machine and verify: no SmartScreen "Unknown Publisher" warning
- [ ] 6.3 Verify the Authenticode signature via PowerShell: `Get-AuthenticodeSignature` shows "Valid" status
- [ ] 6.4 Verify the Tauri auto-updater still works with the signed binary (dual signing coexistence)
- [ ] 6.5 Verify that macOS and Linux builds are unaffected by the changes
