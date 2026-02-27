
# Kubeli - Kubernetes Management Desktop App

## Project Overview

Kubeli is a modern Kubernetes management desktop application built with:
- **Frontend**: Vite + React 19
- **Desktop**: Tauri 2.9 (Rust backend)
- **State**: Zustand
- **Styling**: Tailwind CSS
- **K8s Client**: kube-rs (Rust)

## Quick Start

```bash
# Development (Tauri + Vite)
make dev

# Web only development
make web-dev

# Production build
make build
```

## Development Commands

### Using Make (Recommended)

| Command | Description |
|---------|-------------|
| `make dev` | Start Tauri development environment |
| `make web-dev` | Start Vite only (no Tauri) |
| `make build` | Build production Tauri app (macOS) |
| `make build-windows` | Cross-compile Windows NSIS installer from macOS |
| `make build-all` | Build both macOS and Windows installers |
| `make lint` | Run ESLint |
| `make format` | Format code with Prettier |
| `make check` | Run TypeScript type checking |
| `make rust-check` | Check Rust code |
| `make rust-fmt` | Format Rust code |
| `make clean` | Clean build artifacts |
| `make install` | Install all dependencies |
| `make help` | Show all available commands |

### Release & Deploy

| Command | Description |
|---------|-------------|
| `make build-deploy` | Build, deploy, and create GitHub release |
| `make deploy` | Deploy update files to FTP (macOS + Windows) |
| `make deploy-web` | Deploy installers to landing page |
| `make github-release` | Create GitHub release with DMG + EXE |

### Using npm

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run tauri:dev` | Start Tauri dev environment |
| `npm run tauri:build` | Build Tauri app |
| `npm run build` | Build Vite app |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript checking |

### Rust (src-tauri)

```bash
cd src-tauri
cargo check      # Check for errors
cargo build      # Build
cargo test       # Run tests
cargo fmt        # Format code
cargo clippy     # Lint
```

## Project Structure

```
Kubeli/
├── src/                    # Vite frontend
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/         # React components
│   └── lib/
│       ├── stores/         # Zustand stores
│       ├── tauri/          # Tauri command bindings
│       └── types/          # TypeScript types
├── src-tauri/              # Tauri/Rust backend
│   └── src/
│       ├── commands/       # Tauri command handlers
│       └── k8s/            # Kubernetes client logic
└── Makefile                # Development shortcuts
```

## Architecture

### Frontend (TypeScript/React)
- **Zustand stores** manage application state
- **Tauri commands** are invoked via `@/lib/tauri/commands.ts`
- **Types** are shared between frontend and backend

### Backend (Rust)
- **AppState** holds the thread-safe KubeClientManager
- **KubeConfig** parses kubeconfig files
- **Commands** expose functionality to frontend

## Local Kubernetes Testing

```bash
# Start minikube with addons and sample resources
make minikube-start

# Check status (includes sample resource count)
make minikube-status

# Apply/refresh sample resources manually
make minikube-setup-samples

# Remove sample resources
make minikube-clean-samples

# List resources
make k8s-pods
make k8s-services
make k8s-namespaces
```

### Sample Resources (kubeli-demo namespace)

The `make minikube-start` command automatically creates sample Kubernetes resources:

| Resource Type | Count | Names |
|--------------|-------|-------|
| Deployments | 4 | demo-web, demo-api, demo-frontend, demo-auth |
| StatefulSets | 1 | demo-db |
| DaemonSets | 1 | demo-log-collector |
| Jobs | 1 | demo-migration |
| CronJobs | 1 | demo-cleanup |
| Ingresses | 2 | demo-web-ingress, demo-secure-ingress |
| NetworkPolicies | 4 | deny, allow-web, allow-api, allow-dns |
| HPAs | 2 | demo-web-hpa, demo-api-hpa (v2) |
| PDBs | 2 | demo-web-pdb, demo-api-pdb |
| PVs | 10 | demo-pv-100mi to demo-pv-256gi |
| Roles | 2 | pod-manager, deployment-manager |
| ResourceQuotas | 1 | demo-quota |
| LimitRanges | 1 | demo-limit-range |

Sample manifests are located in `.dev/k8s-samples/`.

## Windows Development

### Building for Windows (from macOS)

```bash
# Install cross-compile dependencies (one-time)
make install-windows-build-deps

# Build Windows NSIS installer
make build-windows

# Build both macOS and Windows
make build-all
```

Output: `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/Kubeli_*_x64-setup.exe`

### Windows VM Testing

For testing in Windows VMs (UTM, VirtualBox) without nested virtualization:

```bash
# On Mac: Expose minikube API
make minikube-serve

# On Windows: Connect to Mac's minikube
.\connect-minikube.ps1 -HostIP <mac-ip>
```

See `.dev/windows/WINDOWS-SETUP.md` for full documentation.

## Platform Detection

Use the `usePlatform` hook for OS-specific behavior:

```typescript
import { usePlatform } from "@/lib/hooks/usePlatform";

