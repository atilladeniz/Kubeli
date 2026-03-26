# Design: Local K8s AI Model

## Architecture Overview

Kubeli uses the same core principle as k8sgpt: rule-based analyzers extract structured findings before the LLM sees data. The local model then explains findings, proposes fixes, and generates grounded commands.

```text
React UI
  -> Tauri commands
    -> Hardware detection (llmfit-core)
    -> K8s analyzers
    -> Log preprocessor
    -> Sanitizer
    -> Local context builder
    -> ModelManager
    -> LlamaManager
         -> llama-server sidecar on 127.0.0.1:{random_port}
```

The default path is fully local:
- Kubeli downloads a GGUF into the app data directory
- Kubeli starts `llama-server` as a bundled sidecar
- Kubeli talks to the sidecar through the OpenAI-compatible API

External Ollama remains an advanced compatibility mode, not the primary architecture.

## Core Components

### 1. Hardware detection

Use `llmfit-core` directly from Rust:

```toml
[dependencies]
llmfit-core = "0.7"
```

Responsibilities:
- Detect CPU, RAM, GPU/backend, and rough fit
- Recommend a shipped Kubi-1 variant
- Run a short local benchmark after first successful setup

Fallback:
- `sysinfo` for RAM/cores
- static recommendation rules if llmfit fails

### 2. Model selection strategy

Kubeli ships and recommends its own curated model family:

| Product | Base | Target user |
|---------|------|-------------|
| Kubi-1 Nano | Qwen3-1.7B | lower-memory systems |
| Kubi-1 | Qwen3-4B | default for most users |
| Kubi-1 Pro | Qwen3-8B | higher-memory systems |

Default recommendation thresholds:
- `< 12 GB RAM` -> Nano
- `< 24 GB RAM` -> Standard
- `>= 24 GB RAM` -> Pro

Research-track candidates are evaluated separately and do not change v1 defaults automatically:
- Qwen3.5-4B
- Qwen3-30B-A3B
- Nemotron-3-Nano-4B

### 3. ModelManager

`ModelManager` owns model storage, downloads, verification, and updates.

Storage:
- macOS: `~/Library/Application Support/com.kubeli/models/`
- Windows: `%APPDATA%/com.kubeli/models/`
- Linux: `~/.local/share/com.kubeli/models/`

Responsibilities:
- `manifest.json` lifecycle
- download with progress events
- SHA-256 verification
- resume partial downloads when possible
- cancellation and temp-file cleanup
- disk-space preflight checks
- atomic update and rollback if restart fails
- registry lookup via hosted `registry.json`

Download sources:
1. HuggingFace CDN
2. GitHub Releases fallback

### 4. LlamaManager

`LlamaManager` owns the bundled inference engine lifecycle.

Responsibilities:
- start `llama-server` via Tauri sidecar support
- bind to `127.0.0.1` on a random free port
- pass model path, context size, threads, and batching flags
- poll `/health` until ready
- send `/v1/chat/completions` requests with SSE streaming
- emit the existing `AIEvent` enum so the frontend stays compatible
- idle shutdown and crash recovery

v1 bundling strategy:
- ship CPU/Metal-capable binaries required for the main desktop targets
- keep CUDA/Vulkan acceleration as optional follow-up packaging work

### 5. K8s analyzers

Analyzer modules live under `src-tauri/src/ai/analyzers/`.

Planned analyzers:
- pod
- event
- service
- node
- deployment
- pvc
- job
- ingress

Each analyzer returns structured `AnalyzerFinding` values:
- severity
- resource reference
- concise finding message

The LLM sees compact findings, not raw cluster dumps.

### 6. Log preprocessing and sanitization

Pipeline:
1. Filter to relevant lines (`ERROR`, `WARN`, `FATAL`, plus context)
2. Deduplicate repeated patterns
3. Sanitize secrets and sensitive values
4. Chunk when token budget is exceeded

Sanitizer requirements:
- emails
- IPv4 / IPv6
- JWTs
- bearer tokens
- basic-auth URLs
- connection strings
- high-entropy values
- deterministic placeholders such as `[TOKEN-3]`

### 7. Local context builder

Small local models need tight prompts. The local prompt stays under 500 tokens and only includes:
- cluster name
- namespace
- grounded resource names
- analyzer findings
- preprocessed logs

Budget target:
- system prompt: 500
- analyzer findings: 800
- logs: 4,652
- output reserve: 2,048

Total effective window: about 8K.

### 8. Provider routing

Rename `AiCliProvider` to `AiProvider` and route by provider:

```rust
match provider {
    AiProvider::Local => llama_manager.send(...),
    AiProvider::Claude | AiProvider::Codex => agent_manager.send(...),
}
```

Rules:
- Local is the default first provider when installed
- Fallback order is user-configurable
- Smart routing can prefer local for log-heavy analysis
- External Ollama can be selected in advanced mode but uses the same higher-level provider abstraction

## Frontend integration

### Settings

Settings adds three main areas:
- local model section
- provider priority ordering
- advanced fallback controls

The model section shows:
- hardware info
- recommended model
- download progress
- update availability
- delete action
- privacy copy explaining that cluster data stays on-device

### AI panel integration

The existing AI event flow remains intact because local streaming reuses the current `AIEvent` structure.

Needed UI changes:
- add `Kubi-1` / local provider badge
- show first-launch download CTA when no model is installed
- show map-reduce progress for multi-chunk log analysis

## Error handling

All new commands return `Result<T, KubeliError>`.

Primary error kinds:
- `Network`
- `NotFound`
- `ServerError`
- `Timeout`
- `Integrity`
- `Spawn`

Common cases:
- checksum mismatch
- sidecar failed to boot
- model file missing
- no disk space
- download cancelled
- update rollback triggered

## Training and evaluation track

The app implementation and the model-training work stay decoupled.

Training assets live in `.dev/kubi-1/`.

Current plan:
- data pipeline for harvested docs + HF datasets + synthetic data
- CPT corpus preparation
- QLoRA / CPT training on the RTX 3090
- GGUF export for llama-server
- optional Ollama Modelfiles for compatibility testing
- evaluation suite with baseline, fine-tuned variants, refusal behavior, and candidate bake-off

Research additions that must be reflected in planning:
- Qwen3.5-4B as the leading future fine-tune candidate
- Qwen3-30B-A3B as MoE fallback candidate
- Nemotron-3-Nano-4B as experimental long-context candidate
- optional Unsloth Studio / Data Recipes evaluation
- optional Unsloth Dynamic GGUF export and comparison

## Decisions

1. Bundle `llama-server` as the primary inference engine.
2. Keep external Ollama only as an advanced fallback.
3. Rename `AiCliProvider` to `AiProvider`.
4. Reuse the existing `AIEvent` stream shape.
5. Run analyzers and sanitization before local inference.
6. Keep the local prompt short and grounded.
7. Treat training artifacts in `.dev/kubi-1/` as a parallel workstream to the app integration.
