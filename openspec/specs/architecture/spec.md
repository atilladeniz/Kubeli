# Architecture Specification

## Purpose
Define the overall system architecture for Kubeli - a modern Kubernetes management desktop application built with Tauri and Next.js.

## Requirements

### Requirement: Desktop Application Architecture
The system SHALL be built as a native desktop application using Tauri with Next.js frontend.

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
The system SHALL use Next.js 14+ with React 18+ for the frontend.

#### Scenario: Static export
- GIVEN Next.js is configured
- WHEN building for Tauri
- THEN output is static HTML/JS/CSS in the `out` directory

#### Scenario: TypeScript
- GIVEN source code is written
- WHEN compiling
- THEN TypeScript 5.x strict mode is enforced

### Requirement: Backend Stack
The system SHALL use Rust with Tauri 2.7+ for the backend.

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
- THEN TanStack Query manages caching and synchronization

## Technology Stack

### Frontend
- Next.js 14.x (App Router)
- React 18.x
- TypeScript 5.x
- Zustand (global state)
- TanStack Query (server state)
- Tailwind CSS (styling)
- lucide-react (icons)

### Backend (Rust)
- tauri 2.7.0
- kube 1.1.0
- tokio 1.46.1
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

## Directory Structure

### Frontend
```
src/
├── app/                      # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx
│   ├── clusters/
│   ├── resources/
│   ├── logs/
│   ├── shell/
│   └── settings/
├── components/
│   ├── ui/
│   ├── kubernetes/
│   ├── layout/
│   └── features/
├── lib/
│   ├── tauri/
│   ├── hooks/
│   ├── utils/
│   └── types/
└── styles/
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
│   │   └── portforward.rs
│   ├── k8s/
│   │   ├── client.rs
│   │   ├── config.rs
│   │   ├── watch.rs
│   │   └── stream.rs
│   ├── state.rs
│   └── error.rs
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
