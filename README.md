<p align="center">
  <img src=".assets/preview.png" alt="Kubeli - The K8S viewer you deserve" />
</p>

<p align="center">
  <a href="https://github.com/atilladeniz/Kubeli/actions/workflows/ci.yml"><img src="https://github.com/atilladeniz/Kubeli/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/atilladeniz/Kubeli/releases/latest"><img src="https://img.shields.io/github/v/release/atilladeniz/Kubeli" alt="Release"></a>
  <a href="https://github.com/atilladeniz/Kubeli/blob/main/LICENSE"><img src="https://img.shields.io/github/license/atilladeniz/Kubeli" alt="License"></a>
  <img src="https://img.shields.io/badge/platform-macOS-blue" alt="Platform">
  <a href="https://github.com/atilladeniz/Kubeli/releases"><img src="https://img.shields.io/github/downloads/atilladeniz/Kubeli/total" alt="Downloads"></a>
</p>

# Kubeli

A modern, beautiful Kubernetes management desktop application with real-time monitoring, terminal access, and a polished user experience.

## Features

- **Multi-Cluster Support** - Connect to multiple clusters, auto-detect provider type (Minikube, EKS, GKE, AKS)
- **Real-Time Updates** - WebSocket-based pod watching with efficient Kubernetes watch API
- **Resource Browser** - View and manage Pods, Deployments, Services, ConfigMaps, Secrets, Nodes, and more
- **Pod Logs** - Stream logs in real-time with filtering, search, and export
- **Terminal Access** - Interactive shell access to running containers via XTerm.js
- **Port Forwarding** - Forward ports from pods/services to localhost with status tracking
- **Metrics Dashboard** - CPU and memory usage visualization (requires metrics-server)
- **YAML Editor** - Full Monaco editor integration for viewing and editing resources
- **AI Assistant** - Integrated AI support with Claude Code CLI and OpenAI Codex CLI
- **MCP Server** - Model Context Protocol server for IDE integration (VS Code, Cursor, Claude Code)
- **Helm Releases** - View and manage Helm deployments
- **Proxy Support** - HTTP/HTTPS/SOCKS5 proxy configuration for corporate environments
- **Internationalization** - English and German language support
- **Dark/Light Mode** - Theme support with vibrancy effects

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Desktop | Tauri 2.0 (Rust) |
| K8s Client | kube-rs with k8s-openapi v1.32 |
| State | Zustand |
| UI Components | Radix UI, Lucide Icons |
| Editor | Monaco Editor |
| Terminal | XTerm.js |
| Charts | Recharts |

## Installation

### Download

Download the latest release for your platform from the [Releases](https://github.com/atilladeniz/kubeli/releases) page.

### Build from Source

**Prerequisites:**
- Node.js 18+
- Rust 1.70+
- pnpm (recommended) or npm

```bash
# Clone the repository
git clone https://github.com/atilladeniz/kubeli.git
cd kubeli

# Install dependencies
make install

# Run in development mode
make dev

# Build for production
make build
```

## Development

```bash
# Start Tauri + Next.js dev environment
make dev

# Start Next.js only (no Tauri)
make web-dev

# Run linting
make lint

# Format code
make format

# Type check
make check
```

## Supported Kubernetes Providers

| Provider | Detection | Icon |
|----------|-----------|------|
| Minikube | Context name | Yes |
| AWS EKS | Context/URL pattern | Yes |
| Google GKE | Context/URL pattern | Yes |
| Azure AKS | Context/URL pattern | Yes |
| Generic K8s | Fallback | Yes |

## Project Structure

```
kubeli/
├── src/                    # Next.js frontend
│   ├── app/                # App Router pages
│   ├── components/         # React components
│   │   ├── features/       # Dashboard, Resources, Logs, Terminal
│   │   ├── layout/         # Sidebar, Titlebar
│   │   └── ui/             # Radix UI components
│   └── lib/
│       ├── hooks/          # useK8sResources, useLogs, useShell, etc.
│       ├── stores/         # Zustand stores
│       ├── tauri/          # Tauri command bindings
│       └── types/          # TypeScript definitions
├── src-tauri/              # Tauri/Rust backend
│   └── src/
│       ├── commands/       # clusters, resources, logs, shell, portforward
│       └── k8s/            # KubeClientManager, config parsing
└── Makefile                # Development shortcuts
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed list of changes.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

Created by [Atilla Deniz](https://atilladeniz.com)
