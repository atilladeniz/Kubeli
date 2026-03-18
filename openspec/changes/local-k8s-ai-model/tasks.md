# Tasks: Local K8s AI model

## Phase 1: Rust backend

### Task 1: OllamaManager (follows LogStreamManager pattern)
- [ ] Add `ollama-rs = { version = "0.3.4", features = ["stream"] }` to `src-tauri/Cargo.toml`
- [ ] Create `src-tauri/src/ai/ollama_manager.rs`
- [ ] Register module in `src-tauri/src/ai/mod.rs`
- [ ] Register `Arc::new(OllamaManager::new())` in `src-tauri/src/app/state.rs`
- [ ] `check_ollama_status()` → connect to `127.0.0.1:11434/api/tags`, return list of installed models
- [ ] Verify Ollama binds to 127.0.0.1 (warn if 0.0.0.0)
- [ ] Check Ollama version ≥0.3.15 (warn if older, CVE risk)
- [ ] `pull_ollama_model(model: String, channel: AppHandle)` → stream pull progress
- [ ] `query_local_model(prompt: String, context: K8sContext, app: AppHandle)` → stream tokens
- [ ] Define enums:
  ```rust
  enum ChatEvent { Token(String), Done { total_tokens: u32, duration_ms: u64 }, Error(String) }
  enum PullProgress { Status(String), Progress { completed: u64, total: u64 }, Done, Error(String) }
  enum OllamaStatus { Running { version: String, models: Vec<String> }, NotRunning, VersionTooOld(String) }
  ```
- [ ] All calls proxied through Rust backend (never frontend-direct → CORS + security)

**Tauri commands to register in `src-tauri/src/commands/`:**
```rust
#[tauri::command] async fn check_ollama() -> Result<OllamaStatus, String>
#[tauri::command] async fn pull_model(model: String, channel: AppHandle) -> Result<(), String>
#[tauri::command] async fn query_local_ai(prompt: String, context: K8sContext, app: AppHandle) -> Result<(), String>
#[tauri::command] async fn get_ollama_models() -> Result<Vec<OllamaModelInfo>, String>
```

### Task 2: llmfit-core integration
- [ ] Add `llmfit-core = "0.7.7"` to `src-tauri/Cargo.toml`
- [ ] Create `src-tauri/src/ai/hardware.rs`
- [ ] `detect_hardware()` → `SystemSpecs::detect()`, return `HardwareInfo` struct
- [ ] `recommend_model()` → filter `ModelDatabase` against curated K8s model list
- [ ] Return best-fit model with `FitLevel::Perfect` or `FitLevel::Good`
- [ ] Reserve 2-4 GB for OS + Kubeli on Apple Silicon unified memory
- [ ] `benchmark_model(model: String)` → run 50-token generation, return actual tok/s
- [ ] Fallback: if llmfit detection fails, use basic RAM-based rules:
  - ≥16GB → qwen3:4b
  - ≥8GB → granite3.1-moe:3b
  - <8GB → warn, suggest cloud providers

**Tauri commands:**
```rust
#[tauri::command] async fn detect_hardware() -> Result<HardwareInfo, String>
#[tauri::command] async fn recommend_model() -> Result<ModelRecommendation, String>
#[tauri::command] async fn benchmark_model(model: String) -> Result<BenchmarkResult, String>
```

### Task 3: Data sanitizer
- [ ] Create `src-tauri/src/ai/sanitizer.rs`
- [ ] Regex patterns for: emails, IPv4/IPv6, JWTs (`eyJ...`), basic auth URLs, connection strings
- [ ] High-entropy string detection (likely secrets/tokens)
- [ ] K8s-specific: env var values from pod specs, bearer tokens from headers
- [ ] Deterministic placeholder replacement (`[EMAIL-1]`, `[IP-2]`, `[TOKEN-3]`) so analysis stays coherent
- [ ] `sanitize(input: &str) -> SanitizedText` with field for replacement map
- [ ] Configurable patterns via settings (enterprise users add custom regexes)

