---
name: refactor
description: Refactors code following Ousterhout's design principles. Analyzes complexity, creates prioritized refactoring plan, and executes with safety-first approach. Optimized for Vite/React, Tauri/Rust, Zustand stack.
argument-hint: [file_or_directory_path]
---

# Strategic Refactoring Skill

You are a senior software architect performing strategic refactoring based on John Ousterhout's "A Philosophy of Software Design" principles.

**Your Goal**: Transform code to reduce complexity while maintaining functionality. Every change should make the system look like it was designed with this feature in mind from the start.

## Kubeli Tech Stack

- **Frontend**: Vite 7+, React 19, TypeScript
- **Desktop**: Tauri 2.0 (Rust backend)
- **State**: Zustand
- **Styling**: Tailwind CSS
- **K8s Client**: kube-rs (Rust)

---

## Phase 1: Analysis (Use /software-design-review principles)

Before any refactoring, analyze the code against these 15 Ousterhout principles:

1. Strategic vs. Tactical Programming
2. Module Depth (Deep vs. Shallow)
3. Somewhat General-Purpose (Generalization)
4. Different Layers, Different Abstractions
5. Information Hiding & Leaks
6. Pull Complexity Downward
7. Together or Separate?
8. Define Errors Out of Existence
9. Design Twice
10. Consistency
11. Code Should Be Obvious
12. Comments & Documentation
13. Names
14. Write Comments First
15. Modifying Existing Code

---

## Phase 2: Safety Checklist

**Before ANY refactoring:**

- [ ] Tests exist for the code being refactored
- [ ] All tests pass currently
- [ ] Code is committed (clean git state)
- [ ] You understand what the code does (read it first!)

**If tests don't exist:**

1. Write characterization tests first
2. Test the component as a black box
3. Validate end results, not implementation details

---

## Phase 3: Clean Code Smells Checklist (Robert Martin)

In addition to Ousterhout's principles, check for these code smells:

### Comments (C1-C5)

| Code | Smell | Fix |
|------|-------|-----|
| C1 | Ungeeignete Informationen (Change history, author info) | Remove, use git |
| C2 | Überholte Kommentare | Update or delete |
| C3 | Redundante Kommentare | Delete if code is self-explanatory |
| C4 | Schlecht geschriebene Kommentare | Rewrite clearly |
| C5 | Auskommentierter Code | Delete (git has history) |

### Functions (F1-F4)

| Code | Smell | Fix |
|------|-------|-----|
| F1 | Zu viele Argumente (>3) | Use object parameter |
| F2 | Output-Argumente | Return value instead |
| F3 | Flag-Argumente (boolean params) | Split into two functions |
| F4 | Tote Funktionen (never called) | Delete |

### General (G1-G36) - Most Important

| Code | Smell | Fix |
|------|-------|-----|
| G2 | Offensichtliches Verhalten fehlt | Implement expected behavior |
| G3 | Falsches Verhalten an Grenzen | Add boundary tests |
| G5 | **Duplizierung (DRY)** | Extract common code |
| G6 | Falsche Abstraktionsebene | Move to correct layer |
| G8 | Zu viele Informationen (large interface) | Hide details, minimize API |
| G9 | Toter Code | Delete |
| G10 | Vertikale Trennung (related code far apart) | Move together |
| G11 | Inkonsistenz | Follow established patterns |
| G13 | Künstliche Kopplung | Decouple unrelated code |
| G14 | **Funktionsneid (Feature Envy)** | Move method to correct class |
| G16 | Verdeckte Absicht (obscure code) | Make obvious |
| G17 | Falsche Zuständigkeit | Move to responsible module |
| G23 | If/Else statt Polymorphismus | Use polymorphism |
| G25 | **Magische Zahlen** | Named constants |
| G28 | Bedingungen nicht eingekapselt | Extract to named function |
| G29 | Negative Bedingungen | Use positive conditions |
| G30 | **Mehr als eine Aufgabe** | Split function |
| G31 | Verborgene zeitliche Kopplungen | Make dependencies explicit |
| G33 | Grenzbedingungen nicht eingekapselt | Encapsulate bounds |
| G34 | Mehrere Abstraktionsebenen gemischt | One level per function |
| G36 | **Transitive Navigation (Law of Demeter)** | Don't talk to strangers |

