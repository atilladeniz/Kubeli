# Tasks: Kubi-1 — Local K8s AI Model

## Phase 0: Refactoring

### Task 0.1: Rename AiCliProvider to AiProvider
- [ ] Rename `AiCliProvider` → `AiProvider` in `src-tauri/src/ai/agent_manager.rs`
- [ ] Add `Local` variant to the enum
- [ ] Update all Rust references (commands.rs, session_store.rs, etc.)
- [ ] Rename TypeScript `AiCliProvider` → `AiProvider` in `src/lib/tauri/commands/ai.ts`
- [ ] Update `src/lib/stores/ui-store.ts` type
- [ ] Update `ProviderBadge.tsx`, `AiTab.tsx`, `useAISession.ts`
- [ ] Run `make lint && make check && make rust-check`
- [ ] Commit separately before new features

---

## Phase 1: llama-server sidecar (replaces Ollama)

### Task 1.1: Fetch and bundle llama-server binaries
- [ ] Create `scripts/fetch-llama-server.sh`
- [ ] Download pre-built llama-server from llama.cpp releases (pin version, currently b8660)
- [ ] For v2/TurboQuant: build from TheTom/llama-cpp-turboquant fork instead of upstream
- [ ] Document v1 binary strategy: ship default CPU/Metal-compatible targets first, keep CUDA/Vulkan packaging as follow-up
- [ ] Build flags for Metal: `-DGGML_METAL=ON -DGGML_AMX=ON` (AMX enables Apple Matrix instructions on M4)
- [ ] Build flags for CUDA: `-DGGML_CUDA=ON -DGGML_CUDA_FA=ON -DGGML_CUDA_FA_ALL_QUANTS=ON`
- [ ] Rename per Tauri target triple convention:
  - `llama-server-aarch64-apple-darwin` (macOS ARM, includes Metal)
  - `llama-server-x86_64-apple-darwin` (macOS Intel)
  - `llama-server-x86_64-pc-windows-msvc.exe` (Windows CPU)
  - `llama-server-x86_64-unknown-linux-gnu` (Linux)
- [ ] Place in `src-tauri/binaries/`
- [ ] Add `externalBin` to `tauri.conf.json`: `["binaries/llama-server"]`
- [ ] Add sidecar permission to `src-tauri/capabilities/default.json`:
  ```json
  { "identifier": "shell:allow-execute", "allow": [{ "name": "binaries/llama-server", "sidecar": true, "args": true }] }
  ```
- [ ] Add `tauri-plugin-shell` to Cargo.toml if not present
- [ ] Verify sidecar starts on macOS, Windows, Linux
- [ ] Add `scripts/fetch-llama-server.sh` to CI build workflow (`.github/workflows/build.yml`)
- [ ] Add `src-tauri/binaries/` to `.gitignore` (binaries fetched during build, not committed)

