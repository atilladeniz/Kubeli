# Change: Add Security Scanning in CI

## Why

Enterprise users expect automated security scans for dependencies and code to reduce risk and support compliance.

## What Changes

- Add Trivy scanning for dependencies and configuration.
- Add Semgrep scanning for code issues and secret patterns.
- Fail CI on high-severity findings and publish results.
- Document how to run scans locally.

## Impact

- Affected specs: security (new capability)
- Affected code:
  - `.github/workflows` (CI jobs)
  - Security config files (Semgrep/Trivy)
  - `README.md`