### Names (N1-N7)

| Code | Smell | Fix |
|------|-------|-----|
| N1 | Nicht deskriptiv | Rename to describe purpose |
| N2 | Falsche Abstraktionsebene | Match name to abstraction level |
| N4 | Nicht eindeutig | Make unambiguous |
| N5 | Zu kurz für großen Scope | Longer names for wider scope |
| N7 | Nebeneffekte nicht im Namen | Include side effects in name |

### Tests (T1-T9)

| Code | Smell | Fix |
|------|-------|-----|
| T1 | Unzureichende Tests | Add more tests |
| T3 | Triviale Tests übersprungen | Test everything |
| T5 | Grenzbedingungen nicht getestet | Add boundary tests |
| T6 | Bug-Nachbarschaft nicht getestet | Test around bugs |
| T9 | Langsame Tests | Optimize test speed |

### F.I.R.S.T. Test Principles

- **Fast**: Tests should run quickly
- **Independent**: Tests shouldn't depend on each other
- **Repeatable**: Same result every time
- **Self-Validating**: Boolean output (pass/fail)
- **Timely**: Written before/with production code

### Clean Code Function Rules

1. **Klein!** Functions should be small (ideally < 20 lines)
2. **Eine Aufgabe** - Do ONE thing and do it well
3. **Eine Abstraktionsebene** - Don't mix abstraction levels
4. **Stepdown Rule** - Read code top-down like a story
5. **Max 3 Arguments** - Prefer 0-2, use object for more

```typescript
// BEFORE: Too many args, mixed abstraction levels
async function processPod(
  namespace: string,
  name: string,
  action: string,
  force: boolean,
  gracePeriod: number,
  callback: () => void
) {
  const pod = await invoke('get_pod', { namespace, name });
  if (action === 'delete') {
    if (force) {
      await invoke('force_delete', { namespace, name });
    } else {
      await invoke('delete', { namespace, name, gracePeriod });
    }
  }
  callback();
}

// AFTER: Single purpose, one abstraction level
interface PodActionRequest {
  pod: PodRef;
  action: PodAction;
}

async function executePodAction({ pod, action }: PodActionRequest): Promise<void> {
  const handler = getPodActionHandler(action);
  await handler.execute(pod);
}
```

### Law of Demeter (G36: Transitive Navigation)

**Principle**: A method should only call methods on:
- Its own object (`this`)
- Objects passed as parameters
- Objects it creates
- Its direct component objects

```typescript
// VIOLATES Law of Demeter: "Train wreck"
const street = user.getAddress().getCity().getStreet();

// BETTER: Tell, don't ask
const street = user.getStreetAddress();

// Kubeli Example:
// BAD: Navigating through objects
const podName = store.getState().cluster.selectedPod.metadata.name;

// GOOD: Direct access with selector
const podName = useSelectedPodName();
```

### Pfadfinder-Regel (Boy Scout Rule)

**"Leave the code cleaner than you found it."**

Every time you touch code:
- Fix one small thing
- Improve one name
- Extract one function
- Add one missing test

---

## Phase 4: Stack-Specific Refactoring Patterns

### Vite/React (Frontend)

**Component Organization:**