### Task 1.2: LlamaManager (replaces OllamaManager)
- [ ] Create `src-tauri/src/ai/llama_manager.rs`
- [ ] Register module in `src-tauri/src/ai/mod.rs`
- [ ] Register `Arc::new(LlamaManager::new())` in `src-tauri/src/app/state.rs`
- [ ] `start()` — launch llama-server sidecar via `app.shell().sidecar("llama-server")`
  - Bind to `127.0.0.1` on a random free port (security: local only)
  - Pass model path, context size, thread count
  - **Dual-model architecture** (see Model Architecture section):
    - Default: Qwen3-4B with thinking ON + grammar (multi-turn, tool calling)
    - Deep Analysis: Qwen3.5-4B without thinking, no grammar (single-shot, vision, long context)
    - Use llama-server Router Mode or swap models via API `"model"` field
  - Qwen3-4B (default) flag set:
    ```
    llama-server \
      --model Qwen3-4B-Q4_K_M.gguf \
      --fit on --fit-ctx 8192 --fit-target 1024 \
      -fa on --mlock --parallel 1 \
      --defrag-thold 0.1 \
      --jinja --no-warmup \
      --chat-template-kwargs '{"enable_thinking":true}'
    ```
  - Qwen3.5-4B (deep analysis) flag set:
    ```
    llama-server \
      --model Qwen3.5-4B-UD-Q4_K_M.gguf \
      --fit on --fit-ctx 4096 --fit-target 1024 \
      -fa on --mlock --parallel 1 \
      --defrag-thold 0.1 \
      --jinja --no-warmup
    ```
  - **Qwen3-4B gets --fit-ctx 8192**: Standard transformer, KV cache reused between turns, no reprocessing penalty. Can afford larger context.
  - **Qwen3.5-4B gets --fit-ctx 4096**: DeltaNet reprocesses full context every turn. 4K keeps latency at ~2-4s on M3/M4.
  - **Qwen3-4B gets thinking ON**: Thinking + grammar work together on standard transformers. This is the key advantage: MATH-500 jumps from 43.6% → 95.2%.
  - **Qwen3.5-4B keeps thinking OFF**: Grammar + thinking mutually exclusive (Issue #20345). Small models have thinking OFF by default.
  - **--jinja**: Required for both models' tool-calling chat templates
  - **DO NOT USE --reasoning-format deepseek on Qwen3.5**: Breaks grammar enforcement.
  - v2 TurboQuant flags (primarily benefits Qwen3-4B):
    - Add: `--cache-type-k q8_0 --cache-type-v turbo3` (asymmetric: preserves tool-calling)
    - TurboQuant benefits Qwen3-4B 100% (all layers) vs Qwen3.5-4B ~25% (only attention layers)
    - Abstract type name in config: fork `turbo3` ≠ upstream `tbq3_0`
  - v2 Plan B: upstream `-ctk q8_0 -ctv q4_0` + ggerganov's rotation (PR #21038)
  - Health check loop: `GET /health` every 1s, timeout after 30s
- [ ] `stop()` — kill sidecar child process
- [ ] `chat()` — `POST /v1/chat/completions` with streaming
  - Parse SSE stream, emit `AIEvent::Token`, `AIEvent::Done`, `AIEvent::Error`
  - Reuse existing `AIEvent` tagged enum so frontend needs zero changes
- [ ] `is_running()` — check if sidecar process is alive + health endpoint responds
- [ ] **RAM-schonender Betrieb**:
  - Lazy start: only launch sidecar on first AI request, not on app startup
  - Auto-stop after 5 min idle (configurable in Settings: 2/5/10/30 min or "never")
  - Only load ONE model at a time (Qwen3-4B OR Qwen3.5-4B, never both)
  - Model swap: stop current → unload → load new (~1-3s on Apple Silicon)
  - **RAM Budget**: App ~200MB + llama-server idle ~50MB + Model loaded ~2.5-3GB = ~3GB active, ~200MB when AI off
  - Settings toggle: "Keep AI model loaded" (default OFF) — for users who want instant response but accept 3GB RAM usage
  - Show RAM usage indicator in AI panel footer: "Kubi-1 aktiv (2.5 GB)" or "AI nicht geladen"
- [ ] Restart on crash: detect sidecar exit, show error, offer restart
- [ ] All errors return `Result<T, KubeliError>` with suggestions

**Tauri commands:**
```rust
#[tauri::command] async fn start_local_ai() -> Result<(), KubeliError>
#[tauri::command] async fn stop_local_ai() -> Result<(), KubeliError>
#[tauri::command] async fn local_ai_status() -> Result<LocalAiStatus, KubeliError>
#[tauri::command] async fn query_local_ai(session_id: String, prompt: String, context: K8sContext) -> Result<(), KubeliError>
```

### Task 1.3: ModelManager (download, verify, update)
- [ ] Create `src-tauri/src/ai/model_manager.rs`
- [ ] Model storage in Tauri app data dir:
  - macOS: `~/Library/Application Support/com.kubeli/models/`
  - Windows: `%APPDATA%/com.kubeli/models/`
  - Linux: `~/.local/share/com.kubeli/models/`
- [ ] `manifest.json` — tracks installed model version, SHA-256, download date
- [ ] `download_model(url, dest, sha256)` — stream download with progress events
  - Preflight disk-space check before download (`model size + temp file + safety margin`)
  - Resume partial download when source supports ranged requests
  - SHA-256 verification after download
  - Delete and re-download if checksum fails
  - Emit `ModelDownloadEvent::Started`, `Progress`, `Verifying`, `Complete`, `Error`
- [ ] `cancel_download()` — abort active download, emit cancelled state, clean temp file
- [ ] `check_for_update()` — fetch `registry.json` from GitHub (max 1x/day)
  - Compare local version vs remote latest
  - Respect `min_app_version` (don't offer model update if app too old)
- [ ] `update_model()` — download new GGUF to temp file, stop sidecar, atomic rename, restart
  - Roll back to previous GGUF if verification or restart fails
- [ ] `delete_model()` — remove GGUF and update manifest
- [ ] `get_installed_model()` — read manifest, return model info or None
- [ ] Download sources (fallback chain):
  1. HuggingFace CDN (primary, fast, resumable)
  2. GitHub Releases (fallback)

**Tauri commands:**
```rust
#[tauri::command] async fn get_model_status() -> Result<ModelStatus, KubeliError>
#[tauri::command] async fn download_model(model_id: String) -> Result<(), KubeliError>
#[tauri::command] async fn cancel_model_download() -> Result<(), KubeliError>
#[tauri::command] async fn check_model_update() -> Result<Option<ModelUpdate>, KubeliError>
#[tauri::command] async fn update_model() -> Result<(), KubeliError>
#[tauri::command] async fn delete_model() -> Result<(), KubeliError>
```

### Task 1.4: Model registry (hosted)
- [ ] Create `registry.json` format:
  ```json
  { "latest": "1.0.0", "models": { "1.0.0": { "filename": "...", "size_bytes": ..., "sha256": "...", "urls": [...], "min_app_version": "0.4.0" }}}
  ```
- [ ] Host on GitHub: `https://raw.githubusercontent.com/kubeli-app/kubi-1/main/registry.json`
- [ ] Or host on GitHub Pages / S3 for CDN caching
- [ ] Create GitHub Actions workflow to update registry.json on model release

---

## Phase 2: K8s intelligence (Rust backend)

### Task 2.1: Hardware detection (llmfit-core)
- [ ] Add `llmfit-core = "0.7"` to `src-tauri/Cargo.toml`
- [ ] Create `src-tauri/src/ai/hardware.rs`
- [ ] `detect_hardware()` → `SystemSpecs::detect()`, return `HardwareInfo`
- [ ] `recommend_model()` → pick from curated Kubi-1 list:
  - `ram < 12GB` → Kubi-1 Nano (Qwen3-1.7B, ~1.2GB)
  - `ram < 24GB` → Kubi-1 (Qwen3-4B, ~2.5GB)
  - `ram >= 24GB && ram < 48GB` → Kubi-1 Pro (Qwen3-8B, ~5GB)
  - `ram >= 48GB` → Kubi-1 Ultra (Gemma 4 26B-A4B, ~17GB) — v2 only
- [ ] Note: with `--fit` flag, llama-server auto-adjusts context size to available memory. Hardware detection primarily drives model recommendation, not context size.
- [ ] Keep research candidates (`Qwen3.5-4B`, `Gemma 4 E4B`) out of default recommendations until eval is complete
- [ ] Reserve 2-4 GB for OS + Kubeli on Apple Silicon
- [ ] `benchmark_model()` → 50-token generation, return actual tok/s
- [ ] Fallback if llmfit fails: basic RAM-based rules via `sysinfo` crate

**Tauri commands:**
```rust
#[tauri::command] async fn detect_hardware() -> Result<HardwareInfo, KubeliError>
#[tauri::command] async fn recommend_model() -> Result<ModelRecommendation, KubeliError>
#[tauri::command] async fn benchmark_model(model: String) -> Result<BenchmarkResult, KubeliError>
```

### Task 2.2: Data sanitizer
- [ ] Create `src-tauri/src/ai/sanitizer.rs`
- [ ] Regex patterns: emails, IPv4/IPv6, JWTs (`eyJ...`), basic auth URLs, connection strings
- [ ] High-entropy string detection (likely secrets/tokens)
- [ ] K8s-specific: env var values from pod specs, bearer tokens from headers
- [ ] Deterministic placeholders: `[EMAIL-1]`, `[IP-2]`, `[TOKEN-3]` (analysis stays coherent)
- [ ] `sanitize(input: &str) -> SanitizedText` with replacement map
- [ ] Configurable patterns via settings (enterprise users add custom regexes)
- [ ] Unit tests for each pattern type

### Task 2.3: Log preprocessor (4-stage pipeline)
- [ ] Create `src-tauri/src/ai/log_preprocessor.rs`
- [ ] **Stage 1 — ripgrep pre-filter** (`grep-regex` 0.1.11 crate, ripgrep's core as library):
  - Filter ERROR/WARN/OOMKill + ±3 context lines
  - 95% reduction, <1ms for 10K lines
- [ ] **Stage 2 — Dedup + time-window**: group identical patterns, focus last 5 min → ~100 lines
- [ ] **Stage 3 — BM25 ranking** (`tantivy` 0.25.0): rank remaining lines against user query → top 15
  - BM25 wins over semantic search for keyword-rich K8s logs (confirmed by research)
  - Semantic search (fastembed) only if users report recall problems later
- [ ] **Stage 4 — Context assembly**: sanitize (Task 2.2) → ~800 tokens for logs
- [ ] Critical errors at START of output (U-shaped recall in small models)
- [ ] Token counting: approximate char/4 or use `tiktoken-rs`
- [ ] For large logs (>100MB): use `memmap2` 0.9.9 + `memchr` for SIMD newline finding
- [ ] `preprocess(logs: &str, query: &str, max_tokens: usize) -> PreprocessedLogs`

### Task 2.4: K8s analyzers — deterministic decision trees (highest priority)
- [ ] Create `src-tauri/src/ai/analyzers/mod.rs` — trait + aggregator
- [ ] **Error classifier** using `aho-corasick` 1.1.4 (SIMD-accelerated multi-pattern matching):
  - Load ~150-250 K8s event reason strings (from kubelet, scheduler, controller-manager)
  - Single-pass classification of any text against all patterns
  - Then regex for parameter extraction (exit codes, image names)
- [ ] **12 decision trees covering ~86% of common K8s errors:**
  - `pod_analyzer.rs` — CrashLoopBackOff (→exit code→OOM→image→config), ImagePullBackOff, OOMKilled, Pending/FailedScheduling, Evicted, CreateContainerConfigError
  - `event_analyzer.rs` — Warning events scored by: recency ×3, severity ×5, keyword match ×4
  - `service_analyzer.rs` — No endpoints, selector mismatches
  - `node_analyzer.rs` — NotReady, DiskPressure, MemoryPressure, PIDPressure
  - `deployment_analyzer.rs` — Unavailable replicas, rollout stuck, image mismatch
  - `pvc_analyzer.rs` — Pending binding, capacity issues
  - `job_analyzer.rs` — Failed completions, backoff limit reached
  - `ingress_analyzer.rs` — Missing backend service, TLS cert issues
  - `hpa_analyzer.rs` — Misconfiguration, unable to scale
  - `probe_analyzer.rs` — Liveness/readiness failures
  - `dns_analyzer.rs` — Resolution failures
  - `volume_analyzer.rs` — Mount failures
- [ ] Each returns `Vec<AnalyzerFinding>` with severity, resource, message, **suggested_action**
- [ ] `run_all_analyzers(namespace)` — parallel via `tokio::try_join!` (3-4x faster than sequential)
- [ ] Cap at ≤800 tokens for LLM context
- [ ] **Key insight**: These are the core differentiator vs k8sgpt. k8sgpt is non-deterministic (different recommendations per run) and slow (Pod: 5.66s, Service: 38.58s). Our Rust analyzers: deterministic, consistent, <50ms.
- [ ] Unit tests per analyzer with mock K8s objects

### Task 2.5: Structured output — JSON schema + lazy grammars
- [ ] Create `src-tauri/src/ai/grammar.rs`
- [ ] Define JSON schemas for kubectl tool-call responses:
  ```json
  { "action": "get|describe|logs|apply|delete", "resource": "...", "namespace": "...", "args": [...] }
  ```
- [ ] Use llama-server's `--json-schema` for structured responses (auto-converted to GBNF internally)
- [ ] Implement **lazy grammar** triggering: model generates freely until tool-call trigger, then grammar constrains output
  - llama.cpp supports trigger types: TOKEN, WORD, PATTERN, PATTERN_FULL (since ~b4800+)
  - This enables natural reasoning → constrained tool output in one response
- [ ] **CRITICAL: Do NOT use `--reasoning-format deepseek` with JSON Schema** (Issue #20345)
  - Grammar enforcement is silently inactive when thinking is ON
  - Qwen3.5 wraps JSON in markdown fences when thinking → PEG parser rejects with 500 error
  - Qwen3.5-4B has thinking OFF by default → grammar works correctly without any special flags
  - If thinking mode is needed for complex analysis: use a separate request WITHOUT grammar, then parse the free-text response
- [ ] No kubectl GBNF grammars exist publicly — build custom schemas for Kubeli's tool-call format
  - Keep schemas shallow (avoid nested $ref) to minimize parsing edge cases
  - Model should produce JSON, convert to YAML in Kubeli's TypeScript layer (models perform worse with YAML output)
- [ ] Key insight: Grammar constraints guarantee 100% structural validity; fine-tuning provides semantic quality. **Combine both** — hybrid approach outperforms either alone (SLOT paper: 99.5% schema accuracy + 94.0% content similarity)
- [ ] WARNING: Extreme KV quantization (-ctk q4_0) degrades tool calling. Use q8_0 for keys.

### Task 2.6: System prompt + context builder (was 2.5)
- [ ] Create `src-tauri/src/ai/local_context_builder.rs`
- [ ] **Grounding is the #1 hallucination reduction technique** (research confirmed):
  - Pattern: "Here are the facts: [Analyzer-Output]. Explain to the user why pod X is in CrashLoopBackOff."
  - Suppresses model's internal knowledge in favor of provided context (ReDeEP paper)
  - Error rates drop from 14% → 2% with proper grounding
- [ ] System prompt under 300 tokens (tighter than before — every token counts)
- [ ] `build_local_context(cluster, namespace, findings, logs) -> Vec<ChatMessage>`
- [ ] **Context compression** (saves 40-60% per resource):
  - Strip: managedFields, uid, generation, enableServiceLinks, default dnsPolicy
  - Keep: image, resources.requests/limits, containerStatuses[].state, restartCount, probes, volumeMounts
- [ ] **Token budget (4K for Qwen3-4B default):**
  - System prompt: 200-300
  - Compressed pod spec: 300
  - Top 3 scored events: 150
  - Top 15 BM25-ranked log lines: 800
  - User query: 200
  - **Output reserve: 2,250-2,350** (enough for explanation + kubectl command)
- [ ] **Token budget (8K for Qwen3-4B with thinking):**
  - Same input + thinking budget ~500 tokens + output reserve ~3,000
- [ ] Mode routing:
  - Tool calls (kubectl, JSON output) → grammar-constrained, `/no_think` (temp 0.7, top_p 0.8)
  - Root cause analysis → free-text, thinking ON with budget 128-256 tokens
  - "Diagnose in 2-3 sentences, then provide the kubectl command"
  - **Place reasoning fields BEFORE answer fields in JSON schema** (Park et al. NeurIPS 2024)
- [ ] **Client-side context windowing** for multi-turn:
  - Keep system prompt + current K8s context + last 2 assistant responses
  - Summarize/drop older turns to stay within budget

### Task 2.6b: Post-processing pipeline
- [ ] Create `src-tauri/src/ai/post_processor.rs`
- [ ] **Hallucination detection**: Cross-reference all LLM-mentioned resource names against kube-rs reflector stores (`HashSet<String>` indexes for pods, services, namespaces, deployments). O(1) lookup.
  - If hallucinated name detected: warn user or auto-correct to closest match
- [ ] **kubectl dry-run validation**: `kube-rs PostParams { dry_run: true }` or `tokio::process::Command("kubectl", "--dry-run=server")`
  - If invalid: retry with error message appended to prompt (max 3 attempts)
  - Escalation: generate → validate → retry with error → retry with resource list → escalate to cloud
- [ ] **Confidence scoring** from logprobs API (`"logprobs": true` in /v1/chat/completions):
  - `confidence = exp(mean(token_logprobs))`
  - mean logprob < -2.0 → escalate to cloud LLM
  - resource-name token logprob < -5.0 → likely hallucinated
  - Show confidence indicator in UI: green/yellow/red

### Task 2.6c: Precomputed cluster summary (kube-rs reflectors)
- [ ] Create `src-tauri/src/ai/cluster_summary.rs`
- [ ] Background tokio task: recompute cluster health on every kube-rs watch event
  - Pure in-memory iteration over reflector stores — zero API calls
  - "3 pods unhealthy, 2 PVCs pending, 1 Node NotReady"
- [ ] Immediately available when user opens AI panel — no waiting
- [ ] Use `moka` 0.12.10 for diagnosis caching (lock-free, per-entry TTL):
  - CrashLoopBackOff diagnosis: TTL 30s
  - Node condition: TTL 5min
  - PVC status: TTL 10min
  - Invalidate on matching watch event

### Task 2.7: Provider routing (was 2.6)
- [ ] Update `ai_send_message` to check provider and delegate:
  - `AiProvider::Local` → LlamaManager
  - `AiProvider::Claude` / `AiProvider::Codex` → existing AgentManager
- [ ] Both emit same `AIEvent` enum — frontend stays unchanged
- [ ] Provider priority order from settings: try first, fallback to next
- [ ] Smart routing (optional): logs → local, complex questions → cloud

---

## Phase 3: Frontend

### Task 3.1: TypeScript types
- [ ] Create `src/lib/types/local-ai.ts`:
  ```typescript
  interface HardwareInfo { cpu: string; cores: number; ram_gb: number; gpu: string | null; vram_gb: number | null }
  interface ModelRecommendation { model_id: string; model_name: string; size_gb: number; estimated_tps: number; fit: "perfect" | "good" | "marginal"; reason: string }
  interface ModelStatus { installed: boolean; model_id?: string; version?: string; size_gb?: number; path?: string }
  interface ModelUpdate { version: string; size_bytes: number; release_notes: string }
  interface ModelDownloadProgress { stage: "downloading" | "verifying" | "complete" | "error"; downloaded?: number; total?: number; message?: string }
  interface LocalAiStatus { running: boolean; port?: number; model?: string; uptime_seconds?: number }
  type AiProvider = "local" | "claude" | "codex"
  ```

### Task 3.2: Tauri command bindings
- [ ] Create `src/lib/tauri/commands/ai-local.ts`
- [ ] Wrappers for all Tauri commands from Phase 1 + 2.1
- [ ] Type-safe with explicit return types
- [ ] Event listeners for `model-download` and `ai-session-*` events

### Task 3.3: Settings UI — Kubi-1 model section
- [ ] Create `src/components/features/settings/components/Kubi1ModelSection.tsx`
  - Hardware info display (CPU, RAM, GPU)
  - Recommended model with size and estimated speed
  - Download button with streaming progress bar
  - Disk-space / size warning before download when storage is tight
  - Model status: not installed / downloading / ready / update available
  - Update notification with release notes and one-click update
  - Delete model option
- [ ] Create `src/components/features/settings/components/ModelDownloadProgress.tsx`
  - Progress bar with percentage and MB downloaded
  - Cancel button
  - Error state with retry

### Task 3.4: Settings UI — Provider priority
- [ ] Create `src/components/features/settings/components/ProviderPriorityList.tsx`
  - Drag-to-reorder with `@dnd-kit` (already installed)
  - Status badge per provider: Ready / Not Installed
  - Smart routing checkbox
- [ ] Store priority order in `ui-store.ts` (persisted)

### Task 3.5: Settings UI — Advanced / Ollama fallback
- [ ] Checkbox: "Use external Ollama instead of built-in engine"
- [ ] When checked: show host input field (default `http://127.0.0.1:11434`)
- [ ] Test connection button
- [ ] This is for power users who run Ollama with custom models

### Task 3.5b: Settings UI — AI Resource Management
- [ ] **Auto-unload timer**: dropdown (2 min / 5 min / 10 min / 30 min / Never) — default 5 min
  - "Never" = keep model loaded for instant response (power users, 32GB+ RAM)
- [ ] **Keep AI loaded**: toggle (default OFF)
  - OFF: Model unloads after idle timer → App uses ~200MB
  - ON: Model stays in RAM → App uses ~3GB but instant AI response
- [ ] KV Cache Type: dropdown (auto / f16 / q8_0 / turbo3) — default "auto" (v2)
- [ ] Context Length: dropdown (auto / 4K / 8K / 16K / 32K) — default "auto"
- [ ] Flash Attention: dropdown (auto / on / off) — default "auto"
- [ ] mlock toggle: "Keep model in RAM (prevent swapping)" — default off
- [ ] **RAM usage display** in settings: "Aktuell: Kubeli 180MB + Kubi-1 nicht geladen"

### Task 3.6: Store changes
- [ ] Extend `src/lib/stores/ui-store.ts`:
  ```typescript
  localModelId: string | null
  providerPriority: AiProvider[]  // default ["local", "claude", "codex"]
  smartRouting: boolean           // default true
  useExternalOllama: boolean      // default false
  ollamaHost: string              // default "http://127.0.0.1:11434"
  ```
- [ ] Extend `src/lib/stores/ai-store/types.ts`:
  - Add `activeProvider: AiProvider | null`

### Task 3.7: Provider badge + AI panel (streaming UX)
- [ ] Update `ProviderBadge.tsx`: add "Kubi-1" with blue badge
- [ ] Update `useLogAnalysis` hook: check local AI availability alongside CLI
- [ ] Route: preprocessor → sanitizer → context builder → LlamaManager
- [ ] **Streaming UX via Tauri Channels** (NOT Tauri Events — Events are not optimized for low latency):
  - Use `tauri::ipc::Channel` for ordered, fast data delivery
  - Phase 1 (<50ms): Deterministic analyzer results appear instantly
  - Phase 2 (~200-500ms): LLM first token streams via SSE
  - Phase 3: LLM tokens continue streaming
  - User sees content within <1s even with 2-3s total generation time
- [ ] Confidence indicator: green/yellow/red based on logprobs score
- [ ] "Unsicher? Mit Claude analysieren" button when confidence is low

### Task 3.8: i18n
- [ ] Add ~30 translation keys to EN and DE:
  - `settings.ai.kubi1.*` (model section)
  - `settings.ai.providerPriority.*`
  - `settings.ai.advanced.*` (Ollama fallback)
  - `ai.localModelUnavailable`, `ai.downloadingModel`, `ai.analyzingChunk`

### Task 3.9: First-launch experience (with compatibility scoring)
- [ ] Implement **Msty-style Model Compatibility Score** before download:
  - Run `llama-fit-params` or `--fit` estimation logic to calculate fit
  - Display percentage: "98% compatible — runs great on your hardware"
  - Hover/expand: show RAM available, model size, estimated speed, context window
  - Color: green (>80%), yellow (50-80%), red (<50%)
- [ ] **Jan-style guided onboarding** with single recommended model:
  - Auto-detect hardware → recommend best Kubi tier (Nano/Standard/Pro)
  - "Download Kubi-1 (2.7 GB) to analyze logs locally, no internet needed."
  - Show compatibility score + estimated tok/s
  - [Download] [Use Cloud AI Instead]
- [ ] **LM Studio-style hardware details** in Settings > AI > Advanced:
  - GPU name, available VRAM/RAM, Metal/CUDA status
  - For power users who want to override auto-detection
- [ ] After download: "Kubi-1 is ready. Your cluster data stays on this device."
- [ ] If update available: subtle banner in AI panel header

---

## Phase 4: Training data collection

### Task 4.1: Setup training environment
- [ ] Install Tailscale on Windows RTX 3090 machine
- [ ] Install Tailscale in WSL2: `curl -fsSL https://tailscale.com/install.sh | sh && tailscale up`
- [ ] Add SSH config entry on Mac: `Host kubi-train` → Tailscale IP
- [ ] Verify: `ssh kubi-train "nvidia-smi"` works from Mac
- [ ] Install Unsloth on Windows: `uv pip install "unsloth[cu121]"`
- [ ] Create versioned `.dev/kubi-1/data/test_setup.py` for CUDA + model-load verification
- [ ] Run `.dev/kubi-1/data/test_setup.py` to verify CUDA + Unsloth

### Task 4.2: Download HuggingFace datasets (expanded from research)
- [ ] **Tier 1 — Critical** (add to `load_hf_datasets.py`):
  - `substratusai/the-stack-yaml-k8s` — 277K real-world K8s YAML files (~40M+ tokens for CPT)
  - `ibm-research/ITBench-Trajectories` — 105 agent trajectories, fault-injected K8s scenarios
  - `ibm-research/ITBench-Lite` — 50 SRE+FinOps scenarios with ground truth
  - `MCP-1st-Birthday/smoltrace-kubernetes-tasks` — K8s agent tasks with ReAct traces
  - `mcipriano/stackoverflow-kubernetes-questions` — ~30K real Q&A
  - `ComponentSoft/k8s-kubectl-35k` — ~35K kubectl examples
- [ ] **Tier 2 — Valuable**:
  - `saidsef/tech-docs` — 251 K8s + 60 ArgoCD + 33 Istio + 33 Cilium docs
  - `HuggingFaceTB/stackexchange_2025_md` — filter for kubernetes/helm/kubectl tags
  - `Salesforce/xlam-function-calling-60k` — function-calling format reference
  - `NousResearch/hermes-function-calling-v1` — Hermes tool-calling (Qwen3 native format)
  - `Jofthomas/hermes-function-calling-thinking-V1` — thinking + tool-calling
- [ ] Verify each dataset: check schema, count rows, spot-check quality
- [ ] Document license status for each

### Task 4.3: Clone GitHub repos (expanded)
- [ ] Run `./clone_repos.sh --all`
- [ ] **New repos to add** (identified by research):
  - `kubernetes/enhancements` (KEPs) — ~10M tokens, deep K8s design knowledge
  - `bitnami/charts` — ~20M+ tokens, production Helm values.yaml
  - `kubernetes/kubernetes` (selective: events/API/E2E tests) — ~5-10M tokens
  - CKA/CKAD exercise repos (4+) — ~650K tokens, directly convertible to Q&A
  - `IBM/ITBench` + `ITBench-Scenarios` — 94 fault-injection scenarios
  - `learnk8s` organization — troubleshooting flowcharts
  - `kubernetes-sigs/kwok` docs — cluster simulation examples
- [ ] Existing: kubernetes/website, k8sgpt, kubectl, practical-k8s
- [ ] Check total size — target: **70M+ raw CPT tokens** (up from 40M)

### Task 4.4: Harvest via GitHub API (smaller repos)
- [ ] Generate GitHub personal access token
- [ ] Run `GITHUB_TOKEN=ghp_xxx python harvest_k8s.py --tier 1`
- [ ] Run `GITHUB_TOKEN=ghp_xxx python harvest_k8s.py --tier 2`
- [ ] Check rate limit usage

### Task 4.5: Convert to instruction pairs (ChatML + Hermes format)
- [ ] Run `python convert_docs.py`
- [ ] **Format: ChatML with Hermes tool-calling** (Qwen3 native):
  - System message with `<tools>` XML definitions
  - Assistant with `<tool_call>{"name": "kubectl_get", "arguments": {...}}</tool_call>`
  - Tool role with `<tool_response>` containing results
- [ ] **Mix: ~60% multi-turn, ~40% single-turn**
- [ ] **System prompt in ~90% of examples** (60% standard K8s, 30% with tool defs, 10% none)
- [ ] Use `train_on_responses_only()` in Unsloth to mask user/system turns
- [ ] Spot-check 20 random pairs per file for quality

### Task 4.5b: DEITA quality scoring (highest ROI quality upgrade)
- [ ] Install `distilabel` (Argilla) for DEITA pipeline
- [ ] Score all instruction pairs with `hkust-nlp/deita-quality-scorer` + `deita-complexity-scorer`
- [ ] Add K8s-specific correctness: YAML parsing, kubectl syntax check, API reference verification
- [ ] Filter to top quality — **10K expert-curated > 100K unfiltered** (AlpaGasus, LIMA papers)
- [ ] Target: 20K-30K highest-quality pairs (down from 55K raw)

### Task 4.5c: Semantic dedup (replaces MD5)
- [ ] Install `text-dedup` (ChenghaoMou/text-dedup) or `SemHash` (MinishLab/semhash)
- [ ] Embed with `sentence-transformers/all-MiniLM-L6-v2`
- [ ] Cluster → pairwise cosine → keep most unique per group
- [ ] Expected: ~30-50% reduction with better diversity (SemDeDup paper, ICLR 2024)

### Task 4.5d: Data contamination check
- [ ] 13-gram overlap between train and eval sets
- [ ] `SemHash` cross-dataset mode for semantic contamination
- [ ] Run before every training — if contaminated, eval metrics are meaningless

### Task 4.6: Generate refusal training data
- [ ] Run `python generate_refusals.py --count 5000`
- [ ] Review sample: non-K8s questions get polite decline, K8s-adjacent get scoped help
- [ ] Check output: `data/processed/refusals.jsonl`

### Task 4.7: Synthetic data generation (expanded)
- [ ] **YAML mutation engine** (10 mutation categories):
  - Type errors, missing required fields, invalid enum values, indentation errors
  - Selector/label mismatches, DNS name violations, duplicate port mappings
  - Deprecated API versions, security issues (root), logical errors (probe timeout loops)
  - **Multi-resource stacks**: Deploy+Service+Ingress+ConfigMap+Secret+HPA+PDB+NetworkPolicy
  - Validate with `kubeconform` + `kube-score`
  - Target: ~5K error→fix pairs (up from 3K)
- [ ] **Evol-Instruct pipeline** (complexity evolution):
  - "Create a Deployment" → "Create multi-container Deployment with init containers, resource limits, probes, and PDB, then troubleshoot Pending"
  - 3-4 evolution rounds per seed instruction
  - Target: ~10K evolved instructions
- [ ] **Magpie generation** (seed-free from aligned LLM with K8s system prompt):
  - Use Qwen3-8B as teacher (or Qwen3-235B-A22B if available via API)
  - **Do NOT use Claude/GPT-4 as teacher** — violates ToS (Anthropic Feb 2026 enforcement)
  - Target: ~10K diverse instructions
- [ ] Quality filter all synthetic data with DEITA scorers + kubeconform

### Task 4.8: Merge, filter, split
- [ ] Run `python merge_and_filter.py`
- [ ] Pipeline: semantic dedup (4.5c) → DEITA quality scoring (4.5b) → contamination check (4.5d) → source balancing → split
- [ ] Verify train/eval split (90/10)
- [ ] Output: `data/final/kubeli-k8s-train.jsonl` + `kubeli-k8s-eval.jsonl`
- [ ] Target: **20K-30K high-quality pairs** (quality > quantity — DEITA filtered)

### Task 4.9: Prepare CPT corpus (CRITICAL: expand from 40M to 200M+ tokens)
- [ ] Run `python prepare_cpt_corpus.py`
- [ ] **40M tokens is dangerously insufficient** (0.01 tokens/param, need 0.4-4.3)
- [ ] New target: **70M+ raw tokens** from expanded sources:
  - `substratusai/the-stack-yaml-k8s` (~40M+ tokens)
  - `kubernetes/enhancements` KEPs (~10M tokens)
  - `bitnami/charts` (~20M+ tokens)
  - Existing: kubernetes/website, k8sgpt, SO answers (~40M tokens)
- [ ] **Data mix: 70-80% K8s + 20-30% general replay** (SlimPajama sample)
  - General replay prevents catastrophic forgetting of language/reasoning
  - Smaller models have lower Critical Mixture Ratio (arXiv:2407.17467)
- [ ] **Multi-epoch: 5-10 epochs** over corpus = 350M-700M effective token exposure
- [ ] Output: `data/final/cpt_corpus.jsonl`

### Task 4.10: Optional data tooling eval
- [ ] Try Unsloth Studio on the Windows box for one end-to-end dry run
- [ ] Evaluate Unsloth Data Recipes against the scripted pipeline on a small sample
- [ ] Document whether either tool materially improves quality or throughput before adopting it

---

## Phase 5: Training — Continued Pretraining (CPT)

### Task 5.1: CPT on Qwen3-4B-Base
- [ ] Upload CPT corpus to Windows: `rsync -avz data/final/cpt_corpus.jsonl kubi-train:~/kubi-training/data/`
- [ ] Write `training/train_cpt.py`:
  - Load `unsloth/Qwen3-4B-Base` (BASE model, not Instruct)
  - **bf16 LoRA** (NOT QLoRA 4-bit — Qwen3.5/DeltaNet has "higher than normal quantization differences", Unsloth explicitly warns against QLoRA for these architectures)
  - LoRA rank 128, target all linear layers + `lm_head` + `embed_tokens`
  - rsLoRA enabled, alpha=32
  - `learning_rate=5e-5`, `embedding_learning_rate=5e-6` (10x smaller)
  - **5-10 epochs** over CPT corpus (multi-epoch compensates for QLoRA's lower knowledge absorption vs full FT, arXiv:2405.09673)
  - **Data mix: 70-80% K8s + 20-30% general replay** (SlimPajama sample) to prevent catastrophic forgetting
  - Gradient checkpointing "unsloth"
  - Save adapter: `kubi1-cpt-adapter/`
- [ ] VRAM budget (bf16 LoRA on RTX 3090 24GB):
  - Model bf16: ~8GB, LoRA adapters: ~1GB, Optimizer: ~2GB, Activations: ~6-8GB
  - Total: ~17-19GB — fits on RTX 3090 but tighter than QLoRA. Reduce batch to 2 if needed.
- [ ] Run CPT: `ssh kubi-train "cd ~/kubi-training/training && python train_cpt.py"`
- [ ] Monitor loss curve — should decrease steadily
- [ ] Estimated time: ~8-16 hours on RTX 3090 (5-10 epochs over 70M+ tokens, increased from 2-4h)

### Task 5.2: CPT on Qwen3-1.7B-Base (Nano)
- [ ] Same pipeline with `unsloth/Qwen3-1.7B-Base`
- [ ] bf16 LoRA fits easily (~5GB model)
- [ ] Save adapter: `kubi1-nano-cpt-adapter/`

### Task 5.3: CPT on Qwen3-8B-Base (Pro)
- [ ] Same pipeline with `unsloth/Qwen3-8B-Base`
- [ ] bf16 LoRA: ~16GB model — **tight fit on RTX 3090**. Options:
  - Reduce batch to 1, grad_accum=16
  - Or use gradient checkpointing aggressive mode
  - Or fallback to QLoRA for 8B only (standard transformer, not DeltaNet)
- [ ] Save adapter: `kubi1-pro-cpt-adapter/`

---

## Phase 6: Training — SFT + Refusal

### Task 6.1: SFT on Kubi-1 (4B)
- [ ] Upload SFT dataset: `rsync -avz data/final/kubeli-k8s-train.jsonl kubi-train:~/kubi-training/data/`
- [ ] Update `training/train_kubi1.py`:
  - Load from CPT adapter (`kubi1-cpt-adapter/`)
  - **Do NOT call `get_peft_model()` again** — loads overlapping LoRA layers. Load saved adapter directly.
  - QLoRA, **rank 32** (increased from 16 — more headroom for structured K8s JSON/YAML output)
  - Standard target modules (no lm_head/embed_tokens needed for SFT)
  - batch=4, grad_accum=4, epochs=2, lr=2e-4, linear LR schedule, 5% warmup
  - seq_length=4096 (matches inference context budget)
  - `train_on_responses_only()` — mask user/system turns
- [ ] Run SFT
- [ ] Save merged model: `kubi1-sft/`

### Task 6.2: SFT on Kubi-1 Nano (1.7B)
- [ ] Same pipeline from `kubi1-nano-cpt-adapter/`
- [ ] bf16 LoRA, batch=8 (plenty of room at 1.7B)
- [ ] May need 3 epochs (smaller model, needs more passes)

### Task 6.3: SFT on Kubi-1 Pro (8B)
- [ ] Same pipeline from `kubi1-pro-cpt-adapter/`
- [ ] 2 epochs, batch=1, grad_accum=16 (bf16 LoRA tight on 8B)
- [ ] QLoRA acceptable fallback for 8B (standard Qwen3 arch, not DeltaNet)

### Task 6.4: Export all models to GGUF
- [ ] Export Kubi-1 (4B): **Unsloth Dynamic 2.0 UD-Q4_K_M** (default, best quality/size)
- [ ] Export Kubi-1 Nano (1.7B): UD-Q4_K_M + Q8_0 (small enough for Q8)
- [ ] Export Kubi-1 Pro (8B): UD-Q4_K_M + UD-Q5_K_M
- [ ] Dynamic 2.0 is the new standard — per-layer calibrated quantization on 1.5M+ tokens, includes ARM/Apple Silicon optimized formats (Q4_NL, Q5.1)
- [ ] If fine-tuned: export via Unsloth (which applies Dynamic 2.0 automatically)
- [ ] If shipping base Qwen3.5-4B without fine-tuning: use pre-quantized `unsloth/Qwen3.5-4B-GGUF` directly
- [ ] Create optional Ollama Modelfile for each with baked-in system prompt (compatibility path only)
- [ ] Record checksums, sizes, and artifact metadata for `registry.json`
- [ ] Pull GGUFs to Mac: `rsync -avz kubi-train:~/kubi-training/training/*.gguf models/`

### Task 6.5: GRPO for tool-calling quality (recommended, not optional)
- [ ] GRPO fits on RTX 3090: Unsloth reduces logit memory 8x (~9.8GB for 8 generations)
- [ ] **K8s-specific reward functions** (rubric of verifiable rewards):
  - JSON validity: `json.loads()` → 0/1
  - YAML validity: `yaml.safe_load()` → 0/1
  - kubectl syntax: regex against valid subcommands → 0/1
  - K8s resource grounding: check resource type references → 0/1
  - Format structure: `<think>`/`<tool_call>` tags present → 0/1
- [ ] Config: QLoRA rank 16, lr=5e-6, linear schedule, 10% warmup
  - `num_generations=4` (try 8 if VRAM allows)
  - Minimum **500 steps** for convergence (Predibase recommendation)
  - Curriculum: format-only rewards for ~200 steps, then add correctness checks
- [ ] Compare GRPO result against plain SFT on eval set

---

## Phase 7: Evaluation

### Task 7.1: Create eval test set
- [ ] Write 500 test cases in `.dev/kubi-1/eval/test_cases/`:
  - `error_diagnosis.jsonl` — 150 cases (CrashLoopBackOff, OOM, ImagePull, Pending, Evicted, FailedScheduling)
  - `kubectl_generation.jsonl` — 100 cases (create, scale, debug, rollout, patch, delete)
  - `yaml_debugging.jsonl` — 100 cases (broken manifests with specific errors)
  - `networking.jsonl` — 75 cases (service selectors, ingress, DNS, network policies)
  - `rbac.jsonl` — 75 cases (permission denied, role bindings, service accounts)
- [ ] Each case: instruction, expected output format, grading criteria

### Task 7.2: Write eval script
- [ ] Create `.dev/kubi-1/eval/eval.py`:
  - Run test set against model via llama-server API
  - Score per metric:
    - JSON validity (is output parseable JSON?)
    - kubectl syntax (is suggested command valid?)
    - Resource grounding (no hallucinated pod/service names)
    - Error category accuracy (right diagnosis?)
    - Fix quality (does suggestion address the problem?)
  - Aggregate by category
  - Output: markdown report in `eval/results/`

### Task 7.3: Baseline eval
- [ ] Run eval on raw Qwen3-4B + system prompt (no fine-tuning) → baseline scores
- [ ] Save: `eval/results/baseline-qwen3-4b.md`

### Task 7.4: Kubi-1 eval
- [ ] Run eval on each Kubi-1 model (Nano, Standard, Pro)
- [ ] Compare against baseline
- [ ] Save: `eval/results/kubi1-nano.md`, `kubi1-standard.md`, `kubi1-pro.md`

### Task 7.5: Refusal eval
- [ ] Test 50 non-K8s questions → model should decline all
- [ ] Test 50 K8s-adjacent questions → model should scope to K8s context
- [ ] Test 50 K8s questions → model should answer normally
- [ ] Target: >95% correct behavior

### Task 7.6: Dual-model validation
- [ ] **Qwen3-4B vs Qwen3.5-4B head-to-head** on K8s eval set:
  - Qwen3-4B WITH thinking + grammar vs Qwen3.5-4B WITHOUT thinking + grammar
  - Confirm hypothesis: Qwen3-4B + thinking wins on structured reasoning (diagnosis, YAML debugging)
  - Confirm hypothesis: Qwen3.5-4B wins on long-context single-shot (full log analysis)
  - Measure actual multi-turn latency: Qwen3-4B (instant) vs Qwen3.5-4B (reprocessing)
  - Test Router Mode switching: latency of model swap on M3/M4
- [ ] **Qwen3.5-4B thinking mode verification** (if Issue #20345 fix confirmed):
  - Test grammar + thinking combined on latest llama.cpp build
  - If working: Qwen3.5-4B becomes viable for ALL modes → may simplify to single-model
  - If still broken: dual-model architecture confirmed as necessary
- [ ] Evaluate `Gemma 4 26B-A4B` as Kubi-1 Ultra candidate
  - Test with `unsloth/gemma-4-26B-A4B-it-GGUF` UD-IQ4_XS (13.4 GB) on 32GB Mac
  - Test with TurboQuant KV cache (TheTom PR #52 when merged)
  - Note: MoE QLoRA not recommended — Ultra may ship without fine-tuning
- [ ] Evaluate `Gemma 4 E4B` as potential Kubi-1 Deep replacement
  - Dense 4B, no DeltaNet reprocessing, 128K context, vision
  - If it matches Qwen3.5-4B quality: simpler architecture, no reprocessing
- [ ] Write decision note: confirm dual-model vs. single-model for v2

---

## Phase 8: Distribution

### Task 8.1: Upload models
- [ ] Create HuggingFace repo: `kubeli/kubi-1`
- [ ] Upload GGUFs: kubi-1-nano, kubi-1, kubi-1-pro (Q4_K_M + Q5_K_M each)
- [ ] Write model card: architecture, training data, benchmarks, license

### Task 8.2: Create registry.json
- [ ] Define model entries with version, SHA-256, download URLs, min_app_version
- [ ] Host on GitHub repo (raw.githubusercontent.com)
- [ ] Kubeli fetches this to check for model updates

### Task 8.3: Ollama registry (optional)
- [ ] Publish to Ollama library: `kubeli/k8s:nano`, `kubeli/k8s:4b`, `kubeli/k8s:pro`
- [ ] For users who prefer Ollama over built-in sidecar

### Task 8.4: Licensing and release metadata
- [ ] Capture dataset and model license notes in release docs / model card
- [ ] If any non-Apache model candidate is promoted, include required attribution and redistribution text

---

## Phase 9: CI/CD

### Task 9.1: Sidecar in app build
- [ ] Add `scripts/fetch-llama-server.sh` step to GitHub Actions build workflow
- [ ] Fetch correct binary per build target (macOS ARM, macOS Intel, Windows, Linux)
- [ ] Verify sidecar is included in built app bundle

### Task 9.2: Model release pipeline
- [ ] Create `.github/workflows/release-model.yml`:
  - Manual trigger with version input
  - Compute SHA-256 of GGUFs
  - Upload to HuggingFace
  - Create GitHub Release with GGUF attached
  - Update registry.json and commit
  - Validate registry metadata against the produced artifacts before publishing

### Task 9.3: Monthly retrain automation (future)
- [ ] GitHub Action: re-harvest K8s docs (latest), re-train, publish new model version
- [ ] Triggered monthly or on demand

---

## Conventions

### Rust

- All commands return `Result<T, KubeliError>`, never `Result<T, String>`
- Use `KubeliError::new(ErrorKind::X, "message").with_suggestions(vec![...])`
- Error kinds: `Network`, `NotFound`, `ServerError`, `Timeout`, `Integrity`, `Spawn`
- Shared state: `Arc<RwLock<T>>` or `Arc<AtomicBool>` for stop flags
- Register managers in `src-tauri/src/app/state.rs` with `.manage()`
- Follow `LogStreamManager` / `ShellSessionManager` pattern
- Streaming: `tokio::spawn` + `app.emit()` with existing `AIEvent` enum
- Register commands in `src-tauri/src/app/command_registry/mod.rs`

### Frontend

- Tauri command wrappers in `src/lib/tauri/commands/` with `invoke<T>()`
- Events via `listen<T>()` from `@tauri-apps/api/event`, store unlisten for cleanup
- Zustand: action slice pattern `createXActions(set, get)`
- Settings: `SettingSection` wrapper, `persist` middleware
- Testing: Jest with `jest.doMock` for Tauri invoke

### Training

- All scripts in `.dev/kubi-1/`
- Python scripts runnable standalone (no framework dependency beyond Unsloth)
- Remote training via `training/remote_train.sh`
- Checkpoints saved every 200 steps with `save_total_limit=3`

---

## New files summary

### Rust backend (`src-tauri/src/ai/`)
```
llama_manager.rs           # Sidecar lifecycle, chat streaming
model_manager.rs           # Download, verify, update models
hardware.rs                # llmfit-core hardware detection
sanitizer.rs               # Strip secrets before LLM sees data
log_preprocessor.rs        # Filter → dedup → sanitize → chunk
local_context_builder.rs   # Short system prompt + K8s context
analyzers/
  mod.rs                   # Trait + aggregator
  pod_analyzer.rs
  event_analyzer.rs
  service_analyzer.rs
  node_analyzer.rs
  deployment_analyzer.rs
  pvc_analyzer.rs
  job_analyzer.rs
  ingress_analyzer.rs
```

### Frontend
```
src/lib/types/local-ai.ts
src/lib/tauri/commands/ai-local.ts
src/components/features/settings/components/Kubi1ModelSection.tsx
src/components/features/settings/components/ModelDownloadProgress.tsx
src/components/features/settings/components/ProviderPriorityList.tsx
```

### Build / CI
```
scripts/fetch-llama-server.sh
.github/workflows/release-model.yml  (future)
src-tauri/binaries/.gitignore
```

### Training (`.dev/kubi-1/`)
```
data/harvest_k8s.py
data/load_hf_datasets.py
data/clone_repos.sh
data/convert_docs.py
data/generate_refusals.py
data/test_setup.py
data/generate_synthetic.py           (to write)
data/prepare_cpt_corpus.py
data/merge_and_filter.py
training/train_cpt.py                (to write)
training/train_kubi1.py
training/remote_train.sh
eval/eval.py                         (to write)
eval/test_cases/*.jsonl              (to write)
```

### Modified files

| File | Change |
|------|--------|
| `src-tauri/Cargo.toml` | Add `llmfit-core`, `tauri-plugin-shell`, remove `ollama-rs` |
| `src-tauri/tauri.conf.json` | Add `externalBin: ["binaries/llama-server"]` |
| `src-tauri/capabilities/default.json` | Add sidecar execute permission |
| `src-tauri/src/ai/agent_manager.rs` | Rename enum, add Local variant, delegate to LlamaManager |
| `src-tauri/src/ai/mod.rs` | Register new modules |
| `src-tauri/src/app/state.rs` | Register LlamaManager + ModelManager |
| `src-tauri/src/app/command_registry/mod.rs` | Add new commands |
| `src/lib/tauri/commands/ai.ts` | Rename type, add local commands |
| `src/lib/tauri/commands/ai-local.ts` | Add local model command wrappers |
| `src/lib/stores/ui-store.ts` | Add provider priority, local model settings |
| `src/lib/stores/ai-store/types.ts` | Add activeProvider |
| `src/components/features/ai/components/ProviderBadge.tsx` | Add "Kubi-1" badge |
| `src/components/features/settings/components/AiTab.tsx` | Add Kubi-1 section + provider priority |
| `src/components/features/logs/hooks/useLogAnalysis.ts` | Check local AI, route through pipeline |
| i18n EN + DE files | Add ~30 keys |
| `.github/workflows/build.yml` | Add fetch-llama-server step |

### Existing infrastructure (no changes needed)

| What | Where |
|------|-------|
| Log analysis button | `AIButton.tsx` in logs toolbar |
| Log analysis hook | `useLogAnalysis.ts` |
| PendingAnalysis flow | ai-store types + actions |
| AI event handler | `useAIEvents.ts` |
| Drag and drop | `@dnd-kit/sortable` |
| Settings persistence | Zustand persist in ui-store |
| Session storage (SQLite) | `session_store.rs` |
| CSP / Tauri permissions | No changes (Rust-proxied) |

---

## Model architecture: Dual-Model with Router Mode

> **Key insight**: Qwen3-4B + Thinking + Grammar beats Qwen3.5-4B without Thinking
> on K8s reasoning tasks. Both models ship together in a dual-model architecture.

### Shipped models (v1)

| Name | Base | Architecture | GGUF | RAM | Mode | Role |
|------|------|-------------|------|-----|------|------|
| Kubi-1 Nano | Qwen3-1.7B | Transformer | ~1.2 GB | 8 GB+ | Thinking + Grammar | Minimal tier |
| **Kubi-1** | **Qwen3-4B** | **Transformer** | **~2.5 GB** | **16 GB+** | **Thinking + Grammar** | **Default: multi-turn chat, tool calling** |
| Kubi-1 Deep | Qwen3.5-4B | DeltaNet Hybrid | ~2.86 GB | 16 GB+ | No thinking, no grammar | Single-shot analysis, vision, long context |
| Kubi-1 Pro | Qwen3-8B | Transformer | ~5 GB | 32 GB+ | Thinking + Grammar | Quality upgrade |

**Default download**: Kubi-1 (2.5 GB) + Kubi-1 Deep (2.86 GB) = **5.36 GB total**

### Why dual-model (not Qwen3.5-4B only)

| Factor | Qwen3-4B (default) | Qwen3.5-4B (deep) |
|--------|--------------------|--------------------|
| Thinking + Grammar | **Both combined** | Mutually exclusive (Issue #20345) |
| MATH-500 (with thinking) | **95.2%** | ~40-50% (thinking off, estimated) |
| MMLU-Pro (with thinking) | **74.0%** | ~68-72% (thinking off, estimated) |
| Multi-turn latency | **Zero reprocessing** | 4-8s/turn at 4K (DeltaNet) |
| TurboQuant benefit | **100% of layers** | ~25% (only attention layers) |
| Tool calling (TAU2) | Not published | **79.9%** |
| Context | 32K | **262K** |
| Vision | No | **Yes** |
| Fine-tuning | **QLoRA (~6-8GB VRAM)** | bf16 LoRA (~10GB VRAM) |

### Router Mode switching logic

```
User query → classify:
  - Tool call (kubectl, JSON output) → Qwen3-4B + thinking + grammar
  - Quick K8s question (multi-turn) → Qwen3-4B + thinking + grammar
  - Long log analysis (>4K tokens) → Qwen3.5-4B single-shot
  - Screenshot/image analysis → Qwen3.5-4B (vision)
  - User clicks "Deep Analysis" → Qwen3.5-4B explicitly
```

Both models can be loaded simultaneously (~6.5 GB unified memory on Apple Silicon).
Model swap time: ~1-3 seconds cold start if only one loaded at a time.

### v2 additional tiers

| Candidate | Role | Status |
|-----------|------|--------|
| Gemma 4 26B-A4B | "Ultra" tier for 32GB+ users | v2 eval — 82.6% MMLU Pro, 17GB download |
| Gemma 4 E4B | Potential Kubi-1 Deep replacement | v2 eval — dense 4B, 128K, vision |

## Rust dependencies

```toml
[dependencies]
# AI & inference
llmfit-core = "0.7"
tauri-plugin-shell = "2"

# K8s analyzers & log processing
aho-corasick = "1.1"           # SIMD multi-pattern K8s error classification
grep-regex = "0.1"             # Ripgrep core as library (log pre-filter)
grep-searcher = "0.1"          # Ripgrep searcher
tantivy = "0.25"               # BM25 log ranking

# Caching
moka = { version = "0.12", features = ["future"] }  # In-memory TTL cache (lock-free)
redb = "3.1"                   # Persistent embedded DB (future: embeddings)

# Performance
memmap2 = "0.9"                # Memory-mapped large log files
memchr = "2"                   # SIMD newline finding
lasso = "0.7"                  # String interning for resource names

# ollama-rs removed — replaced by direct HTTP to llama-server
```

### Bundle size impact

- llama-server sidecar binary: +10-15 MB per platform
- llmfit model database: +3-5 MB
- Total: +13-20 MB to app bundle
- Acceptable — the model GGUF (~2.5 GB) dwarfs this

### Feature flag (optional)

```toml
[features]
default = ["local-ai"]
local-ai = ["dep:llmfit-core"]
```