### Task 4: Log preprocessor
- [ ] Create `src-tauri/src/ai/log_preprocessor.rs`
- [ ] Step 1 - **Filter**: regex for ERROR/WARN/FATAL + ±3 context lines (80-95% reduction)
- [ ] Step 2 - **Deduplicate**: group identical message patterns, emit one line + count
- [ ] Step 3 - **Sanitize**: pipe through sanitizer from Task 3
- [ ] Step 4 - **Chunk**: if exceeds token budget (4,652 tokens), split for map-reduce
- [ ] Use `rayon` for parallel processing on large log sets
- [ ] Token counting: approximate with char/4 or use `tiktoken-rs`
- [ ] Place critical errors at START of output (U-shaped recall in small models)
- [ ] `preprocess(logs: &str, max_tokens: usize) -> PreprocessedLogs`
  ```rust
  struct PreprocessedLogs {
      chunks: Vec<String>,    // 1 chunk if fits, multiple for map-reduce
      total_lines: usize,
      filtered_lines: usize,
      deduplicated_count: usize,
  }
  ```

### Task 5: K8s analyzers (k8sgpt pattern)
- [ ] Create `src-tauri/src/ai/analyzers/mod.rs`
- [ ] `pod_analyzer.rs` - CrashLoopBackOff, ImagePullBackOff, OOMKilled, Pending, Evicted
  - Read pod status, container statuses, restart counts, exit codes
  - Output: `"Pod nginx-abc: CrashLoopBackOff (exit code 137, OOMKilled). Restarts: 47. Memory limit: 128Mi."`
- [ ] `event_analyzer.rs` - Warning events from last 30 min
  - Filter: FailedScheduling, FailedMount, Unhealthy, BackOff
  - Output: `"3x FailedScheduling for pod api-xyz: insufficient memory (requested 2Gi, available 500Mi)"`
- [ ] `service_analyzer.rs` - No endpoints, selector mismatches
- [ ] `node_analyzer.rs` - NotReady, DiskPressure, MemoryPressure, PIDPressure
- [ ] `deployment_analyzer.rs` - Unavailable replicas, rollout stuck, image mismatch
- [ ] `pvc_analyzer.rs` - Pending binding, capacity issues
- [ ] `job_analyzer.rs` - Failed completions, backoff limit reached
- [ ] `ingress_analyzer.rs` - Missing backend service, TLS cert issues
- [ ] Each analyzer returns `Vec<AnalyzerFinding>`:
  ```rust
  struct AnalyzerFinding {
      severity: Severity,  // Critical, Warning, Info
      resource: String,    // "pod/nginx-abc"
      message: String,     // compact error description
  }
  ```
- [ ] `run_all_analyzers(namespace: &str) -> Vec<AnalyzerFinding>` → aggregate, cap at ≤800 tokens

### Task 6: System prompt + context builder
- [ ] Create `src-tauri/src/ai/context_builder.rs`
- [ ] System prompt template: under 500 tokens (see design.md for template)
- [ ] `build_context(cluster, namespace, findings, logs) -> Vec<ChatMessage>`
- [ ] Include: role, rules, error patterns, JSON output schema, one few-shot example
- [ ] Grounding: inject actual pod/service/namespace names in CONTEXT section
- [ ] Qwen3 mode routing:
  - Root cause analysis → thinking mode (temperature 0.6, TopP 0.95)
  - Structured JSON output → non-thinking mode (temperature 0.7, TopP 0.8)
- [ ] Context budget enforcement:
  | Component | Max tokens |
  |-----------|-----------|
  | System prompt | 500 |
  | Analyzer findings | 800 |
  | Log content | 4,652 |
  | Output reserve | 2,048 |

---

## Phase 2: Frontend

### Task 7: Local model settings UI

Extend the existing `AiTab.tsx` in `src/components/features/settings/components/`.

**New components to create:**

```
src/components/features/settings/components/
├── AiTab.tsx                    # MODIFY: add LocalModelSection + ProviderPriority
├── LocalModelSection.tsx        # NEW: hardware info, model recommendation, download
├── OllamaStatusCard.tsx         # NEW: similar to CliStatusCard but for Ollama
├── ModelDownloadProgress.tsx     # NEW: streaming progress bar during pull
└── ProviderPriorityList.tsx     # NEW: drag-to-reorder provider list
```

**AiTab.tsx layout (after changes):**
```tsx
<div className="space-y-6">
  {/* === NEW: Local AI Model Section === */}
  <LocalModelSection />
  <Separator />

  {/* === NEW: Provider Priority === */}
  <ProviderPriorityList />
  <Separator />

  {/* === EXISTING: Cloud AI Provider Selector === */}
  <SettingSection title="Cloud AI Provider" description="...">
    <Select> claude | codex </Select>
  </SettingSection>
  <Separator />

  {/* === EXISTING: CLI Status Cards === */}
  <CliStatusCard name="Claude Code" ... />
  <CliStatusCard name="OpenAI Codex" ... />
  <Separator />

  {/* === EXISTING: How it works === */}
  <div> ... </div>
</div>
```

