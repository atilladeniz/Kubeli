# Changelog

All notable changes to Kubeli will be documented in this file.

## [0.3.26] - 2026-02-08

- Fixed status filter chip contrast for better readability
- Fixed favorite pod navigation to be actionable

## [0.3.25] - 2026-02-07

- Added clear buttons and scoped Cmd/Ctrl+A behavior to search fields
- Fixed port-forward open icon not working in Tauri sidebar
- Fixed YAML editor cursor/selection issues and added clean copy context menu

## [0.3.24] - 2026-02-06

- Extracted MergeModeSection component for improved readability in KubeconfigTab

## [0.3.23] - 2026-02-06

- Migrated frontend from Next.js to Vite + React for improved Tauri integration and faster development builds

## [0.3.22] - 2026-02-06

- Added YAML editor UX overhaul with edit mode, search, and managedFields filtering
- Fixed pause label for Follow logs button
- Updated Next.js from 16.1.3 to 16.1.6
- Updated React and React DOM from 19.2.3 to 19.2.4
- Updated actions/upload-artifact from 4 to 6
- Removed unused streamingPaused i18n key

## [0.3.21] - 2026-02-05

- Fixed detail pane click handling, events display, content overflow, and locale formatting

## [0.3.20] - 2026-02-05

- Fixed cluster connection to use configured kubeconfig sources instead of defaults
- Fixed cross-namespace pod leaking by restarting watch when namespace changes

## [0.3.19] - 2026-02-04

- Fixed namespace selector not refreshing for newly created namespaces

## [0.3.18] - 2026-02-04

- Fixed filter labels to use proper translation keys for i18n support
- Refactored Kubernetes resource hooks with factory pattern for better maintainability

## [0.3.17] - 2026-02-03

- Added container health details to pod status display for better visibility
- Added automated screenshot capture for all views

## [0.3.16] - 2026-01-31

- Added ability to open pod logs in a new tab

## [0.3.15] - 2026-01-31

- Added kubeconfig sources management
- Added DeepWiki badge to README for enhanced user support

## [0.3.14] - 2026-01-30

- Added adaptive plus button and Cmd+T shortcut to tab bar
- Updated README with download badges for macOS and Windows

## [0.3.13] - 2026-01-30

- Simplified ShortcutsHelpDialog component

## [0.3.12] - 2026-01-29

- Refactored ResourceList and ResourceDetail into modular extracted components

## [0.3.11] - 2026-01-29

- Fixed restart dialog text to clarify it refers to restarting the app, not the computer

## [0.3.10] - 2026-01-29

- Refactored Settings panel into modular components for improved maintainability

## [0.3.9] - 2026-01-29

- Fixed mouse wheel horizontal scroll and grabbing cursor on tabs

## [0.3.8] - 2026-01-28

- Added tab navigation with drag and drop support
- Fixed test warnings by suppressing act() and console.error noise

## [0.3.7] - 2026-01-28

- Refactored LogViewer component into modular architecture
- Fixed comparison pages to reflect Windows support
- Added proposal for performance profiling via `make perf`
- Added proposal for OpenCode and Ollama AI providers

## [0.3.6] - 2026-01-28

- Refactored AI components into modular architecture with dedicated hooks, utilities, and tests

## [0.3.5] - 2026-01-27

- Added custom code quality skills for analysis and refactoring
- Refactored dashboard to modular architecture with factory pattern
- Added 42 Rust unit tests for graph, logs, and MCP modules
- Added comprehensive store tests with test coverage infrastructure
- Split CI backend into separate Lint and Unit Tests jobs
- Moved next/image mock inline to jest.setup.ts
- Removed unused taskmaster configuration

## [0.3.4] - 2026-01-26

- Updated rmcp from 0.13 to 0.14
- Updated Jest and related packages to v30
- Updated lucide-react to 0.563.0
- Updated GitHub Actions (upload-artifact v6, cache v5)
- Added CI workflow to auto-update package-lock.json for Dependabot PRs
- Fixed CI issues with Dependabot PR handling and husky errors
- Added Windows development documentation

## [0.3.3] - 2026-01-24

- Fixed AI analyze button in LogViewer being enabled when no CLI is available

## [0.3.2] - 2026-01-24

Based on the commits provided, here's the changelog entry for version 0.3.2:

- Fixed AI button being enabled when Claude CLI is not installed or authenticated

## [0.3.1] - 2026-01-24

- Fixed window vibrancy transparency on Windows for better readability

## [0.3.0] - 2026-01-24

- Added Windows build support with cross-platform improvements
- Fixed Makefile to load .env before Windows build for signing key
- Fixed build-deploy to build all platforms

## [0.2.43] - 2026-01-24

- Improved trackpad gesture handling for Mac in resource diagram

## [0.2.42] - 2026-01-24

- Fixed invalid template pod in scale-pods sample
- Fixed PV capacity sorting to correctly interpret storage units
- Added website SEO optimization and redesign
- Added Local Testing Lab for simulated Kubernetes environments
- Added automated tests and CI gates
- Updated Rust lint CI job for faster builds

## [0.2.41] - 2026-01-21

- Fixed auto-update check to run only once globally

## [0.2.40] - 2026-01-21

- Fixed auto-check toast stability issue by using useRef for stable toast strings

## [0.2.39] - 2026-01-21

- Fixed i18n translations for update check toast notifications
- Fixed toast display on automatic update check at startup

## [0.2.38] - 2026-01-21

- Fixed loading spinner to show only on the clicked cluster button
- Improved update check toast notification UX
- Fixed delete button icon spacing

## [0.2.37] - 2026-01-20