```typescript
// BEFORE: Monolithic component with mixed concerns
export function PodList({ namespace }: Props) {
  const [pods, setPods] = useState([]);
  const [filter, setFilter] = useState('');
  useEffect(() => { fetchPods().then(setPods); }, []);
  return (
    <div>
      <input value={filter} onChange={e => setFilter(e.target.value)} />
      <ul>{pods.filter(p => p.name.includes(filter)).map(p => <PodItem pod={p} />)}</ul>
    </div>
  );
}

// AFTER: Separate data from presentation, use Zustand
// stores/resource-store.ts
export const useResourceStore = create((set) => ({
  pods: [],
  fetchPods: async (ns) => { /* ... */ },
}));

// components/PodList.tsx
export function PodList() {
  const pods = useResourceStore(s => s.pods);
  const [filter, setFilter] = useState('');
  return <ul>{pods.filter(p => p.name.includes(filter)).map(p => <PodItem pod={p} />)}</ul>;
}
```

**Anti-Patterns to Fix:**

| Smell | Refactoring |
|-------|-------------|
| Props drilling through 3+ levels | Use Zustand store or Context |
| Giant `utils.ts` file | Split into logical modules in `lib/` |
| Inline Tauri `invoke()` calls | Centralize in `lib/tauri/commands/` |
| State in components that should be global | Move to Zustand store |

---

### Zustand (State Management)

**Selective State Access:**

```typescript
// BEFORE: Re-renders on ANY state change
function PodCount() {
  const store = useClusterStore(); // BAD: subscribes to everything
  return <span>{store.pods.length}</span>;
}

// AFTER: Only re-renders when pods change
function PodCount() {
  const podCount = useClusterStore((s) => s.pods.length); // GOOD: selective
  return <span>{podCount}</span>;
}
```

**Modular Stores with Slices:**

```typescript
// BEFORE: Monolithic store
const useStore = create((set) => ({
  pods: [],
  deployments: [],
  services: [],
  selectedPod: null,
  selectedDeployment: null,
  // ... 50 more properties
}));

// AFTER: Composable slices
// stores/pods-slice.ts
export const createPodsSlice = (set, get) => ({
  pods: [],
  selectedPod: null,
  fetchPods: async (ns) => { ... },
  selectPod: (id) => set({ selectedPod: id }),
});

// stores/deployments-slice.ts
export const createDeploymentsSlice = (set, get) => ({
  deployments: [],
  fetchDeployments: async (ns) => { ... },
});

// stores/index.ts
export const useStore = create((...a) => ({
  ...createPodsSlice(...a),
  ...createDeploymentsSlice(...a),
}));
```

**Custom Hook Abstraction:**

```typescript
// BEFORE: Direct store access everywhere
function PodDetails({ id }: Props) {
  const pods = useClusterStore((s) => s.pods);
  const pod = pods.find(p => p.id === id);
  // ...
}

// AFTER: Domain-specific hooks
// hooks/usePod.ts
export function usePod(id: string) {
  return useClusterStore((s) => s.pods.find(p => p.id === id));
}

// components/PodDetails.tsx
function PodDetails({ id }: Props) {
  const pod = usePod(id);
  // ...
}
```

---

### Tauri 2.0 / Rust (Backend)

**Command Organization:**

```rust
// BEFORE: All commands in one file
// src-tauri/src/main.rs
#[tauri::command]
fn get_pods() { ... }
#[tauri::command]
fn get_deployments() { ... }
#[tauri::command]
fn get_services() { ... }
// ... 50 more commands

// AFTER: Modular command structure
// src-tauri/src/commands/mod.rs
pub mod pods;
pub mod deployments;
pub mod services;

// src-tauri/src/commands/pods.rs
#[tauri::command]
pub async fn get_pods(state: State<'_, AppState>, namespace: &str) -> Result<Vec<Pod>, Error> {
    let client = state.client_manager.get_client()?;
    client.list_pods(namespace).await
}

// src-tauri/src/main.rs
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::pods::get_pods,
            commands::pods::delete_pod,
            commands::deployments::get_deployments,
        ])
        .run(tauri::generate_context!())
        .expect("error running app");
}
```

**Separation: main.rs vs lib.rs:**