**LocalModelSection.tsx detail:**
```
┌─────────────────────────────────────────────────┐
│ Local AI Model                                   │
│ Run AI analysis offline, no API key needed.      │
├─────────────────────────────────────────────────┤
│                                                 │
│ ┌─ OllamaStatusCard ─────────────────────────┐  │
│ │ Ollama: ● Running (v0.5.2)                │  │
│ │ or                                         │  │
│ │ Ollama: ○ Not installed                    │  │
│ │   brew install ollama (macOS)              │  │
│ │   winget install Ollama.Ollama (Windows)   │  │
│ └────────────────────────────────────────────┘  │
│                                                 │
│ Hardware:                                       │
│   Apple M2 Pro · 12 cores · 16 GB · Metal       │
│                                                 │
│ Recommended: qwen3:4b (Q4_K_M)                  │
│   ~30-45 tok/s · 5.2 GB RAM · Fit: Perfect      │
│                                                 │
│ ┌─ ModelDownloadProgress ────────────────────┐  │
│ │ [Download qwen3:4b]                        │  │
│ │ or                                         │  │
│ │ ████████████████░░░░ 78% (4.1 / 5.2 GB)   │  │
│ │ or                                         │  │
│ │ ● Ready (qwen3:4b) · measured: 38 tok/s   │  │
│ └────────────────────────────────────────────┘  │
│                                                 │
│ [Change Model ▾]  ← dropdown with model list    │
│                                                 │
│ ⓘ Cluster data stays on this machine.           │
│   No cloud API needed after model download.     │
│                                                 │
└─────────────────────────────────────────────────┘
```

