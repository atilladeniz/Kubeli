# security Delta Specification

## ADDED Requirements

### Requirement: Windows Code Signing Verification

The project SHALL provide documentation and tooling for users to verify the Authenticode signature of Windows binaries.

#### Scenario: Signature verification instructions

- **GIVEN** a signed Windows installer downloaded from kubeli.dev or GitHub Releases
- **WHEN** a user right-clicks the file and selects "Properties" > "Digital Signatures"
- **THEN** the signature shows "SignPath Foundation" as the signer
- **AND** the certificate chain is valid and trusted by Windows

#### Scenario: PowerShell verification

- **GIVEN** a signed Windows installer
- **WHEN** a user runs `Get-AuthenticodeSignature .\Kubeli_*_x64-setup.exe`
- **THEN** the status shows "Valid"
- **AND** the signer certificate subject contains "SignPath Foundation"
