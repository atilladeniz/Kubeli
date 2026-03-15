# Tasks: Local K8s AI Model

## Phase 1: Foundation (Rust Backend)

### Task 1: Ollama client via ollama-rs
- [ ] Add `ollama-rs = { version = "0.3.4", features = ["stream"] }` to Cargo.toml
- [ ] Create `src-tauri/src/ai/ollama_client.rs`
- [ ] Implement `check_ollama_status()` - detect running Ollama, list installed models
- [ ] Verify Ollama binds to 127.0.0.1 (warn if 0.0.0.0)
- [ ] Check Ollama version ≥0.3.15 (warn if older, CVE risk)
- [ ] Implement `pull_ollama_model()` - streaming progress via Tauri Channel API
- [ ] Implement `query_local_model()` - chat completion with token streaming
- [ ] Define `ChatEvent` enum: `Token(String)`, `Done { total_tokens, duration_ms }`, `Error(String)`
- [ ] All calls proxied through Rust backend (never frontend-direct, CORS + security)

### Task 2: llmfit-core integration
- [ ] Add `llmfit-core = "0.7"` to Cargo.toml
- [ ] Create `src-tauri/src/ai/hardware.rs`
- [ ] Use `SystemSpecs::detect()` for hardware info
- [ ] Filter `ModelDatabase` against curated K8s model list
- [ ] Return best-fit model with `FitLevel::Perfect` or `FitLevel::Good`
- [ ] Reserve 2-4 GB for OS + Kubeli on Apple Silicon unified memory
- [ ] Implement quick 50-token benchmark to calibrate tok/s estimate
- [ ] Fallback: if llmfit detection fails, use basic RAM-based rules

### Task 3: Data sanitizer
- [ ] Create `src-tauri/src/ai/sanitizer.rs`
- [ ] Regex patterns: emails, IPv4/IPv6, JWTs (eyJ...), basic auth URLs
- [ ] High-entropy string detection (likely secrets/tokens)
- [ ] Kubernetes-specific: env var values from pod specs, connection strings
- [ ] Deterministic placeholder replacement (so analysis stays coherent)
- [ ] Configurable regex patterns (enterprise users may add custom patterns)

### Task 4: Log preprocessor
- [ ] Create `src-tauri/src/ai/log_preprocessor.rs`
- [ ] Step 1 - Filter: regex for ERROR/WARN/FATAL + ±3 context lines
- [ ] Step 2 - Deduplicate: template mining (group identical patterns, emit count)
- [ ] Step 3 - Sanitize: pipe through sanitizer from Task 3
- [ ] Step 4 - Chunk: if exceeds token budget, split for map-reduce
- [ ] Use `rayon` for parallel processing on large log sets
- [ ] Token counting: approximate with char/4 rule or use tiktoken-rs
- [ ] Context budget: 4,652 tokens for logs out of 8K effective window

### Task 5: K8s analyzers (k8sgpt pattern)
- [ ] Create `src-tauri/src/ai/analyzers/` module
- [ ] `pod_analyzer` - CrashLoopBackOff, ImagePullBackOff, OOMKilled, Pending, Evicted
- [ ] `event_analyzer` - Warning events, FailedScheduling, FailedMount, Unhealthy
- [ ] `service_analyzer` - No endpoints, selector mismatches
- [ ] `node_analyzer` - NotReady, DiskPressure, MemoryPressure
- [ ] Each analyzer outputs structured error string (compact, factual)
- [ ] Only analyzer output goes to LLM (not raw K8s state)
- [ ] Aggregate analyzer results into ≤800 tokens for system prompt context

### Task 6: System prompt + context builder
- [ ] Create `src-tauri/src/ai/context_builder.rs`
- [ ] System prompt template: under 500 tokens
- [ ] Include: role, rules, common error patterns, output JSON schema, one example
- [ ] Explicit grounding: "Only reference resources listed in CONTEXT"
- [ ] Dynamic context: cluster name, namespace, pod names, analyzer output
- [ ] Qwen3 mode routing: thinking mode for root cause, non-thinking for JSON output
- [ ] Temperature settings: 0.6/TopP 0.95 (thinking), 0.7/TopP 0.8 (non-thinking)

## Phase 2: Frontend

### Task 7: Settings UI - AI Model section
- [ ] New section in Settings: "Local AI Model"
- [ ] Display hardware info from llmfit-core
- [ ] Show recommended model with fit score and estimated tok/s (as range)
- [ ] Download button → streaming progress bar via Tauri Channel
- [ ] Model selector dropdown for manual override
- [ ] Status indicator: not installed / downloading / ready
- [ ] Privacy notice: "Your cluster data stays on this machine"
- [ ] Store config in Tauri store: model, ollama_host, provider_priority

### Task 8: Provider priority configuration
- [ ] Draggable priority list: Local Model, Claude CLI, OpenAI CLI
- [ ] Smart routing default: log/troubleshooting → local, complex → cloud
- [ ] Per-query provider override in AI chat UI
- [ ] Update `agent_manager.rs` to respect priority order
- [ ] Show active provider badge in AI chat panel

### Task 9: Log analysis integration
- [ ] "Analyze with AI" in log view context menu
- [ ] Pipe selected logs through preprocessor → sanitizer → context builder → Ollama
- [ ] Stream response tokens to AI chat panel
- [ ] Show provider badge (local / Claude / OpenAI)
- [ ] For large logs: map-reduce with progress indicator ("Analyzing chunk 2/4...")

## Phase 3: Polish

### Task 10: Ollama lifecycle management
- [ ] Auto-detect Ollama on app startup (non-blocking background check)
- [ ] First-launch setup wizard if Ollama available but no model pulled
- [ ] Platform-specific install instructions (brew/winget/curl)
- [ ] Handle Ollama going offline mid-session (fallback to cloud providers)
- [ ] Redirect Ollama stdout/stderr to log file (prevent buffer overflow)

### Task 11: Evaluation framework (prep for v2 fine-tuning)
- [ ] Create 200-500 test examples: error diagnosis, kubectl generation, YAML debugging
- [ ] Automated checks: YAML validation, kubectl syntax, resource name grounding
- [ ] Track response quality (optional thumbs up/down in UI)
- [ ] Use framework to validate prompt engineering changes

## Model Candidates (Updated from Research)

| Model | Params | Active | RAM (Q4) | Context | Tool Call | Fit |
|-------|--------|--------|----------|---------|-----------|-----|
| `qwen3:4b` | 4B | 4B | ~5.2GB | 32K | 0.880 | Default |
| `granite3.1-moe:3b` | 3B | ~800M | ~2.2GB | 128K | 0.670 | Low-RAM fallback |
| `phi4-mini` | 3.8B | 3.8B | ~2.5GB | 128K | 0.880 | MIT alternative |
| `qwen3:8b` | 8B | 8B | ~5GB | 32K | - | Quality pick |

## Rust Dependencies (New)

```toml
ollama-rs = { version = "0.3.4", features = ["stream"] }
llmfit-core = "0.7"
# existing: regex, serde_json, rayon, tokio
```

## Research Sources

- k8sgpt analyzer architecture (Apache 2.0, 7.4K stars)
- Masri et al. (Jan 2026): Qwen3-4B 95.64% log classification with RAG
- ollama-rs (v0.3.4, 988 stars, streaming + tool calling)
- llmfit-core (v0.7.3, MIT, crates.io)
- Cisco Talos / Trend Micro: Ollama security analysis (CVE-2024-37032 etc.)
- Stanford "Lost in the Middle" (Liu et al. 2023): U-shaped recall in LLMs
