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
- [ ] Download pre-built llama-server from llama.cpp releases (pin version, currently b8530)
- [ ] Document v1 binary strategy: ship default CPU/Metal-compatible targets first, keep CUDA/Vulkan packaging as follow-up
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
  - Pass model path, context size (8192), thread count, `--flash-attn`, `--cont-batching`
  - Health check loop: `GET /health` every 1s, timeout after 30s
- [ ] `stop()` — kill sidecar child process
- [ ] `chat()` — `POST /v1/chat/completions` with streaming
  - Parse SSE stream, emit `AIEvent::Token`, `AIEvent::Done`, `AIEvent::Error`
  - Reuse existing `AIEvent` tagged enum so frontend needs zero changes
- [ ] `is_running()` — check if sidecar process is alive + health endpoint responds
- [ ] Lazy start: only launch sidecar on first AI request, not on app startup
- [ ] Auto-stop after 5 min idle (configurable, save resources)
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
  - `ram >= 24GB` → Kubi-1 Pro (Qwen3-8B, ~5GB)
- [ ] Keep research candidates (`Qwen3.5-4B`, `Qwen3-30B-A3B`, `Nemotron-3-Nano-4B`) out of default recommendations until eval is complete
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

### Task 2.3: Log preprocessor
- [ ] Create `src-tauri/src/ai/log_preprocessor.rs`
- [ ] Step 1 — **Filter**: regex for ERROR/WARN/FATAL + ±3 context lines (80-95% reduction)
- [ ] Step 2 — **Deduplicate**: group identical patterns, emit one line + count
- [ ] Step 3 — **Sanitize**: pipe through Task 2.2
- [ ] Step 4 — **Chunk**: if exceeds token budget (4,652 tokens), split for map-reduce (max 5 chunks)
- [ ] Critical errors at START of output (U-shaped recall in small models)
- [ ] Token counting: approximate char/4 or use `tiktoken-rs`
- [ ] `rayon` for parallel processing on large log sets
- [ ] `preprocess(logs: &str, max_tokens: usize) -> PreprocessedLogs`

### Task 2.4: K8s analyzers (k8sgpt pattern)
- [ ] Create `src-tauri/src/ai/analyzers/mod.rs` — trait + aggregator
- [ ] `pod_analyzer.rs` — CrashLoopBackOff, ImagePullBackOff, OOMKilled, Pending, Evicted
- [ ] `event_analyzer.rs` — Warning events from last 30 min (FailedScheduling, FailedMount, Unhealthy)
- [ ] `service_analyzer.rs` — No endpoints, selector mismatches
- [ ] `node_analyzer.rs` — NotReady, DiskPressure, MemoryPressure, PIDPressure
- [ ] `deployment_analyzer.rs` — Unavailable replicas, rollout stuck, image mismatch
- [ ] `pvc_analyzer.rs` — Pending binding, capacity issues
- [ ] `job_analyzer.rs` — Failed completions, backoff limit reached
- [ ] `ingress_analyzer.rs` — Missing backend service, TLS cert issues
- [ ] Each returns `Vec<AnalyzerFinding>` with severity, resource, message
- [ ] `run_all_analyzers(namespace)` → aggregate, cap at ≤800 tokens
- [ ] Unit tests per analyzer with mock K8s objects

### Task 2.5: System prompt + context builder
- [ ] Create `src-tauri/src/ai/local_context_builder.rs`
- [ ] System prompt under 500 tokens (see design.md template)
- [ ] `build_local_context(cluster, namespace, findings, logs) -> Vec<ChatMessage>`
- [ ] Grounding: inject real pod/service/namespace names in CONTEXT
- [ ] Mode routing:
  - Root cause analysis → thinking mode (temp 0.6, top_p 0.95)
  - Structured JSON → non-thinking mode (temp 0.7, top_p 0.8)
- [ ] Context budget: system 500 + analyzers 800 + logs 4,652 + output reserve 2,048 = 8,000

### Task 2.6: Provider routing
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

