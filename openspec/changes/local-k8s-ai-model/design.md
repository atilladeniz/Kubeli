# Design: Local K8s AI Model

## Architecture Overview

Same approach as k8sgpt: **rule-based analyzers extract structured errors before the LLM sees data**. Less context needed, fewer hallucinations.

```
┌──────────────────────────────────────────────────────────────────┐
│                         Kubeli App                                │
│                                                                   │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────┐ │
│  │ AI Chat  │   │ Settings │   │ Log View │   │ Event View   │ │
│  │ (React)  │   │ Model    │   │ "Analyze"│   │ "Explain"    │ │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘   └──────┬───────┘ │
│       │               │              │                 │         │
│  ┌────▼───────────────▼──────────────▼─────────────────▼───────┐ │
│  │                  Tauri Commands (Rust)                       │ │
│  │                                                              │ │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐ │ │
│  │  │ llmfit-  │ │ ollama-  │ │ K8s        │ │ Log          │ │ │
│  │  │ core     │ │ rs       │ │ Analyzers  │ │ Preprocessor │ │ │
│  │  │ (hw      │ │ (v0.3.4) │ │ (k8sgpt    │ │ (filter →    │ │ │
│  │  │  detect) │ │ (stream) │ │  pattern)  │ │  dedup →     │ │ │
│  │  │          │ │          │ │            │ │  chunk)      │ │ │
│  │  └──────────┘ └────┬─────┘ └────────────┘ └──────────────┘ │ │
│  │                     │                                        │ │
│  │  ┌──────────────────▼───────────────────────────────────┐   │ │
│  │  │              Data Sanitizer                          │   │ │
│  │  │  (strip secrets, emails, tokens, IPs before LLM)     │   │ │
│  │  └──────────────────┬───────────────────────────────────┘   │ │
│  └──────────────────────┼──────────────────────────────────────┘ │
└──────────────────────────┼──────────────────────────────────────┘
                           │ Tauri 2 Channel API (token streaming)
                 ┌─────────▼─────────┐
                 │   Ollama Server   │
                 │  127.0.0.1:11434  │
                 │  (pinned ≥0.3.15) │
                 │                   │
                 │  ┌─────────────┐  │
                 │  │ qwen3:4b    │  │
                 │  │ Q4_K_M      │  │
                 │  └─────────────┘  │
                 └───────────────────┘
```

## Component Design

### 1. Hardware Detection (llmfit-core)

**Decision changed: llmfit-core as Rust crate dependency (not CLI).**

Research shows `llmfit-core` (v0.7.3, MIT, ~6K monthly downloads on crates.io) exposes a stable public API: `SystemSpecs::detect()`, `ModelDatabase`, `ModelFit`, `OllamaProvider`. Apple Silicon unified memory is handled correctly. Documentation coverage is only 31.68% so source reading is needed.

```toml
# src-tauri/Cargo.toml
[dependencies]
llmfit-core = "0.7"
```

Key APIs:
- `SystemSpecs::detect()` - CPU, RAM, GPU, VRAM, backend
- `ModelDatabase` - 497+ model registry with fit scoring
- `FitLevel::Perfect | Good | Marginal | TooTight`

Reserve 2-4 GB for OS + Kubeli when computing available memory on Apple Silicon.

Calibrate llmfit estimates (±20-30% accuracy) with a quick 50-token benchmark on first model setup.

### 2. Model Selection Strategy

Qwen3:4b scores highest in this size range (AI Index: 12, tool calling: 0.880, 95.64% log classification with RAG). Granite 3.1 MoE:3b uses only ~800M active params, so it runs 40-80% faster than dense 4B models.

| Priority | Model | Params | RAM (Q4_K_M) | Context | Why |
|----------|-------|--------|-------------|---------|-----|
| 1 | `qwen3:4b` | 4B | ~5.2GB | 32K | Best tool-calling + thinking mode, Apache 2.0 |
| 2 | `granite3.1-moe:3b` | 3B (800M active) | ~2.2GB | 128K | Fast fallback for ≤8GB RAM |
| 3 | `phi4-mini` | 3.8B | ~2.5GB | 128K | MIT license alternative, strong STEM |
| 4 | `qwen3:8b` | 8B | ~5GB | 32K | Quality pick for ≥16GB RAM |

