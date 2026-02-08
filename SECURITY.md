# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.3.x   | :white_check_mark: |
| < 0.3   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability within Kubeli, please follow these steps:

### Do NOT

- Open a public GitHub issue for security vulnerabilities
- Disclose the vulnerability publicly before it has been addressed

### Do

1. **Email**: Send a detailed report to the maintainer via GitHub (create a private security advisory)
2. **GitHub Security Advisory**: Use [GitHub's security advisory feature](https://github.com/atilladeniz/Kubeli/security/advisories/new) to report the vulnerability privately

### What to Include

Please include the following information in your report:

- Type of vulnerability (e.g., remote code execution, privilege escalation, data exposure)
- Full path to the source file(s) related to the vulnerability
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact assessment of the vulnerability

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution Target**: Within 30 days (depending on complexity)

### After Reporting

1. We will acknowledge receipt of your report
2. We will investigate and validate the vulnerability
3. We will work on a fix and coordinate disclosure
4. We will credit you in the release notes (unless you prefer to remain anonymous)

## Supply Chain Security

Kubeli employs multiple layers of automated security scanning to ensure that no bundled dependency introduces telemetry, unauthorized network traffic, or known vulnerabilities into production builds.

### Automated CI Checks

Every push and pull request is scanned by the following tools:

| Tool | What it checks |
|------|---------------|
| **Trivy** | Known CVEs in npm and Rust SBOMs, filesystem secrets, misconfigurations |
| **Semgrep** | SAST with community rulesets (TypeScript, React, Rust, secrets) and custom rules |
| **cargo-deny** | Rust crate licenses, banned crates, registry sources, RustSec advisories |
| **cargo-audit** | Rust dependencies against the RustSec Advisory Database |
| **lockfile-lint** | Validates that all npm packages are sourced from the official HTTPS registry |

Weekly scheduled scans run every Monday to catch newly disclosed advisories.

### Network Isolation (Zero Telemetry)

Kubeli is designed as a **zero-telemetry** application. The following measures enforce this:

- **Content Security Policy (CSP)**: The Tauri CSP restricts `connect-src` to `self`, `ipc:`, and `http://ipc.localhost` only. The frontend WebView cannot make any external network requests.
- **No HTTP plugin**: The Tauri HTTP plugin is not enabled. The frontend has no capability to make outbound HTTP requests.
- **Semgrep network-call rules**: Custom Semgrep rules flag any use of `fetch()`, `XMLHttpRequest`, `WebSocket`, `navigator.sendBeacon()`, or `EventSource` in frontend code as errors. References to known tracking domains (Google Analytics, Sentry, Mixpanel, etc.) are also flagged.
- **Banned Rust crates**: `cargo-deny` blocks telemetry-related crates (`sentry`, `sentry-core`, `opentelemetry`, `datadog`) from ever entering the dependency tree.
- **Source restriction**: All Rust crates must originate from crates.io. Unknown registries and Git sources are denied.

The only legitimate outbound connections from Kubeli are:

1. **Kubernetes API servers** -- user-configured, initiated by user action via the Rust backend
2. **Update check** -- `https://api.atilla.app/kubeli/updates/latest.json` via the Tauri updater plugin (signature-verified with a public key)

### SBOM (Software Bill of Materials)

CycloneDX 1.5 SBOMs are generated for both npm and Rust dependencies and attached to every GitHub release. These can be used for independent verification.

### Known Advisories in Transitive Dependencies

The following advisories affect transitive dependencies that are outside of Kubeli's direct control. They are documented here with risk assessments explaining why they do not compromise Kubeli's security posture.

#### Unmaintained crates (no known vulnerability)

| Advisory | Crate | Pulled in by | Assessment |
|----------|-------|-------------|------------|
| RUSTSEC-2025-0098 | `unic-ucd-version` | `tauri-utils` > `urlpattern` | Unmaintained, no security flaw. Used internally by Tauri for URL pattern matching. |
| RUSTSEC-2025-0081 | `unic-char-property` | `tauri-utils` > `urlpattern` | Same as above. |
| RUSTSEC-2025-0075 | `unic-char-range` | `tauri-utils` > `urlpattern` | Same as above. |
| RUSTSEC-2025-0080 | `unic-common` | `tauri-utils` > `urlpattern` | Same as above. |
| RUSTSEC-2025-0100 | `unic-ucd-ident` | `tauri-utils` > `urlpattern` | Same as above. |
| RUSTSEC-2025-0057 | `fxhash` | Tauri ecosystem | Unmaintained, no security flaw. Hash function used internally by Tauri. |

#### Vulnerabilities with limited impact

| Advisory | Crate | Severity | Pulled in by | Assessment |
|----------|-------|----------|-------------|------------|
| RUSTSEC-2026-0007 | `bytes` | Integer overflow in `BytesMut::reserve` | `hyper` / `tokio` (transitive) | Exploitation requires attacker-controlled input to `BytesMut::reserve()`. Kubeli does not call this API directly. The only data flowing through `hyper`/`tokio` originates from user-configured Kubernetes API servers. An attacker would need to compromise the K8s API server itself to exploit this, at which point the cluster is already breached. **Risk: negligible.** |
| RUSTSEC-2026-0009 | `serde_json` | DoS via stack exhaustion with deeply nested JSON | Transitive dependency | Exploitation requires processing extremely deep JSON nesting (hundreds of levels). Kubernetes API responses have well-defined, shallow schemas. Kubeli does not accept arbitrary JSON from untrusted sources. **Risk: negligible.** |

These exceptions are tracked in `src-tauri/deny.toml` and will be removed once patched versions are available upstream.

### Verification

Users and auditors are encouraged to independently verify Kubeli's network behavior:

1. **Runtime monitoring**: Use [mitmproxy](https://mitmproxy.org/), [Proxyman](https://proxyman.com/), or [Little Snitch](https://www.obdev.at/products/littlesnitch) to monitor all outbound connections from a production build.
2. **SBOM review**: Download the CycloneDX SBOMs from the GitHub release and scan them with your preferred vulnerability scanner.
3. **Build from source**: Clone the repository and run `cargo deny check` and `npx lockfile-lint --type npm --path package-lock.json --validate-https --allowed-hosts npm` to verify locally.

## Security Best Practices for Users

### Kubeconfig Security

- Kubeli reads your `~/.kube/config` file to connect to clusters
- Never share your kubeconfig files
- Use RBAC to limit permissions for service accounts

### Network Security

- Be cautious when using proxy settings with untrusted proxies
- Port forwarding exposes services to localhost - be aware of what you're exposing

### Updates

- Keep Kubeli updated to the latest version
- Enable auto-update checks in Settings

## Scope

This security policy applies to:

- The Kubeli desktop application
- The Kubeli MCP server
- Official releases and distributions

Third-party plugins, forks, or modifications are not covered by this policy.
