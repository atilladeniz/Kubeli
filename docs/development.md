# Development

Contributor reference for Kubeli. For setup and contribution rules, see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Debug Bundle vs Dev Mode

- `make dev` runs the live Tauri dev server with hot reload (uses the dev URL).
- `make screenshot-build` creates a **bundled debug app** (`Kubeli.app`) used for deep-link screenshot automation. This is not the same as dev mode.

For automated screenshots (deep links are debug-only):

```bash
# Build bundled debug app for screenshots
make screenshot-build

# Capture all screenshots
make screenshots
```

You can override the target context:

```bash
SCREENSHOT_CONTEXT="minikube (dev)" make screenshots
```

## Testing

```bash
# Frontend unit tests
npm run test

# Backend unit tests
cd src-tauri && cargo test

# E2E smoke tests (static export + mocked IPC)
npm run test:e2e
```

`npm run test:e2e` loads environment defaults from `config/e2e.env` and injects a mocked Google Fonts response from `config/font-mocks.cjs`.

## Local Testing Lab

For testing Kubeli with simulated environments (OpenShift, EKS/GKE/AKS contexts, auth errors, scale testing), see the [Local Testing Lab documentation](../.dev/README.md). This allows you to test environment detection and error handling without cloud provider access.

```bash
# Quick examples
make minikube-setup-openshift    # OpenShift CRDs + Routes
make kubeconfig-fake-eks         # Fake EKS context
make minikube-setup-scale N=100  # Create 100 dummy pods
```

## Code Verification (Vet)

[Vet](https://github.com/imbue-ai/vet) is an AI-powered code verification tool that reviews code changes for correctness, security issues, and goal adherence. It uses your existing Claude Code subscription (no extra API keys needed).

### Quick Start

```bash
# Review all changes in current branch against main
# (auto-generates goal from commit messages if GOAL is omitted)
make vet

# Review with a specific goal
make vet GOAL="Refactor storage layer without breaking API"
```

### Use Cases

| Scenario | Command | Description |
|----------|---------|-------------|
| **Branch review** | `make vet` | Review all commits in the branch against main |
| **Goal verification** | `make vet GOAL="Add auth to API"` | Verify changes match the intended goal |
| **PR preparation** | `make vet GOAL="..."` | Self-review entire branch before opening a PR |
| **Post-refactor check** | `make vet GOAL="Refactor X without breaking Y"` | Ensure refactoring didn't introduce regressions |
| **Security review** | `make vet GOAL="Harden input validation"` | Check for security issues in new code |

### How It Works

1. Vet compares all commits in the current branch against `main` (full branch diff)
2. Sends the diff + your goal description to Claude (via Claude Code)
3. Returns a list of issues: logic errors, security problems, goal mismatches
4. Exit code `0` = no issues, `10` = issues found

### Installation

`make install` will attempt to install vet automatically (requires Python with pipx, uv, or pip). If Python is not available, vet is skipped with a warning. To install separately:

```bash
make vet-install
```

### Agent Skill

Vet is also installed as a Claude Code skill (`.claude/skills/vet/`). When using Claude Code for development, the agent will proactively run vet after code changes to catch issues early.

## Project Structure

```
kubeli/
├── src/                    # React frontend (Vite)
│   ├── app/                # App styles/tests
│   ├── components/         # React components
│   │   ├── features/       # AI, Dashboard, Home, Logs, Port Forward, Resources,
│   │   │                   # Settings, Shortcuts, Terminal, Updater, Visualization
│   │   ├── layout/         # Sidebar, Tabbar, Titlebar
│   │   └── ui/             # Radix UI components
│   └── lib/
│       ├── hooks/          # useK8sResources, useLogs, useShell, etc.
│       ├── stores/         # Zustand stores
│       ├── tauri/          # Tauri command bindings
│       └── types/          # TypeScript definitions
├── src-tauri/              # Tauri/Rust backend
│   └── src/
│       ├── commands/       # clusters, resources, logs, shell, portforward,
│       │                   # flux, helm, metrics, mcp, network, watch, etc.
│       ├── k8s/            # KubeClientManager, config parsing
│       ├── ai/             # AI assistant integration
│       └── mcp/            # MCP server
├── web/                    # Landing page (Astro)
└── Makefile                # Development shortcuts
```