Quantization guidance:
- **Q5_K_M** for structured tasks (JSON parsing, kubectl generation) - subtle errors matter
- **Q4_K_M** for interactive analysis where speed matters more
- Never go below Q4_K_M at ≤4B scale

### 3. K8s Analyzers (k8sgpt Pattern)

The idea: **detect issues programmatically, then let the LLM explain them.**

```
Raw K8s State ──► Rust Analyzers ──► Structured Errors ──► LLM Explains
                  (rule-based)       (compact, factual)    (human-readable)
```

Analyzer modules to build in `src-tauri/src/ai/analyzers/`:

| Analyzer | Detects |
|----------|---------|
| `pod_analyzer` | CrashLoopBackOff, ImagePullBackOff, OOMKilled, Pending, Evicted |
| `event_analyzer` | Warning events, FailedScheduling, FailedMount, Unhealthy |
| `service_analyzer` | No endpoints, selector mismatches |
| `ingress_analyzer` | Missing backend services, TLS issues |
| `hpa_analyzer` | ScaleUp/Down failures, metrics unavailable |
| `pdb_analyzer` | Disruption budget violations |
| `node_analyzer` | NotReady, DiskPressure, MemoryPressure |

Each analyzer outputs a structured error string. Only these strings go to the LLM, not raw K8s state. This is why k8sgpt works well even with small models.

### 4. Log preprocessor

A 4B model can handle roughly 46-76 log lines in its working window. Everything above that needs preprocessing.

```
Raw Logs (thousands of lines)
    │
    ▼
┌─────────────────────────┐
│ 1. FILTER               │  Regex: ERROR/WARN lines + ±3 context lines
│    (80-95% reduction)    │  Preserve: timestamps, pod names, error codes
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 2. DEDUPLICATE          │  Template mining (Drain3-style)
│    (75-95% further)     │  "OOMKilled in pod-xyz" × 47 → one line + count
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 3. SANITIZE             │  Strip: emails, IPs, JWTs (eyJ...), basic auth URLs,
│                         │  high-entropy strings (likely secrets)
│                         │  Replace with deterministic placeholders
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 4. CHUNK (if needed)    │  If > token budget: map-reduce
│                         │  Max 5 map iterations to bound latency
│                         │  Carry JSON state between chunks
└───────────┬─────────────┘
            ▼
    Processed Logs (~50-100 lines, clean, safe)
```

Build in Rust using `regex` (121K records/sec/CPU), `serde_json`, `rayon` for parallelism.

### 5. Context Budget (8K Effective Window)

Despite Qwen3:4b's 32K advertised window, research shows quality peaks at 8-16K. Budget for 8K effective:

| Component | Tokens | % |
|-----------|--------|---|
| System prompt | 500 | 6% |
| K8s analyzer output | 800 | 10% |
| Log content | 4,652 | 59% |
| Output reserve | 2,048 | 25% |

### 6. System Prompt (Under 500 Tokens)

Small models need short prompts, a fixed output format, and explicit grounding to avoid hallucinating resource names.

```
You are a Kubernetes troubleshooting assistant in Kubeli.

RULES:
- Only reference resources listed in CONTEXT below
- Reply "unknown" if unsure - never invent resource names
- Output JSON: {"error": "...", "cause": "...", "fix": "...", "commands": ["..."]}

COMMON PATTERNS:
- CrashLoopBackOff: check logs for exit code, OOM, config errors
- ImagePullBackOff: verify image name, registry auth, network
- Pending: check node resources, taints, PVC binding
- OOMKilled: compare memory limits vs actual usage

CONTEXT:
Cluster: {cluster_name} ({provider})
Namespace: {namespace}
Pods: {pod_names}
Recent warnings: {analyzer_output}

EXAMPLE:
User: Pod nginx-abc is CrashLoopBackOff
Assistant: {"error":"CrashLoopBackOff","cause":"Exit code 137 (OOMKilled). Container memory limit 128Mi, peak usage ~200Mi.","fix":"Increase memory limit to 256Mi","commands":["kubectl set resources deployment/nginx --limits=memory=256Mi -n default"]}
```