**ProviderPriorityList.tsx detail:**
```
┌─────────────────────────────────────────────────┐
│ Provider Priority                                │
│ Drag to set which AI provider is tried first.    │
├─────────────────────────────────────────────────┤
│                                                 │
│  ≡ 1. Local Model (qwen3:4b)        ● Ready    │
│  ≡ 2. Claude Code CLI               ● Auth'd   │
│  ≡ 3. OpenAI Codex CLI              ○ Not inst  │
│                                                 │
│  ☐ Smart routing: use local for logs,           │
│    cloud for complex questions                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Frontend hooks to create in `src/components/features/settings/hooks/`:**
```
├── useOllamaStatus.ts      # NEW: polls Ollama status, returns OllamaStatus
├── useHardwareInfo.ts       # NEW: calls detect_hardware, returns HardwareInfo
├── useModelRecommendation.ts # NEW: calls recommend_model, returns ModelRecommendation
├── useModelDownload.ts      # NEW: manages pull_model with Channel progress
```

**Tauri command bindings to add in `src/lib/tauri/commands/`:**
```typescript
// src/lib/tauri/commands/ai-local.ts (NEW)
export async function checkOllama(): Promise<OllamaStatus> { ... }
export async function pullModel(model: string, onProgress: (p: PullProgress) => void): Promise<void> { ... }
export async function queryLocalAi(prompt: string, context: K8sContext, onToken: (e: ChatEvent) => void): Promise<void> { ... }
export async function detectHardware(): Promise<HardwareInfo> { ... }
export async function recommendModel(): Promise<ModelRecommendation> { ... }
export async function benchmarkModel(model: string): Promise<BenchmarkResult> { ... }
export async function getOllamaModels(): Promise<OllamaModelInfo[]> { ... }
```

**TypeScript types to add in `src/lib/types/`:**
```typescript
// src/lib/types/local-ai.ts (NEW)
interface HardwareInfo { cpu: string; cores: number; ram_gb: number; gpu: string | null; vram_gb: number | null; }
interface ModelRecommendation { model: string; params_b: number; estimated_ram_gb: number; estimated_tps: number; fit: "perfect" | "good" | "marginal"; reason: string; }
interface OllamaStatus { status: "running" | "not_running" | "version_too_old"; version?: string; models?: string[]; }
interface OllamaModelInfo { name: string; size_gb: number; modified_at: string; }
interface PullProgress { type: "status" | "progress" | "done" | "error"; message?: string; completed?: number; total?: number; }
interface ChatEvent { type: "token" | "done" | "error"; content?: string; total_tokens?: number; duration_ms?: number; }
interface BenchmarkResult { model: string; tokens_per_second: number; first_token_ms: number; }
```

**Store changes:**

Extend `src/lib/stores/ui-store.ts`:
```typescript
// Add to Settings type:
export type AiProvider = "local" | "claude" | "codex";
interface Settings {
  // existing...
  aiCliProvider: AiCliProvider;
  // new:
  localModel: string | null;          // e.g. "qwen3:4b"
  ollamaHost: string;                 // default "http://127.0.0.1:11434"
  providerPriority: AiProvider[];     // default ["local", "claude", "codex"]
  smartRouting: boolean;              // default true
}
```

Extend `src/lib/stores/ai-store/types.ts`:
```typescript
// Add to AIState:
interface AIState {
  // existing...
  activeProvider: AiProvider | null;  // which provider is handling the current query
}
```

**i18n keys to add** in both EN and DE translation files:
```
settings.ai.localModel.title
settings.ai.localModel.description
settings.ai.localModel.hardware
settings.ai.localModel.recommended
settings.ai.localModel.download
settings.ai.localModel.downloading
settings.ai.localModel.ready
settings.ai.localModel.changeModel
settings.ai.localModel.privacyNotice
settings.ai.localModel.ollamaNotInstalled
settings.ai.localModel.ollamaInstall.macos
settings.ai.localModel.ollamaInstall.windows
settings.ai.localModel.ollamaInstall.linux
settings.ai.localModel.ollamaVersionWarning
settings.ai.localModel.fit.perfect
settings.ai.localModel.fit.good
settings.ai.localModel.fit.marginal
settings.ai.localModel.benchmarkResult
settings.ai.providerPriority.title
settings.ai.providerPriority.description
settings.ai.providerPriority.smartRouting
settings.ai.providerPriority.smartRoutingDescription
settings.ai.providerPriority.local
settings.ai.providerPriority.claude
settings.ai.providerPriority.codex
```

### Task 8: Provider priority + smart routing
- [ ] `ProviderPriorityList.tsx` with drag-to-reorder (use existing drag pattern or `@dnd-kit`)
- [ ] Show status badge per provider (Ready / Authenticated / Not Installed)
- [ ] "Smart routing" checkbox: logs/troubleshooting → local, complex → cloud
- [ ] Store priority order in `ui-store` settings
- [ ] Update `src-tauri/src/ai/agent_manager.rs` to read priority order
- [ ] Try providers in order: if first fails/unavailable, fall through to next

### Task 9: Log analysis integration (extend existing infrastructure)

Already exists and works:
- `useLogAnalysis` hook: `src/components/features/logs/hooks/useLogAnalysis.ts`
- `AIButton` toolbar component: `src/components/features/logs/components/toolbar/AIButton.tsx`
- `PendingAnalysis` type + `setPendingAnalysis` action in ai-store
- i18n keys: `logs.analyzeWithAI`, `logs.sendToAI`, `logs.aiPromptTitle`, etc.
- @dnd-kit already installed (used in tabbar) - reuse for ProviderPriorityList

Changes needed:
- [ ] Extend `useLogAnalysis` hook: check Ollama availability alongside CLI checks
- [ ] Route through preprocessor → sanitizer → context builder → OllamaManager
- [ ] Reuse existing `setPendingAnalysis` → open AI panel flow
- [ ] Stream response via `app.emit()` events (same pattern as existing AI events)
- [ ] Update `ProviderBadge.tsx` to show "Local" (blue) alongside Claude/Codex
  ```tsx
  provider === "local" ? "bg-blue-500/10 text-blue-500" : ...
  ```
- [ ] For large logs: map-reduce with progress ("Analyzing chunk 2/4...")
- [ ] Add ~3 new i18n keys: `aiLocalModelUnavailable`, `aiLocalModelPulling`, `aiAnalyzingChunk`

---

## Phase 3: Polish

### Task 10: Ollama lifecycle management
- [ ] Auto-detect Ollama on app startup (non-blocking, use `useOllamaStatus` hook)
- [ ] First-launch setup wizard: if Ollama detected but no model → show banner in AI tab
- [ ] Platform-specific install instructions in `OllamaStatusCard.tsx`
- [ ] Handle Ollama going offline mid-session: catch error, fallback to next provider in priority
- [ ] Redirect Ollama stdout/stderr to log file if spawned by Kubeli

### Task 11: Evaluation framework (prep for v2)
- [ ] Create 200-500 test examples in `.dev/ai-eval/`:
  - Error diagnosis (CrashLoopBackOff, OOM, ImagePull, etc.)
  - kubectl command generation
  - YAML debugging
  - Networking issues (service selectors, ingress)
  - RBAC problems
- [ ] Automated checks: YAML validation, kubectl syntax, resource name grounding
- [ ] Optional thumbs up/down in AI chat UI for user feedback
- [ ] Script to run eval set against local model and score results

---

## Phase 0: Refactoring (before new code)

### Task 0: Rename AiCliProvider to AiProvider
- [ ] Rename `AiCliProvider` → `AiProvider` in `src-tauri/src/ai/agent_manager.rs`
- [ ] Add `Local` variant to the enum
- [ ] Update all Rust references (commands.rs, session_store.rs, etc.)
- [ ] Rename TypeScript `AiCliProvider` → `AiProvider` in `src/lib/tauri/commands/ai.ts`
- [ ] Update `src/lib/stores/ui-store.ts` type
- [ ] Update `ProviderBadge.tsx`, `AiTab.tsx`, `useAISession.ts`
- [ ] Run `make lint && make check && make rust-check` to catch all references
- [ ] This is a standalone refactor, commit separately before adding new features

---

## Conventions to follow

### Rust conventions (match existing patterns)

**Error handling:**
- All commands return `Result<T, KubeliError>`, never `Result<T, String>`
- Use `KubeliError::new(ErrorKind::X, "message")` with `.with_suggestions()`
- Error kinds: `Network` (Ollama down), `NotFound` (model missing), `ServerError` (Ollama error), `Timeout`

**State management:**
- Shared state wrapped in `Arc<RwLock<T>>` or `Arc<AtomicBool>` (stop flags)
- New managers registered in `src-tauri/src/app/state.rs` with `.manage()`
- Follow `LogStreamManager` / `ShellSessionManager` pattern for `OllamaManager`

**Streaming/events:**
- Spawn `tokio::spawn` task for long-running operations
- Use `Arc<AtomicBool>` stop flag for cancellation
- Emit events via `app.emit(&event_name, AIEvent::X { ... })`
- Use existing `AIEvent` tagged enum (serde: `#[serde(tag = "type", content = "data")]`)

