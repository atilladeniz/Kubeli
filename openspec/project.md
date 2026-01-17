# Project Context

## Purpose
Kubeli is a modern, lightweight, and intuitive desktop application for managing Kubernetes clusters. Built with Next.js and Tauri, it provides a native desktop experience with the power of web technologies, offering a performant and user-friendly alternative to existing Kubernetes management tools like Lens.

### Key Goals
- Create the most user-friendly Kubernetes management tool for developers and DevOps engineers
- Maintain lightweight footprint (< 150MB memory idle)
- Support multi-cluster management with real-time updates
- Provide native desktop experience on macOS, Linux, and Windows

## Tech Stack

### Frontend
- **Framework:** Next.js 14.x (App Router)
- **UI Library:** React 18.x
- **Language:** TypeScript 5.x (strict mode)
- **State Management:** Zustand (global), TanStack Query (server state)
- **Styling:** Tailwind CSS
- **Icons:** lucide-react
- **Forms:** React Hook Form

### Backend (Rust)
- **Framework:** Tauri 2.7+
- **Kubernetes Client:** kube-rs 1.1.0
- **Async Runtime:** Tokio 1.46.1
- **Serialization:** serde, serde_json, serde_yaml
- **HTTP:** reqwest, hyper

### Build & Development
- **Package Manager:** pnpm
- **Bundler:** Turbopack (Next.js)
- **Linting:** ESLint
- **Formatting:** Prettier

## Project Conventions

### Code Style
- Use TypeScript strict mode for all frontend code
- Prefer functional components with hooks
- Use named exports for components
- Follow Rust naming conventions (snake_case for functions/variables, PascalCase for types)
- Maximum line length: 100 characters

### Architecture Patterns
- **Frontend:** Feature-based folder structure under `src/components/features/`
- **Backend:** Command handlers in `src-tauri/src/commands/`
- **IPC:** All Tauri commands follow `domain:action` naming (e.g., `cluster:list`, `resource:get`)
- **State:** Zustand stores for global state, TanStack Query for server state

### Testing Strategy
- **Frontend:** Jest + React Testing Library for unit tests
- **E2E:** Playwright for end-to-end testing
- **Backend:** Rust's built-in test framework
- **Integration:** Mock Kubernetes API for testing

### Git Workflow
- Branch naming: `feature/`, `fix/`, `refactor/`
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
- Squash merge to main
- All PRs require passing CI

## Domain Context

### Kubernetes Concepts
- **Cluster:** A set of nodes running containerized workloads
- **Namespace:** Virtual cluster within a physical cluster
- **Pod:** Smallest deployable unit, contains one or more containers
- **Deployment:** Manages replica sets and rolling updates
- **Service:** Stable network endpoint for pods
- **ConfigMap/Secret:** Configuration and sensitive data storage

### Key User Workflows
1. Connect to cluster via kubeconfig import
2. Navigate resources by namespace
3. View pod logs for debugging
4. Open shell into pods for troubleshooting
5. Port-forward services for local testing
6. Scale deployments up/down

## Important Constraints

### Performance
- Application startup: < 2 seconds
- Memory (idle): < 150 MB
- Memory (active): < 300 MB
- CPU (idle): < 2%
- Bundle size: < 50 MB

### Security
- All credentials stored in OS keychain (never plain text)
- TLS 1.2+ required for cluster connections
- Code signing required for distribution
- Update signatures verified before installation

### Platform Support
- macOS 10.15+ (code signing + notarization required)
- Linux: Ubuntu 20.04+, Fedora 35+, Debian 11+
- Windows 10 (1809+) with WebView2

## External Dependencies

### Kubernetes API
- REST API for CRUD operations
- Watch API for real-time resource updates
- WebSocket for exec (shell) and log streaming
- Must respect API rate limits

### OS Integration
- macOS Keychain for credential storage
- Linux Secret Service (libsecret)
- Windows Credential Manager
- Native file dialogs via Tauri plugins

### Update Distribution
- GitHub Releases for update hosting
- Tauri updater for delta updates
- Minisign for signature verification