```rust
// BEFORE: Logic in main.rs
// src-tauri/src/main.rs
fn main() {
    // 500 lines of logic...
}

// AFTER: main.rs only handles startup, lib.rs has logic
// src-tauri/src/main.rs
fn main() {
    kubeli_lib::run();
}

// src-tauri/src/lib.rs
pub mod commands;
pub mod k8s;
pub mod state;

pub fn run() {
    tauri::Builder::default()
        .manage(state::AppState::new())
        .invoke_handler(tauri::generate_handler![...])
        .run(tauri::generate_context!())
        .expect("error running app");
}
```

**Rust Refactoring Patterns:**

```rust
// BEFORE: Tuple returns (hard to understand)
fn get_cluster_info() -> (String, bool, u32) {
    (context_name, is_connected, node_count)
}
let (a, b, c) = get_cluster_info(); // What is a, b, c?

// AFTER: Struct with meaningful names
struct ClusterInfo {
    context_name: String,
    is_connected: bool,
    node_count: u32,
}
fn get_cluster_info() -> ClusterInfo { ... }
let info = get_cluster_info();
println!("Connected: {}", info.is_connected);
```

```rust
// BEFORE: if-else chains
if status == "Running" { ... }
else if status == "Pending" { ... }
else if status == "Failed" { ... }

// AFTER: Pattern matching with enum
enum PodStatus { Running, Pending, Failed, Unknown }

match pod.status {
    PodStatus::Running => { ... }
    PodStatus::Pending => { ... }
    PodStatus::Failed => { ... }
    PodStatus::Unknown => { ... }
}
```

```rust
// BEFORE: Manual error handling everywhere
fn get_pod(name: &str) -> Result<Pod, Error> {
    let pods = self.list_pods()?;
    for pod in pods {
        if pod.name == name {
            return Ok(pod);
        }
    }
    Err(Error::NotFound)
}

// AFTER: Iterator methods with Option/Result
fn get_pod(&self, name: &str) -> Option<&Pod> {
    self.pods.iter().find(|p| p.name == name)
}

// Or with Result if error info needed:
fn get_pod(&self, name: &str) -> Result<&Pod, Error> {
    self.pods.iter()
        .find(|p| p.name == name)
        .ok_or_else(|| Error::PodNotFound(name.to_string()))
}
```

**Minimize Public API Surface:**

```rust
// BEFORE: Everything public
pub struct KubeClientManager {
    pub clients: HashMap<String, Client>,
    pub current_context: String,
    pub config: KubeConfig,
}

// AFTER: Minimal public API, private internals
pub struct KubeClientManager {
    clients: HashMap<String, Client>,    // private
    current_context: String,              // private
    config: KubeConfig,                   // private
}

impl KubeClientManager {
    pub fn new() -> Result<Self, Error> { ... }
    pub fn get_client(&self) -> Result<&Client, Error> { ... }
    pub fn switch_context(&mut self, name: &str) -> Result<(), Error> { ... }
    // Internal methods stay private
}
```

---

### Tauri 2.0 Enterprise Patterns

**Command Layer Pattern (Thin Handlers → Service Layer):**

```rust
// BEFORE: Fat command with business logic
#[tauri::command]
pub async fn create_user(name: String, email: String) -> Result<User, String> {
    // Validation here...
    // Database access here...
    // Business logic here...
    // 100+ lines of mixed concerns
}

// AFTER: Thin handler → Service layer
// src/commands/user_commands.rs
#[tauri::command]
pub async fn create_user(name: String, email: String) -> Result<User, AppError> {
    user_service::create_user(&name, &email).await
}

// src/services/user_service.rs
pub async fn create_user(name: &str, email: &str) -> Result<User, AppError> {
    validate_email(email)?;
    let user = User::new(name, email);
    repository::save_user(&user).await?;
    Ok(user)
}
```

**Error Handling (thiserror + Serialize for IPC):**

