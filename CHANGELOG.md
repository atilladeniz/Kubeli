# Changelog

All notable changes to Kubeli will be documented in this file.

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