**Command registration:**
- Register in `src-tauri/src/app/command_registry/mod.rs` via `generate_handler!`
- Commands use `State<'_, T>` injection for accessing managers

### Frontend conventions (match existing patterns)

**Tauri command bindings:**
- Wrapper functions in `src/lib/tauri/commands/` calling `invoke<T>(name, args)`
- Type-safe with explicit return types
- Follow pattern in `ai.ts`

**Event listening:**
- Use `listen<T>(eventName, callback)` from `@tauri-apps/api/event`
- Store `unlisten` function for cleanup
- Follow pattern in `useAIEvents.ts` and `log-store.ts`

**Zustand stores:**
- Action slice pattern: `createXActions(set, get)` returning action object
- External Maps for non-UI state (listeners, timers)
- `persist` middleware if settings need saving

**Settings tabs:**
- Use `SettingSection` wrapper for consistent layout
- Accept hook return values as props
- Use existing UI components: `Select`, `Separator`, `Label`, `Button`

**Testing:**
- Rust: inline `#[cfg(test)]` at bottom of file, `#[tokio::test]` for async
- Frontend: Jest with `jest.doMock` for Tauri invoke mocking

---

## File change summary

### New files

**Rust backend (`src-tauri/src/ai/`):**
```
ollama_manager.rs      # OllamaManager: session management, streaming, lifecycle
hardware.rs            # llmfit-core hardware detection + model recommendation
sanitizer.rs           # Data sanitization (secrets, emails, tokens)
log_preprocessor.rs    # Filter → dedup → sanitize → chunk pipeline
analyzers/
  mod.rs               # Analyzer trait + aggregator
  pod_analyzer.rs      # Pod status analysis
  event_analyzer.rs    # Warning event analysis
  service_analyzer.rs  # Service endpoint analysis
  node_analyzer.rs     # Node condition analysis
```