### Task 3.7: Provider badge + AI panel
- [ ] Update `ProviderBadge.tsx`: add "Kubi-1" with blue badge
- [ ] Update `useLogAnalysis` hook: check local AI availability alongside CLI
- [ ] Route: preprocessor → sanitizer → context builder → LlamaManager
- [ ] Map-reduce progress for large logs: "Analyzing chunk 2/4..."

### Task 3.8: i18n
- [ ] Add ~30 translation keys to EN and DE:
  - `settings.ai.kubi1.*` (model section)
  - `settings.ai.providerPriority.*`
  - `settings.ai.advanced.*` (Ollama fallback)
  - `ai.localModelUnavailable`, `ai.downloadingModel`, `ai.analyzingChunk`

### Task 3.9: First-launch experience
- [ ] If no model installed and user opens AI panel → show inline prompt:
  "Download Kubi-1 (2.5 GB) to analyze logs locally, no internet needed."
  [Download] [Use Cloud AI Instead]
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

### Task 4.2: Download HuggingFace datasets
- [ ] Run `python load_hf_datasets.py --tier 1` (essential: CoT, tool calling, reasoning, SO)
- [ ] Run `python load_hf_datasets.py --tier 2` (valuable: kubectl-35k, cosmopedia, configs)
- [ ] Verify each dataset: check schema, count rows, spot-check quality
- [ ] Document any license concerns for commercial use

### Task 4.3: Clone GitHub repos
- [ ] Run `./clone_repos.sh --all`
- [ ] Verify: kubernetes/website, k8sgpt, kubectl, practical-k8s, troubleshooting repos
- [ ] Check total size, estimate token count

### Task 4.4: Harvest via GitHub API (smaller repos)
- [ ] Generate GitHub personal access token
- [ ] Run `GITHUB_TOKEN=ghp_xxx python harvest_k8s.py --tier 1`
- [ ] Run `GITHUB_TOKEN=ghp_xxx python harvest_k8s.py --tier 2`
- [ ] Check rate limit usage

### Task 4.5: Convert all data to instruction pairs
- [ ] Run `python convert_docs.py`
- [ ] Check output in `data/processed/`: k8s_docs.jsonl, k8sgpt_patterns.jsonl, so_cleaned.jsonl, hf_*.jsonl
- [ ] Spot-check 20 random pairs per file for quality

### Task 4.6: Generate refusal training data
- [ ] Run `python generate_refusals.py --count 5000`
- [ ] Review sample: non-K8s questions get polite decline, K8s-adjacent get scoped help
- [ ] Check output: `data/processed/refusals.jsonl`

### Task 4.7: Generate synthetic YAML error pairs
- [ ] Write `.dev/kubi-1/data/generate_synthetic.py`:
  - Take valid K8s YAML → introduce common mistakes → generate diagnosis
  - Mistake types: wrong apiVersion, missing labels, bad selectors, typos in resource names, wrong ports, missing required fields
  - Output: ~3K error→fix pairs
- [ ] Run and check output

### Task 4.8: Merge, filter, split
- [ ] Run `python merge_and_filter.py`
- [ ] Check stats: total pairs, dedup count, per-source distribution, category balance
- [ ] Verify train/eval split (90/10)
- [ ] Output: `data/final/kubeli-k8s-train.jsonl` + `kubeli-k8s-eval.jsonl`
- [ ] Target: 55K+ training pairs, 5K+ eval pairs

### Task 4.9: Prepare CPT corpus
- [ ] Run `python prepare_cpt_corpus.py`
- [ ] Check: raw text chunks (~40M tokens), K8s docs + YAML + Go code + SO answers
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
  - LoRA rank 128, target all linear layers + `lm_head` + `embed_tokens`
  - rsLoRA enabled, alpha=32
  - `learning_rate=5e-5`, `embedding_learning_rate=5e-6` (10x smaller)
  - 1 epoch over CPT corpus
  - Gradient checkpointing "unsloth"
  - Save adapter: `kubi1-cpt-adapter/`