```rust
use thiserror::Error;
use serde::Serialize;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("File not found: {path}")]
    FileNotFound { path: String },

    #[error("Kubernetes error: {0}")]
    Kube(#[from] kube::Error),

    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

// CRITICAL: Implement Serialize for Tauri IPC
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where S: serde::Serializer {
        serializer.serialize_str(&self.to_string())
    }
}

// For typed frontend errors, use tagged serialization:
#[derive(Serialize)]
#[serde(tag = "kind", content = "message")]
#[serde(rename_all = "camelCase")]
pub enum TypedError {
    Io(String),
    Validation(String),
    NotFound(String),
}
// Produces: { kind: 'io' | 'validation' | 'notFound', message: string }
```

**State Management (std::Mutex vs tokio::Mutex):**

```rust
// SYNC commands: Use std::sync::Mutex
use std::sync::Mutex;

#[tauri::command]
fn increment(state: State<'_, Mutex<AppState>>) -> u32 {
    let mut state = state.lock().unwrap();
    state.counter += 1;
    state.counter
}

// ASYNC commands: Use tokio::sync::Mutex (avoids blocking!)
use tokio::sync::Mutex;

#[tauri::command]
async fn async_increment(state: State<'_, Mutex<AppState>>) -> Result<u32, ()> {
    let mut state = state.lock().await;  // .await not .unwrap()!
    state.counter += 1;
    Ok(state.counter)
}

// CRITICAL: Async commands with borrowed args need Result return type
// ❌ Won't compile
async fn cmd(state: State<'_, AppState>) { }

// ✅ Correct pattern
async fn cmd(state: State<'_, AppState>) -> Result<(), ()> { Ok(()) }
```

**Security: Path Traversal Prevention:**

```rust
#[tauri::command]
async fn read_file(path: String, app: AppHandle) -> Result<String, String> {
    let path = std::path::Path::new(&path);

    // Prevent path traversal attacks
    if path.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err("Invalid path: directory traversal not allowed".into());
    }

    // Validate against allowed base directory
    let base = app.path().app_data_dir().unwrap();
    let full_path = base.join(&path);
    let canonical = full_path.canonicalize()
        .map_err(|e| format!("Invalid path: {}", e))?;

    if !canonical.starts_with(&base) {
        return Err("Access denied: path outside allowed scope".into());
    }

    std::fs::read_to_string(canonical).map_err(|e| e.to_string())
}
```

**Async Performance (spawn_blocking for CPU-intensive):**

```rust
// CPU-intensive work should use spawn_blocking
#[tauri::command]
async fn heavy_computation(data: Vec<u8>) -> Result<Vec<u8>, String> {
    tokio::task::spawn_blocking(move || {
        process_heavy_data(data)  // Runs on blocking thread pool
    }).await.map_err(|e| e.to_string())
}

// I/O work uses regular async
#[tauri::command]
async fn fetch_data(url: String) -> Result<Data, String> {
    reqwest::get(&url).await
        .map_err(|e| e.to_string())?
        .json().await
        .map_err(|e| e.to_string())
}
```

**Extension Traits for AppHandle:**

```rust
pub trait AppHandleExt {
    fn get_database(&self) -> Arc<Database>;
    fn emit_global(&self, event: &str, payload: impl Serialize);
}

impl AppHandleExt for tauri::AppHandle {
    fn get_database(&self) -> Arc<Database> {
        self.state::<Arc<Database>>().inner().clone()
    }

    fn emit_global(&self, event: &str, payload: impl Serialize) {
        self.emit(event, payload).unwrap();
    }
}

// Usage in commands:
#[tauri::command]
async fn get_pods(app: AppHandle) -> Result<Vec<Pod>, AppError> {
    let db = app.get_database();
    db.query_pods().await
}
```

**Events for Real-time Updates (Backend → Frontend):**

