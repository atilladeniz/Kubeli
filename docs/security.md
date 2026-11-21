# Security and SBOM

How Kubeli handles SBOMs and security scanning. The project overview is in the [README](../README.md).

## SBOM (Software Bill of Materials)

Kubeli provides [CycloneDX](https://cyclonedx.org/) SBOMs for supply chain security and compliance.

### What's Included

| SBOM File | Contents | Format |
|-----------|----------|--------|
| `sbom-npm.json` | Production npm dependencies | CycloneDX 1.5 JSON |
| `sbom-rust.json` | Production Rust crates | CycloneDX 1.5 JSON |

### Automatic Generation

Every [GitHub Release](https://github.com/atilladeniz/Kubeli/releases) includes validated SBOMs as downloadable assets. The CI pipeline:

1. Generates SBOMs excluding dev/build dependencies
2. Validates against CycloneDX 1.5 schema
3. Attaches to release for audit/compliance download

### Local Generation

```bash
# Generate both SBOMs
make sbom

# Generate and validate (requires Docker)
make sbom-validate
```

### Enterprise Use

These SBOMs support:
- **Vulnerability scanning** (Grype, Trivy, Snyk)
- **License compliance** audits
- **Supply chain security** (SLSA, SSDF frameworks)
- **Regulatory requirements** (FDA, EU CRA, Executive Order 14028)

## Security Scanning

Kubeli includes automated security scanning in CI and local development.

### Automated Scans (CI)

| Scanner | Purpose | Trigger |
|---------|---------|---------|
| **Trivy** | SBOM vulnerability scanning | PRs, pushes to main |
| **Trivy** | Secret & misconfiguration detection | PRs, pushes to main |
| **Semgrep** | Static code analysis (SAST) | PRs, pushes to main |

Results appear in the GitHub Security tab (requires GitHub Advanced Security for private repos).

### Local Scanning

```bash
# Run all security scans (requires Docker)
make security-scan

# Individual scans
make security-trivy    # Vulnerability + secret scanning
make security-semgrep  # Static code analysis
```

### Configuration

- `trivy.yaml` - Severity thresholds and scan settings
- `trivy-secret.yaml` - Secret detection rules
- `.semgrep.yaml` - Custom SAST rules for TypeScript and Rust