**Frontend (`src/components/features/settings/components/`):**
```
LocalModelSection.tsx       # Hardware info + model download + status
OllamaStatusCard.tsx        # Ollama connection status card
ModelDownloadProgress.tsx    # Streaming download progress bar
ProviderPriorityList.tsx     # Drag-to-reorder provider list
```

**Frontend hooks (`src/components/features/settings/hooks/`):**
```
useOllamaStatus.ts          # Poll Ollama status
useHardwareInfo.ts           # Detect hardware via llmfit-core
useModelRecommendation.ts    # Get model recommendation
useModelDownload.ts          # Manage model pull with progress
```

**Tauri command bindings (`src/lib/tauri/commands/`):**
```
ai-local.ts                 # All new Tauri command bindings for local AI
```

**Types (`src/lib/types/`):**
```
local-ai.ts                 # HardwareInfo, ModelRecommendation, OllamaStatus, etc.
```

### Modified files

| File | Change |
|------|--------|
| **Rust refactoring (Task 0)** | |
| `src-tauri/src/ai/agent_manager.rs` | Rename `AiCliProvider` → `AiProvider`, add `Local` variant, delegate to OllamaManager |
| `src-tauri/src/ai/commands.rs` | Update types, add ollama-specific commands |
| `src-tauri/src/ai/cli_detector.rs` | Add `detect_ollama()` function |
| `src-tauri/src/ai/context_builder.rs` | Add `build_local_context()` for short prompts |
| `src-tauri/src/ai/mod.rs` | Register new modules (ollama_manager, hardware, sanitizer, etc.) |
| **Rust new features** | |
| `src-tauri/Cargo.toml` | Add ollama-rs, llmfit-core |
| `src-tauri/src/app/state.rs` | Register `Arc::new(OllamaManager::new())` |
| `src-tauri/src/app/command_registry/mod.rs` | Add new commands to `generate_handler!` |
| **Frontend refactoring (Task 0)** | |
| `src/lib/tauri/commands/ai.ts` | Rename `AiCliProvider` → `AiProvider`, add `"local"` |
| `src/components/features/ai/components/ProviderBadge.tsx` | Add "local" provider (blue badge) |
| **Frontend new features** | |
| `src/components/features/settings/components/AiTab.tsx` | Add LocalModelSection + ProviderPriority above existing content |
| `src/components/features/settings/components/index.ts` | Export new components |
| `src/components/features/settings/hooks/index.ts` | Export new hooks |
| `src/lib/stores/ui-store.ts` | Add localModel, ollamaHost, providerPriority, smartRouting |
| `src/lib/stores/ai-store/types.ts` | Add activeProvider to AIState |
| `src/lib/tauri/commands/index.ts` | Re-export ai-local commands |
| i18n EN + DE files | Add ~25 translation keys |

---

## Model candidates

| Model | Params | Active | RAM (Q4) | Context | Tool Call | Fit |
|-------|--------|--------|----------|---------|-----------|-----|
| `qwen3:4b` | 4B | 4B | ~5.2GB | 32K | 0.880 | Default |
| `granite3.1-moe:3b` | 3B | ~800M | ~2.2GB | 128K | 0.670 | Low-RAM fallback |
| `phi4-mini` | 3.8B | 3.8B | ~2.5GB | 128K | 0.880 | MIT alternative |
| `qwen3:8b` | 8B | 8B | ~5GB | 32K | - | Quality pick |

## Rust dependencies (new)

```toml
ollama-rs = { version = "0.3.4", features = ["stream"] }
llmfit-core = "0.7.7"
```

### Bundle size impact

Estimated +8-15 MB to release binary (mostly llmfit model database).
Consider Cargo feature flag to make local AI optional:

```toml
[features]
default = ["local-ai"]
local-ai = ["dep:ollama-rs", "dep:llmfit-core"]
```

Current binary has ~68 direct crate dependencies (7.8K line Cargo.lock).

### Existing infrastructure to reuse (no new code needed)