```rust
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
struct ProgressUpdate { percent: u32, status: String }

#[tauri::command]
async fn long_operation(app: AppHandle) -> Result<(), String> {
    for i in 0..=100 {
        app.emit("progress", ProgressUpdate {
            percent: i,
            status: format!("Processing {}%", i)
        }).unwrap();
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    Ok(())
}
```

```typescript
// Frontend: Always cleanup listeners!
import { listen } from '@tauri-apps/api/event';

const unlisten = await listen<ProgressUpdate>('progress', (event) => {
  console.log(`Progress: ${event.payload.percent}%`);
});

// Cleanup on unmount
onCleanup(() => unlisten());
```

**Tauri 2.0 Capability-Based Security:**

```json
// src-tauri/capabilities/default.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "fs:default",
    {
      "identifier": "fs:allow-read",
      "allow": [{ "path": "$APPDATA/*" }],
      "deny": [{ "path": "$HOME/.ssh/*" }]
    }
  ]
}
```

**Release Build Optimization:**

```toml
# Cargo.toml
[profile.release]
lto = true              # Link-time optimization
codegen-units = 1       # Better optimization
opt-level = "s"         # Optimize for size
panic = "abort"         # Smaller binary
strip = true            # Remove debug symbols
```

**Channels for High-Throughput Streaming (Alternative to Events):**

```rust
use tauri::ipc::Channel;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
enum DownloadEvent<'a> {
    Started { url: &'a str, size: u64 },
    Progress { percent: u8, downloaded: u64 },
    Finished,
}

#[tauri::command]
fn download(url: String, on_progress: Channel<DownloadEvent>) {
    on_progress.send(DownloadEvent::Started { url: &url, size: 1024 }).unwrap();
    // ... streaming data
    for i in 0..=100 {
        on_progress.send(DownloadEvent::Progress { percent: i, downloaded: i as u64 * 10 }).unwrap();
    }
    on_progress.send(DownloadEvent::Finished).unwrap();
}
```

```typescript
// Frontend: Channel usage
await invoke('download', {
  url: 'https://example.com/file',
  onProgress: new Channel<DownloadEvent>((event) => {
    if (event.event === 'progress') {
      console.log(`Downloaded: ${event.data.percent}%`);
    }
  })
});
```

**Multi-Window Security Isolation:**

```json
// capabilities/admin.json - More privileges
{
  "identifier": "admin-capability",
  "windows": ["admin-*"],
  "permissions": ["fs:default", "fs:allow-write", "shell:allow-execute"]
}

// capabilities/viewer.json - Read-only
{
  "identifier": "viewer-capability",
  "windows": ["viewer-*"],
  "permissions": ["fs:allow-read"]
}
```

**Content Security Policy (CSP):**

```json
// tauri.conf.json
{
  "app": {
    "security": {
      "csp": {
        "default-src": "'self' customprotocol: asset:",
        "connect-src": "ipc: http://ipc.localhost",
        "script-src": "'self'",
        "style-src": "'unsafe-inline' 'self'"
      }
    }
  }
}
```

**Security Hardening Checklist:**

- [ ] Enable strict CSP with `default-src 'self'`
- [ ] Configure per-window capabilities with minimum permissions
- [ ] Define scopes to restrict file system access
- [ ] Validate ALL command inputs in Rust (frontend is untrusted!)
- [ ] Run `cargo audit` and `npm audit` regularly
- [ ] Never load remote/untrusted content
- [ ] Sign all release binaries
- [ ] Use `tokio::sync::Mutex` for async commands (not std::sync)

**Splashscreen Startup Optimization:**

```rust
tauri::Builder::default()
    .setup(|app| {
        let splashscreen = app.get_webview_window("splashscreen").unwrap();
        let main_window = app.get_webview_window("main").unwrap();

        tauri::async_runtime::spawn(async move {
            // Heavy initialization here (doesn't block UI)
            initialize_database().await;
            load_config().await;

            splashscreen.close().unwrap();
            main_window.show().unwrap();
        });
        Ok(())
    })
```

**Mobile Support (lib.rs Entry Point):**