- Added Flux CD support for HelmReleases and Kustomizations
- Added security scanning with Trivy and Semgrep
- Added SBOM generation for enterprise compliance
- Fixed security scanning configuration and alerts
- Updated Trivy (0.68.1) and Semgrep (1.112.0) versions
- Refactored semgrep suppressions to use config-based rule exclusions

## [0.2.36] - 2026-01-19

- Added pod management enhancements in Dashboard and ResourceList components
- Added Nextra documentation website setup
- Added SBOM generation for npm and Rust dependencies
- Updated preview image in assets

## [0.2.35] - 2026-01-19

- Enhanced resource deletion functionality in ResourceDetail component

## [0.2.34] - 2026-01-19

- Added pod row click handler in Dashboard component
- Fixed DMG download URL to point to GitHub releases
- Updated build-deploy target in Makefile

## [0.2.33] - 2026-01-18

- Added batch log stream updates for improved performance
- Fixed pod watch lifecycle stability
- Updated CI to disable macOS build job
- Added TaskMaster data for project management

## [0.2.32] - 2026-01-17

- Fixed chrono imports in main.rs for macOS app menu functionality

## [0.2.31] - 2026-01-17

- Updated `kube` Rust dependency from 1.1 to 3.0

## [0.2.30] - 2026-01-17

- Added automatic changelog generation with Claude Code CLI
- Fixed copyright year to 2026 in settings and configuration files

## [0.2.29] - 2026-01-17

- Fixed dependency compatibility issues after Dependabot updates
- Updated reqwest from 0.12 to 0.13
- Updated toml from 0.8 to 0.9
- Updated k8s-openapi from 0.25 to 0.27
- Updated rusqlite from 0.32 to 0.38
- Updated tungstenite from 0.26 to 0.28
- Updated rand from 0.8 to 0.9
- Updated jsonpath-rust from 0.7 to 1.0
- Updated GitHub Actions (checkout v6, setup-node v6, github-script v8)
- Added CODE_OF_CONDUCT, SECURITY policy, and README badges
- Added automatic GitHub release to build-deploy workflow

## [0.2.28] - 2026-01-17

- Added **Pre-commit hooks** with Husky and lint-staged for automatic code formatting
- ESLint auto-fix for TypeScript/JavaScript files on commit
- Cargo fmt for Rust files on commit
- Updated all npm dependencies to latest versions
- Improved CI/CD workflow with proper Linux dependencies
- Fixed all Clippy warnings in Rust codebase
- Fixed environment variable loading for values with spaces

## [0.2.25] - 2026-01-17

- Added **MCP Server** (Model Context Protocol) for IDE integration
- One-click installation for Claude Code, Codex, VS Code, and Cursor
- Example prompts dialog with copy functionality for MCP usage
- Automatic dev/production path detection for MCP configuration

## [0.2.24] - 2025-01-16

- Added complete internationalization (i18n) support with English and German translations
- All Dashboard views, table columns, and empty messages are now translatable
- Language can be changed in Settings

## [0.2.23] - 2025-01-16

- Fixed unused provider field warning in AI session management
- Session info now includes which AI provider (Claude/Codex) is being used

## [0.2.21] - 2025-01-15

- Added support for **OpenAI Codex CLI** as alternative AI provider
- Choose between Claude Code CLI or Codex CLI in Settings
- Auto-detection of available AI CLI tools

## [0.2.17] - 2025-01-14

- Configurable update check interval in Settings
- Improved Tauri readiness detection for more reliable startup

## [0.2.15] - 2025-01-14

- Improved auto-update check logic and error handling
- Enhanced settings management and UI preferences

## [0.2.8] - 2025-01-14

- Enhanced CLI path detection for various version managers (nvm, fnm, asdf, volta)
- Updated installation instructions for AI CLI setup

## [0.2.7] - 2025-01-12

- Fixed settings persistence and state rehydration
- Improved vibrancy level validation

## [0.2.5] - 2025-01-12

- Added vibrancy level settings for window blur effect (Off, Standard, High)
- New screenshots and updated homepage layout

## [0.2.4] - 2025-01-12

- Added Monaco editor for YAML viewing and editing
- Enhanced ResourceDetail component with better code display

## [0.2.3] - 2025-01-12

- Added log export functionality in LogViewer
- Enhanced LogViewer component with improved layout
- Expanded default capabilities with additional file system and dialog permissions

## [0.2.1] - 2025-01-12

- Implemented deployment scaling feature
- Enhanced proxy type selection and PATH handling
- Improved port forward browser settings

## [0.2.0] - 2025-01-12

- New landing page built with Astro framework
- Major version bump with stabilized features

## [0.1.x] - 2025-01-01

- AI session history UI for conversations
- Session persistence with SQLite storage
- Permission system for AI tool executions
- Delete confirmation dialogs

## [0.0.x] - 2024-12-30

- AI Assistant with Claude CLI integration
- Proxy support for corporate environments
- Enhanced log viewer with advanced features
- Resource favorites and quick access
- Helm Releases management
- Auto-reconnect and connection health monitoring
- Access Control and Administration resources
- Extended resources (Networking, Configuration, Storage)
- Workloads Overview dashboard
- Extended workload resources (ReplicaSets, DaemonSets, StatefulSets, Jobs, CronJobs)
- Events and Leases cluster resource views

## [0.0.1] - 2024-12-20

### Initial Release

- Multi-cluster Kubernetes management
- Real-time pod watching with Kubernetes watch API
- Resource browser for core Kubernetes resources
- Pod log streaming with filtering and search
- Interactive terminal access to containers
- Port forwarding with status tracking
- Metrics dashboard (CPU/memory visualization)
- Keyboard shortcuts and filter system
- Bulk actions for resources
- Rainbow color coding for namespaces and deployments
- Update notification system
- Port forward browser dialog
- Visual Resource Diagram with React Flow