function MyComponent() {
  const { isMac, isWindows, modKeySymbol } = usePlatform();

  // modKeySymbol: "⌘" on Mac, "Ctrl+" on Windows
  return <Kbd>{modKeySymbol}S</Kbd>;
}
```

Available properties:
- `platform`: "macos" | "windows" | "linux" | "unknown"
- `isMac`, `isWindows`, `isLinux`: boolean helpers
- `modKey`: "⌘" or "Ctrl"
- `modKeySymbol`: "⌘" or "Ctrl+" (with plus for clarity)
- `altKey`, `shiftKey`: OS-specific symbols

## Key Files

- `src/lib/stores/cluster-store.ts` - Cluster state management
- `src/lib/tauri/commands.ts` - Tauri command bindings
- `src-tauri/src/commands/clusters.rs` - Cluster command handlers
- `src-tauri/src/k8s/client.rs` - Kubernetes client manager
- `src-tauri/src/k8s/config.rs` - Kubeconfig parsing

## Code Quality Skills

This project includes custom Claude skills for code quality based on industry best practices.

### Available Skills

| Skill | Purpose | Usage |
|-------|---------|-------|
| `/software-design-review` | Analyzes code against 15 Ousterhout principles | `/software-design-review src/lib/stores/cluster-store.ts` |
| `/refactor` | Strategic refactoring with safety-first approach | `/refactor src/lib/stores/cluster-store.ts` |

### `/software-design-review` (Analysis)

Based on John Ousterhout's "A Philosophy of Software Design". Checks for:

- Module Depth (Deep vs. Shallow)
- Information Hiding & Leaks
- Generalization vs. Specialization
- Error Handling (Define errors away)
- Consistency & Obviousness
- Strategic vs. Tactical Programming

### `/refactor` (Action)

Combines Ousterhout principles with Clean Code (Robert Martin) smells. Includes:

- **Phase 1-2**: Analysis + Safety checklist (tests, git state)
- **Phase 3**: Clean Code smells (F1-F4, G1-G36, N1-N7, T1-T9)
- **Phase 4**: Stack-specific patterns (Vite/React, Zustand, Tauri/Rust)
- **Phase 5-6**: Workflow + Prioritization

Key rules enforced:
- Functions: Small, one task, max 3 args
- Law of Demeter: No train wrecks (`a.b().c().d()`)
- DRY: No duplication
- F.I.R.S.T.: Fast, Independent, Repeatable, Self-validating, Timely tests
- Boy Scout Rule: Leave code cleaner than you found it

---

## Git Commit Guidelines

**IMPORTANT: Do NOT add the following to commit messages:**
- No "Generated with Claude Code" text
- No "Co-Authored-By: Claude" lines
- No emojis in commit messages
- Keep commit messages clean and concise

## Resource Diagram (React Flow)

Visual resource diagram showing Kubernetes resources as nested sub-flows.

### Architecture

```
Namespace (GroupNode)
  └── Deployment (GroupNode)
        └── Pod (ResourceNode)
```

### Key Files

| File | Description |
|------|-------------|
| `src/components/features/visualization/ResourceDiagram.tsx` | Main diagram component |
| `src/components/features/visualization/nodes/GroupNode.tsx` | Namespace/Deployment container node |
| `src/components/features/visualization/nodes/ResourceNode.tsx` | Pod/resource node |
| `src/components/features/visualization/nodes/DotNode.tsx` | Minimal node for low LOD |
| `src/lib/workers/layout-worker.ts` | ELK.js layout calculation |
| `src/lib/hooks/useLayout.ts` | Layout hook with Web Worker |
| `src/lib/stores/diagram-store.ts` | Diagram state (Zustand) |

### Design Decisions

1. **No Edges**: Visual grouping via React Flow sub-flows (nested nodes) instead of edge connections
2. **Labeled Group Nodes**: GroupNode uses "Labeled Group Node" style with label in top-left corner
3. **No Resize**: Group nodes are not resizable - sizes calculated by ELK layout
4. **No Automatic fitView**: Prevents jarring zoom animations on navigation/refresh
5. **Cached translateExtent**: Panning limits cached to prevent viewport jumps during refresh
6. **Position Validation**: Nodes only shown after layout calculation with valid positions

### Viewport Behavior

- **defaultViewport**: `{ x: 50, y: 50, zoom: 0.55 }` - stable starting point
- **No fitView on navigation**: Component uses defaultViewport when mounted
- **No fitView on refresh**: Keeps current viewport position
- **translateExtent**: Limits panning to node bounds + 500px padding

### LOD (Level of Detail)

Based on zoom level:
- `zoom >= 0.8`: High LOD (full ResourceNode)
- `zoom >= 0.4`: Medium LOD
- `zoom < 0.4`: Low LOD (DotNode)

### Preventing Flicker/Shifting

Key patterns to prevent visual issues during data refresh:

1. **Don't reset layoutCalculated immediately** - Keep old nodes visible
2. **Check for valid positions** before updating React Flow nodes
3. **Cache translateExtent** - Use last valid extent during refresh
4. **Position validation**: `(node.position.x !== 0 || node.position.y !== 0)`

### Dependencies

- `@xyflow/react` - React Flow v12
- `elkjs` - ELK layout algorithm (via Web Worker)