- [ ] Run CPT: `ssh kubi-train "cd ~/kubi-training/training && python train_cpt.py"`
- [ ] Monitor loss curve — should decrease steadily
- [ ] Estimated time: ~2-4 hours on RTX 3090

### Task 5.2: CPT on Qwen3-1.7B-Base (Nano)
- [ ] Same pipeline with `unsloth/Qwen3-1.7B-Base`
- [ ] Save adapter: `kubi1-nano-cpt-adapter/`

### Task 5.3: CPT on Qwen3-8B-Base (Pro)
- [ ] Same pipeline with `unsloth/Qwen3-8B-Base`
- [ ] May need reduced batch size (8B is bigger)
- [ ] Save adapter: `kubi1-pro-cpt-adapter/`

---

## Phase 6: Training — SFT + Refusal

### Task 6.1: SFT on Kubi-1 (4B)
- [ ] Upload SFT dataset: `rsync -avz data/final/kubeli-k8s-train.jsonl kubi-train:~/kubi-training/data/`
- [ ] Update `training/train_kubi1.py`:
  - Load from CPT adapter (`kubi1-cpt-adapter/`), not raw Qwen3 base
  - LoRA rank 16 (lower than CPT — refining, not shifting)
  - Standard target modules (no lm_head/embed_tokens needed for SFT)
  - batch=8, grad_accum=4, epochs=2, lr=2e-4
  - seq_length=8192
- [ ] Run SFT
- [ ] Save merged model: `kubi1-sft/`

### Task 6.2: SFT on Kubi-1 Nano (1.7B)
- [ ] Same pipeline from `kubi1-nano-cpt-adapter/`
- [ ] May need 3 epochs (smaller model, needs more passes)

### Task 6.3: SFT on Kubi-1 Pro (8B)
- [ ] Same pipeline from `kubi1-pro-cpt-adapter/`
- [ ] 2 epochs, batch=4 (more VRAM usage)

### Task 6.4: Export all models to GGUF
- [ ] Export Kubi-1 (4B): Q4_K_M + Q5_K_M
- [ ] Export Kubi-1 Nano (1.7B): Q4_K_M + Q8_0 (small enough for Q8)
- [ ] Export Kubi-1 Pro (8B): Q4_K_M + Q5_K_M
- [ ] Optionally export Unsloth Dynamic (`UD-Q4_K_XL`) for quality comparison on the main model
- [ ] Create optional Ollama Modelfile for each with baked-in system prompt (compatibility path only)
- [ ] Record checksums, sizes, and artifact metadata for `registry.json`
- [ ] Pull GGUFs to Mac: `rsync -avz kubi-train:~/kubi-training/training/*.gguf models/`

### Task 6.5: Optional GRPO follow-up
- [ ] If SFT JSON quality is still weak, prototype GRPO on the 4B model
- [ ] Reward JSON validity, kubectl syntax correctness, and grounded resource references
- [ ] Compare GRPO result against plain SFT before adopting it

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

### Task 7.6: Candidate model bake-off
- [ ] Evaluate `Qwen3.5-4B` as the leading future fine-tune base
- [ ] Evaluate `Qwen3-30B-A3B` as MoE fallback candidate
- [ ] Evaluate `Nemotron-3-Nano-4B` only if stable GGUF export/runtime support is confirmed
- [ ] Write decision note: keep current shipped family or promote a new base in v2

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

## Model sizes

| Name | Base | Params | GGUF Q4_K_M | RAM needed | Context |
|------|------|--------|-------------|-----------|---------|
| Kubi-1 Nano | Qwen3-1.7B | 1.7B | ~1.2 GB | 8 GB+ | 32K |
| Kubi-1 | Qwen3-4B | 4B | ~2.5 GB | 16 GB+ | 32K |
| Kubi-1 Pro | Qwen3-8B | 8B | ~5 GB | 32 GB+ | 32K |

## Rust dependencies

```toml
[dependencies]
llmfit-core = "0.7"
tauri-plugin-shell = "2"
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