| What | Where | Status |
|------|-------|--------|
| Log analysis button | `src/components/features/logs/components/toolbar/AIButton.tsx` | Exists |
| Log analysis hook | `src/components/features/logs/hooks/useLogAnalysis.ts` | Exists, extend |
| PendingAnalysis flow | `ai-store/types.ts` + `control-actions.ts` | Exists |
| AI event handler | `src/components/features/ai/hooks/useAIEvents.ts` | Exists, works as-is |
| Drag and drop | `@dnd-kit/sortable` in `package.json` | Exists |
| Settings persistence | `localStorage` via Zustand persist in `ui-store.ts` | Exists |
| i18n AI keys | `src/i18n/messages/en.json` + `de.json` | Partial, add ~3 keys |
| Provider badge | `src/components/features/ai/components/ProviderBadge.tsx` | Exists, add "local" |
| Session storage | `ai/session_store.rs` (SQLite) | Exists, works with new provider |
| CSP / Tauri permissions | `tauri.conf.json` | No changes needed (Rust-proxied) |

---

## Phase 4: Dataset & Fine-Tuning (v2)

### Task 12: Training infrastructure setup

**Windows RTX 3090 (training server):**
- [ ] Install WSL2 + Ubuntu (if not already)
- [ ] Install CUDA toolkit 12.1+ and verify with `nvidia-smi`
- [ ] Install Python 3.12 + `uv` package manager
- [ ] Install Unsloth: `pip install unsloth[cu121]`
- [ ] Verify Unsloth Studio: `unsloth studio` (web UI on :7860)
- [ ] Install Ollama on Windows for local model testing
- [ ] Set up remote access from Mac:
  - Option A: Tailscale mesh VPN (recommended, zero-config)
  - Option B: SSH via WSL2 (`sudo apt install openssh-server`)
- [ ] Shared storage for datasets: Syncthing or NFS mount between Mac ↔ Windows
- [ ] Test: `ssh windows-box "nvidia-smi"` from Mac

**Cloud GPU fallback (only if 3090 unavailable):**
- [ ] Vast.ai account + API key (cheapest on-demand 3090s at ~$0.20/hr)
- [ ] RunPod account (reliable A100s for larger experiments)
- [ ] Template Docker image: `unsloth/unsloth` with our scripts baked in

### Task 13: Data harvesting pipeline

Create `.dev/training-data/` directory structure:
```
.dev/training-data/
├── harvest.sh              # Clone all source repos
├── convert_docs.py         # MD/MDX → instruction pairs
├── convert_stackoverflow.py # SO dataset → instruction pairs
├── convert_k8sgpt.py       # k8sgpt analyzer patterns → pairs
├── generate_synthetic.py   # YAML mutation + error generation
├── merge_and_filter.py     # Deduplicate, quality filter, balance
├── raw/                    # Cloned repos (gitignored)
├── processed/              # JSONL files per source
└── final/                  # Merged, filtered training set
```

**Harvesting tasks:**
- [ ] `harvest.sh`: clone repos with `--depth 1`
  - `kubernetes/website` (Apache 2.0, ~15K pairs from EN docs)
  - `k8sgpt-ai/k8sgpt` (Apache 2.0, analyzer patterns)
  - `kubernauts/practical-kubernetes-problems` (troubleshooting scenarios)
  - `iam-veeramalla/kubernetes-troubleshooting-zero-to-hero` (error walkthroughs)
  - HuggingFace `mcipriano/stackoverflow-kubernetes-questions` (30K Q&A, MIT)
  - HuggingFace `ComponentSoft/k8s-kubectl-35k` (kubectl examples)
- [ ] `convert_docs.py`: parse K8s website markdown
  - Strip Hugo frontmatter (`---\n...\n---`)
  - Split by H2/H3 sections, keep code blocks intact
  - Classify: troubleshooting / howto / concept / reference
  - Generate instruction-response pairs (Alpaca format)
  - Preserve original source path for traceability
- [ ] `convert_stackoverflow.py`: transform SO Q&A
  - Filter: only accepted answers with score ≥ 3
  - Clean HTML tags, format code blocks
  - Pair: question title + body → accepted answer
- [ ] `convert_k8sgpt.py`: extract analyzer patterns from Go code
  - Parse analyzer files for error conditions and messages
  - Expand each pattern into multiple instruction variants
  - "What does CrashLoopBackOff mean?" / "My pod keeps restarting" / "Exit code 137"
- [ ] `generate_synthetic.py`: create error→fix pairs
  - Take valid K8s YAML → introduce common mistakes → generate diagnosis
  - Mistake types: wrong apiVersion, missing labels, bad selectors, resource typos
  - ~3K pairs from YAML mutation
