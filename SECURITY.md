# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| < 0.2   | :x:                |

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
