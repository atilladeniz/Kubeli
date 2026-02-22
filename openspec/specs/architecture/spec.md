# Architecture Specification

## Purpose
Define the overall system architecture for Kubeli - a modern Kubernetes management desktop application built with Tauri and Vite/React.

## Requirements

### Requirement: Desktop Application Architecture
The system SHALL be built as a native desktop application using Tauri with a Vite/React frontend.

#### Scenario: Cross-platform support
- GIVEN the application is built
- WHEN distributed to users
- THEN it runs natively on macOS, Linux, and Windows

#### Scenario: Lightweight footprint
- GIVEN the application is running
- WHEN measuring resource usage
- THEN memory usage is < 150MB idle, < 300MB active
- AND CPU usage is < 2% when idle

### Requirement: Frontend Stack
The system SHALL use Vite 7+ with React 19+ for the frontend.

#### Scenario: Static export
- GIVEN Vite is configured
- WHEN building for Tauri
- THEN output is static HTML/JS/CSS in the `dist` directory

#### Scenario: TypeScript
- GIVEN source code is written
- WHEN compiling
- THEN TypeScript 5.x strict mode is enforced

### Requirement: Backend Stack
The system SHALL use Rust with Tauri 2.9+ for the backend.

#### Scenario: Kubernetes client
- GIVEN the backend needs K8s access
- WHEN making API calls
- THEN kube-rs library handles all Kubernetes operations

#### Scenario: Async runtime
- GIVEN I/O operations are needed
- WHEN processing requests
- THEN Tokio handles async operations efficiently

### Requirement: IPC Communication
The system SHALL use Tauri IPC for frontend-backend communication.

#### Scenario: Command invocation
- GIVEN the frontend needs data
- WHEN invoking a Tauri command
- THEN the Rust backend processes and returns results

#### Scenario: Event streaming
- GIVEN real-time updates are needed
- WHEN watching resources or streaming logs
- THEN Tauri events push data to the frontend

### Requirement: State Management
The system SHALL manage application state efficiently.

#### Scenario: Global state
- GIVEN application-wide state is needed
- WHEN managing clusters and settings
- THEN Zustand or React Context handles global state

#### Scenario: Server state
- GIVEN Kubernetes data needs caching
- WHEN fetching resources
- THEN Zustand stores and feature hooks manage caching and synchronization

## Technology Stack

### Frontend
- Vite 7.x
- React 19.x
- TypeScript 5.x
- Zustand (global state)
- Custom feature hooks + cache stores (server-state access pattern)
- Tailwind CSS (styling)
- lucide-react (icons)

### Backend (Rust)
- tauri 2.9.x
- kube 3.x
- tokio 1.49.x
- serde 1.0.219
- reqwest 0.12.22

### Tauri Plugins
- tauri-plugin-fs
- tauri-plugin-dialog
- tauri-plugin-shell
- tauri-plugin-store
- tauri-plugin-updater
- tauri-plugin-window-state
- tauri-plugin-deep-link
- tauri-plugin-log
- tauri-plugin-os
- tauri-plugin-opener
- tauri-plugin-process

## Directory Structure

### Frontend
```
src/
├── App.tsx
├── main.tsx
├── components/
│   ├── ui/
│   ├── layout/
│   └── features/
├── lib/
│   ├── tauri/
│   ├── hooks/
│   ├── stores/
│   ├── utils/
│   └── types/
├── i18n/
└── app/                      # global styles/tests
```

### Backend
```
src-tauri/
├── src/
│   ├── main.rs
│   ├── commands/
│   │   ├── clusters.rs
│   │   ├── resources.rs
│   │   ├── logs.rs
│   │   ├── shell.rs
│   │   ├── helm.rs
│   │   ├── flux.rs
│   │   ├── portforward.rs
│   │   ├── watch.rs
│   │   └── network.rs
│   ├── ai/
│   ├── mcp/
│   ├── k8s/
│   │   ├── client.rs
│   │   ├── config.rs
│   │   └── mod.rs
│   └── network/
├── Cargo.toml
└── tauri.conf.json
```

## Performance Requirements

| Metric | Target |
|--------|--------|
| Application startup | < 2 seconds |
| Resource list load | < 1 second (100 pods) |
| Log streaming latency | < 500ms |
| Memory (idle) | < 150 MB |
| Memory (active) | < 300 MB |
| CPU (idle) | < 2% |
| Bundle size | < 50 MB |

## Security Requirements

### Requirement: Credential Security
The system MUST secure all cluster credentials.

#### Scenario: Keychain storage
- GIVEN credentials are provided
- WHEN storing them
- THEN OS keychain is used (Keychain/Secret Service/Credential Manager)

#### Scenario: TLS enforcement
- GIVEN cluster connections are made
- WHEN communicating with API server
- THEN TLS 1.2+ is required

### Requirement: Update Security
The system MUST verify update authenticity.

#### Scenario: Signed updates
- GIVEN an update is available
- WHEN downloading
- THEN signature is verified before installation