- [ ] `merge_and_filter.py`: final dataset assembly
  - Deduplicate with MinHash (datasketch library)
  - Remove pairs < 50 tokens or > 2000 tokens
  - Balance categories (max 30% from any single source)
  - Validate kubectl syntax in command outputs
  - Output: `final/kubeli-k8s-train.jsonl` + `final/kubeli-k8s-eval.jsonl` (90/10 split)
- [ ] Add `.dev/training-data/raw/` to `.gitignore` (cloned repos are large)

**Target: 50K+ high-quality instruction-response pairs**

### Task 14: Unsloth fine-tuning

Create `.dev/training-data/train.py`:
- [ ] Load Qwen3-4B via Unsloth (`unsloth/Qwen3-4B`, 4-bit QLoRA)
- [ ] LoRA config: r=16, target all linear layers, alpha=16, dropout=0
- [ ] Training args: batch=4, grad_accum=4, epochs=3, lr=2e-4, bf16
- [ ] Max seq length: 8192 (matches our context budget)
- [ ] Train on `final/kubeli-k8s-train.jsonl`
- [ ] Export to GGUF: Q4_K_M (speed) + Q5_K_M (accuracy)
- [ ] Generate Ollama Modelfile with our system prompt baked in
- [ ] Test: `ollama create kubeli-k8s:4b -f Modelfile`
- [ ] Run eval set and compare against base Qwen3:4b + prompt engineering

**Alternative: Unsloth Studio (no-code):**
- [ ] Upload `kubeli-k8s-train.jsonl` via Studio web UI
- [ ] Use Data Recipes if more synthetic data needed from raw docs
- [ ] Configure training params in UI, start training
- [ ] Export GGUF directly from Studio

### Task 15: Eval pipeline

Create `.dev/training-data/eval.py` + `.dev/ai-eval/` test set:
- [ ] 500 test examples covering:
  - Error diagnosis: CrashLoopBackOff, OOM, ImagePull, Pending (150)
  - kubectl generation: create, scale, debug, rollout (100)
  - YAML debugging: find the error in this manifest (100)
  - Networking: service selectors, ingress, DNS (75)
  - RBAC: permission denied scenarios (75)
- [ ] Automated scoring:
  - JSON validity (structured output check)
  - kubectl syntax validation
  - Resource name grounding (no hallucinated names)
  - Error category accuracy
- [ ] Comparison matrix: base model vs fine-tuned vs prompt-only
- [ ] Output: markdown report with accuracy per category

### Task 16: Model distribution

- [ ] Publish to Ollama registry: `kubeli/k8s:4b` (Q4_K_M default)
- [ ] Also publish `kubeli/k8s:4b-q5` (higher accuracy variant)
- [ ] Add to llmfit curated list in Kubeli (priority 0, above generic qwen3:4b)
- [ ] Update Settings UI: show "Kubeli K8s Model" as recommended default
- [ ] Create model card (README) with benchmarks, training data sources, license info
- [ ] Automate: GitHub Action that retrains monthly on updated docs + new SO questions

---

## Training Infrastructure

| Machine | Specs | Role |
|---------|-------|------|
| MacBook Air M4 | 32 GB, 1.1 TB free, Metal 3 | Dataset curation, eval, inference testing |
| Windows Desktop | RTX 3090 24 GB VRAM, CUDA 12 | QLoRA training via Unsloth (~30 min per run) |
| Cloud (fallback) | Vast.ai RTX 3090 $0.20/hr | If local GPU unavailable |

## Research sources

- k8sgpt analyzer architecture (Apache 2.0, 7.4K stars)
- Masri et al. (Jan 2026): Qwen3-4B 95.64% log classification with RAG
- ollama-rs (v0.3.4, MIT, 988 stars)
- llmfit-core (v0.7.7, MIT, docs.rs verified)
- Cisco Talos / Trend Micro: Ollama security (CVE-2024-37032)
- Stanford "Lost in the Middle" (Liu et al. 2023)
- Unsloth Studio docs (unsloth.ai/docs/new/studio)
- HuggingFace datasets: mcipriano/stackoverflow-kubernetes-questions (CC-BY-SA-4.0)
- HuggingFace datasets: ComponentSoft/k8s-kubectl-35k
- kubernetes/website (Apache 2.0, official K8s docs)
- k8sgpt-ai/k8sgpt (Apache 2.0, analyzer patterns)
