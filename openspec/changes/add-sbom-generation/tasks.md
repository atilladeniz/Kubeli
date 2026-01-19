# Tasks: SBOM Generation

## 1. Setup und Dependencies

- [ ] 1.1 NPM Dev-Dependency `@cyclonedx/cyclonedx-npm` installieren
- [ ] 1.2 Rust Tool `cargo-cyclonedx` dokumentieren (Installation via cargo install)

## 2. Build-Tooling Integration

- [ ] 2.1 npm Script `sbom:npm` in package.json hinzufuegen
- [ ] 2.2 Makefile Target `sbom-npm` erstellen
- [ ] 2.3 Makefile Target `sbom-rust` erstellen
- [ ] 2.4 Makefile Target `sbom` (kombiniert beide) erstellen

## 3. CI/CD Integration

- [ ] 3.1 GitHub Actions Workflow fuer SBOM bei Releases erstellen
- [ ] 3.2 SBOM-Dateien als Release Assets anhaengen

## 4. Dokumentation

- [ ] 4.1 SBOM-Section in README.md hinzufuegen
- [ ] 4.2 Security/Compliance Badge oder Hinweis im README

## 5. Validierung

- [ ] 5.1 Lokale SBOM-Generierung testen
- [ ] 5.2 CycloneDX Format validieren
