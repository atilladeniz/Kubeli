# Tasks: SBOM Generation

## 1. Setup und Dependencies

- [x] 1.1 npm Script mit npx (keine devDependency noetig)
- [x] 1.2 Rust Tool `cargo-cyclonedx` via taiki-e/install-action

## 2. Build-Tooling Integration

- [x] 2.1 npm Script `sbom:npm` in package.json (npx @cyclonedx/cyclonedx-npm)
- [x] 2.2 Makefile Target `sbom-npm` erstellen
- [x] 2.3 Makefile Target `sbom-rust` erstellen
- [x] 2.4 Makefile Target `sbom` (kombiniert beide) erstellen
- [x] 2.5 Makefile Target `sbom-validate` (mit Docker) erstellen
- [x] 2.6 SBOM in `make build-deploy` integrieren

## 3. CI/CD Integration

- [x] 3.1 GitHub Actions Workflow (.github/workflows/sbom.yml)
- [x] 3.2 Actions v6 (checkout, setup-node)
- [x] 3.3 taiki-e/install-action fuer schnelle cargo-cyclonedx Installation
- [x] 3.4 Externe Validierung mit cyclonedx-cli (--fail-on-errors)
- [x] 3.5 SBOM-Dateien als Release Assets anhaengen

## 4. Dokumentation

- [x] 4.1 SBOM-Section in README.md (Enterprise-fokussiert)
- [x] 4.2 CycloneDX Badge im README Header
- [x] 4.3 Compliance-Frameworks dokumentiert

## 5. Validierung

- [x] 5.1 Lokale SBOM-Generierung getestet
- [x] 5.2 CycloneDX 1.5 Schema validiert (cyclonedx-cli)
- [x] 5.3 Production-only Dependencies (--omit dev, --no-build-deps)