Use Qwen3's **non-thinking mode** for structured JSON output, **thinking mode** for root cause analysis.

Temperature: 0.6 + TopP 0.95 (thinking), 0.7 + TopP 0.8 (non-thinking).

### 7. Ollama Integration

Uses `ollama-rs = "0.3.4"` with `features = ["stream"]`.

All Ollama calls go through the Rust backend, not the frontend. This avoids CORS problems (Windows Tauri uses `http://tauri.localhost`, which Ollama does not whitelist) and lets us sanitize data before it reaches the model.

Streaming via Tauri 2 Channel API (`tauri::ipc::Channel<ChatEvent>`):

```rust
enum ChatEvent {
    Token(String),
    Done { total_tokens: u32, duration_ms: u64 },
    Error(String),
}
```

Lifecycle:
1. On app startup: try `GET http://127.0.0.1:11434/api/tags` (non-blocking)
2. If unavailable: try spawning `ollama serve` via `std::process::Command`
3. Health poll every 5s via `/api/tags`
4. Verify binding is 127.0.0.1 (not 0.0.0.0) - warn if exposed

**Security: pin minimum Ollama version ≥0.3.15** (all known CVEs patched).

### 8. Settings UI

```
┌─────────────────────────────────────────────────┐
│ Local AI Model                                   │
├─────────────────────────────────────────────────┤
│                                                 │
│ Hardware:                                       │
│   Apple M2 Pro · 12 cores · 16 GB · Metal       │
│                                                 │
│ Recommended: qwen3:4b (Q4_K_M)                  │
│   ~35 tok/s · 5.2 GB RAM · Fit: Perfect         │
│                                                 │
│ [Download & Setup]  [Change Model ▾]            │
│                                                 │
│ ████████████████░░░░ 78% (4.1 / 5.2 GB)         │
│                                                 │
│ Status: ● Ready                                  │
│                                                 │
│ Provider Priority:          [drag to reorder]    │
│   1. Local Model (qwen3:4b)                      │
│   2. Claude Code CLI                             │
│   3. OpenAI Codex CLI                            │
│                                                 │
│ ⚠ Your cluster data stays on this machine.       │
│   AI analysis runs locally, no cloud API needed. │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Decisions

1. **llmfit-core as Rust crate** (changed from CLI) - stable API, no external binary needed
2. **ollama-rs** - MIT, 988 stars, handles streaming and model management
3. **Tauri 2 Channel API** - type-safe token streaming without SSE/WS
4. **Analyzers before LLM** (k8sgpt pattern) - rule-based detection feeds compact errors to model
5. **Log preprocessing** - filter → dedup → sanitize → chunk before anything hits the model
6. **Data sanitization** - secrets/emails/tokens stripped before LLM sees data
7. **Qwen3:4b default, Granite MoE fallback** - benchmarked, both Apache 2.0
8. **System prompt under 500 tokens** - quality drops fast with longer prompts at 4B scale
9. **Ollama ≥0.3.15** - older versions have known RCE vulnerabilities
10. **No fine-tuning for v1** - system prompt + context injection already hits 95.64% on log classification

## v2 Roadmap (After v1 Ships)

- Fine-tuning: 30K StackOverflow dataset + synthetic pairs, QLoRA via Unsloth, $1-50 cost
- Contribute `UseCase::Kubernetes` to llmfit upstream
- Optional RAG over K8s docs (embedded SQLite + cosine similarity)
- Consider bundling Ollama as Tauri sidecar (`externalBin`) for one-click install
- kubectl-ai-style action mode (generate + execute commands)