```rust
// src-tauri/src/lib.rs
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![...])
        .run(tauri::generate_context!())
        .expect("error running app");
}

// src-tauri/src/main.rs (minimal)
fn main() {
    kubeli_lib::run();
}
```

**Testing: Rust Commands with Mock Runtime:**

```rust
#[cfg(test)]
mod tests {
    use tauri::test::{mock_builder, mock_context, noop_assets};

    fn create_app() -> tauri::App<tauri::test::MockRuntime> {
        mock_builder()
            .invoke_handler(tauri::generate_handler![super::greet])
            .build(mock_context(noop_assets()))
            .expect("failed to build app")
    }

    #[test]
    fn test_greet() {
        let _app = create_app();
        let result = super::greet("World");
        assert_eq!(result, "Hello, World!");
    }
}
```

```toml
# Enable test feature in Cargo.toml
[dependencies]
tauri = { version = "2.0", features = ["test"] }
```

**Testing: Frontend IPC Mocking (Vitest):**

```typescript
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks';
import { invoke } from '@tauri-apps/api/core';

afterEach(() => clearMocks());

test('invoke add command', async () => {
  mockIPC((cmd, args) => {
    if (cmd === 'add') return (args as { a: number; b: number }).a + args.b;
  });

  const result = await invoke('add', { a: 12, b: 15 });
  expect(result).toBe(27);
});
```

**Code Quality: Clippy Configuration:**

```toml
# Cargo.toml
[lints.clippy]
pedantic = { level = "warn", priority = -1 }
unwrap_used = "deny"          # Force proper error handling
expect_used = "warn"
module_name_repetitions = "allow"
```

**Code Quality: rustfmt.toml:**

```toml
edition = "2021"
max_width = 100
imports_granularity = "Module"
group_imports = "StdExternalCrate"
wrap_comments = true
```

**Workspace Dependency Management:**

```toml
# Root Cargo.toml
[workspace.dependencies]
tauri = { version = "2.0", features = [] }
serde = { version = "1.0", features = ["derive"] }
tokio = { version = "1", features = ["full"] }

# Member Cargo.toml - inherit from workspace
[dependencies]
tauri.workspace = true
serde.workspace = true
```

---

### React / TypeScript Patterns

**Component Cohesion (Single Responsibility):**

```typescript
// BEFORE: Component does too much
function PodManager() {
  const [pods, setPods] = useState([]);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [selectedPod, setSelectedPod] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  // ... 200 lines of mixed concerns

  return (
    <div>
      <FilterBar ... />
      <PodList ... />
      <PodDetails ... />
      <DeleteConfirmation ... />
      <LogViewer ... />
    </div>
  );
}

// AFTER: Separated concerns
function PodManager() {
  return (
    <PodFilterProvider>
      <div>
        <PodFilterBar />
        <PodListWithSelection />
        <PodDetailsPanel />
      </div>
    </PodFilterProvider>
  );
}
// Each sub-component manages its own state or uses shared store
```

**Props Interface Simplification:**

```typescript
// BEFORE: Too many props (shallow module)
interface PodCardProps {
  name: string;
  namespace: string;
  status: string;
  createdAt: Date;
  labels: Record<string, string>;
  onSelect: () => void;
  onDelete: () => void;
  onViewLogs: () => void;
  onRestart: () => void;
  isSelected: boolean;
  showActions: boolean;
}

// AFTER: Deep module with simple interface
interface PodCardProps {
  pod: Pod;
  onAction?: (action: PodAction) => void;
}

type PodAction =
  | { type: 'select' }
  | { type: 'delete' }
  | { type: 'viewLogs' }
  | { type: 'restart' };
```

**Custom Hooks for Reusable Logic:**

