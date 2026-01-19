# Change: Add SBOM (Software Bill of Materials) Generation

## Why

Enterprise und Corporate-Users erwarten SBOM-Dokumentation für:
- Security Audits (Vulnerability Tracking)
- Compliance-Anforderungen (diverse Branchen)
- Supply Chain Security (Post-Log4j Awareness)

SBOM demonstriert Projektreife und ermoeglicht professionelle Security-Reviews.

## What Changes

- Neues npm Script fuer JavaScript/npm SBOM Generation (CycloneDX)
- Neues Cargo-Kommando fuer Rust SBOM Generation
- Makefile Targets fuer einfache SBOM-Erstellung
- GitHub Actions Workflow fuer automatische SBOM bei Releases
- SBOM-Dateien werden bei jedem Release als Artifacts angehaengt
- Dokumentation im README

## Impact

- Affected specs: Neue `security` Capability
- Affected code:
  - `package.json` (neues Script)
  - `Makefile` (neue Targets)
  - `.github/workflows/` (Release Workflow)
  - `README.md` (Dokumentation)
- Output: `sbom-npm.json` und `sbom-rust.json` (CycloneDX Format)
