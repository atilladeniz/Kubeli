# Tasks: Security Scanning

## 1. Trivy

- [x] 1.1 Add Trivy config (`trivy.yaml`, `trivy-secret.yaml`)
- [x] 1.2 Add GitHub Actions job for SBOM-based vulnerability scanning
- [x] 1.3 Add secret and misconfiguration scanning
- [x] 1.4 SARIF upload to GitHub Security tab

## 2. Semgrep

- [x] 2.1 Add Semgrep config (`.semgrep.yaml`) with TypeScript and Rust rules
- [x] 2.2 Add GitHub Actions job using native `semgrep/semgrep` image (not deprecated action)
- [x] 2.3 SARIF upload to GitHub Security tab

## 3. Local Development

- [x] 3.1 `make security-scan` - Run all scans
- [x] 3.2 `make security-trivy` - Vulnerability + secret scanning
- [x] 3.3 `make security-semgrep` - SAST scanning

## 4. Documentation

- [x] 4.1 Security Scanning section in README
- [x] 4.2 Configuration files documented