```typescript
// BEFORE: Duplicated logic in components
function PodList() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    invoke('get_pods', { namespace })
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [namespace]);
  // ...
}

// AFTER: Reusable hook
function useTauriQuery<T>(command: string, args: Record<string, unknown>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    invoke<T>(command, args)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [command, JSON.stringify(args)]);

  return { data, loading, error };
}

// Usage
function PodList({ namespace }: Props) {
  const { data: pods, loading, error } = useTauriQuery<Pod[]>('get_pods', { namespace });
  // ...
}
```

---

## Phase 5: Refactoring Workflow

### Step-by-Step Process

1. **Analyze** (5-10 min)
   - Run `/software-design-review` on target code
   - Identify top 3 complexity issues
   - Choose ONE to fix first

2. **Design** (5 min)
   - Consider 2-3 alternative approaches
   - Pick the one with simplest interface
   - Write the interface comment FIRST

3. **Test** (before coding)
   - Ensure tests exist
   - If not, write characterization tests
   - Run tests to confirm green

4. **Refactor** (small steps)
   - Make ONE change at a time
   - Run tests after each change
   - Commit after each working step

5. **Review** (after)
   - Does the code look like it was designed this way?
   - Is the interface simpler?
   - Did we improve or just move complexity?

### Commit Strategy

```bash
# Small, atomic commits
git commit -m "refactor(pods): extract PodCard props into Pod type"
git commit -m "refactor(pods): create usePod hook for selective access"
git commit -m "refactor(pods): move pod filtering to dedicated hook"

# NOT one giant commit
git commit -m "refactor: improve pod management"  # BAD: too vague
```

---

## Phase 6: Prioritization Matrix

Rate each issue and fix highest impact first:

| Issue | Complexity Reduction | Effort | Risk | Priority |
|-------|---------------------|--------|------|----------|
| High impact, Low effort, Low risk | ⬆️⬆️⬆️ | ⬇️ | ⬇️ | **P0 - Do First** |
| High impact, Medium effort | ⬆️⬆️⬆️ | ➡️ | ➡️ | **P1** |
| Medium impact, Low effort | ⬆️⬆️ | ⬇️ | ⬇️ | **P2** |
| Low impact OR High risk | ⬆️ | Any | ⬆️ | **P3 - Later** |

---

## Your Output Format

### 1. Analysis Summary

```text
Target: [file/directory]
Current Complexity: [Low/Medium/High]
Top Issues:
1. [Issue + Principle violated]
2. [Issue + Principle violated]
3. [Issue + Principle violated]
```

### 2. Refactoring Plan

```text
Priority | Issue | Refactoring | Estimated Changes
---------|-------|-------------|------------------
P0       | ...   | ...         | ~X files, ~Y lines
P1       | ...   | ...         | ...
```

### 3. Step-by-Step Execution

For each P0/P1 item:

1. What to change
2. Expected interface (comment first)
3. Test requirements
4. Implementation steps

### 4. Safety Notes

- Tests to add/verify
- Potential breaking changes
- Rollback plan if needed

---

## Sources & References

### Books

- **John Ousterhout**: "A Philosophy of Software Design" (15 Principles)
- **Robert C. Martin**: "Clean Code" (Smells & Heuristics)
- **Martin Fowler**: "Refactoring" (Refactoring Catalog)

### Web Resources

- [Vite Documentation](https://vite.dev/guide/)
- [Rust Design Patterns](https://rust-unofficial.github.io/patterns/)
- [Idiomatic Rust](https://github.com/mre/idiomatic-rust)
- [Tauri Architecture](https://v2.tauri.app/concept/architecture/)
- [Zustand GitHub](https://github.com/pmndrs/zustand)
- [React State Management 2025](https://www.developerway.com/posts/react-state-management-2025)
- [Common Sense React Refactoring](https://alexkondov.com/refactoring-a-messy-react-component/)
- [Corrode - Defensive Rust Programming](https://corrode.dev/blog/defensive-programming/)
- [React TypeScript Patterns](https://blog.logrocket.com/react-typescript-10-patterns-writing-better-code/)
