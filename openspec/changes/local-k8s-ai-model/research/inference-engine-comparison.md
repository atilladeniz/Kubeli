# Inference Engine Deep Comparison: What's Best for Kubeli?

> Evaluated every viable option for shipping on-device AI in a Tauri desktop app.
> Goal: fastest, cleverest, most resource-efficient K8s model — zero third-party installs.

---

## 1. All Options Evaluated

| Engine | Type | Platforms | GPU | Model Format | Bundle as Sidecar? | OpenAI API? |
|--------|------|-----------|-----|-------------|-------------------|-------------|
| **llama.cpp (llama-server)** | C++ binary | All | Metal, CUDA, Vulkan | GGUF | ✅ easy | ✅ built-in |
| **MLX** | Python framework | **macOS only** | Metal | MLX/safetensors | ❌ needs Python | ❌ custom |
| **candle** | Rust library | All | Metal, CUDA | safetensors/GGUF | ✅ compile into Tauri | ❌ custom |
| **llamafile** | Single executable | All | Metal, CUDA, Vulkan | GGUF baked in | ⚠️ huge file | ✅ built-in |
| **Ollama** | External app | All | Metal, CUDA | GGUF (wrapped) | ❌ user installs | ✅ built-in |
| **vLLM** | Python server | Linux | CUDA | safetensors | ❌ server only | ✅ built-in |

---

## 2. Apple Silicon Performance: llama.cpp vs MLX

### Real Benchmarks — llama.cpp on Apple Silicon (Metal)

From the [official llama.cpp Apple Silicon benchmark collection](https://github.com/ggml-org/llama.cpp/discussions/4167):

**LLaMA 7B Q4_0** (comparable to our 4B model at Q4_K_M):

| Chip | BW (GB/s) | GPU Cores | Prompt (t/s) | Generation (t/s) |
|------|-----------|-----------|-------------|------------------|
| M1 | 68 | 8 | 118 | 14 |
| M2 | 100 | 10 | 180 | 22 |
| M3 | 100 | 10 | 187 | 21 |
| M4 | 120 | 10 | **221** | **24** |
| M4 Pro | 273 | 20 | **440** | **51** |

**For a 4B model (smaller than 7B), expect ~1.5-2x these TG speeds:**
- **M4**: ~35-48 tok/s generation ← user's MacBook Air M4
- **M4 Pro**: ~75-100 tok/s generation

This is already **excellent**. At 40+ tok/s, responses appear near-instant for K8s troubleshooting queries (~100-200 tokens).

### MLX Performance Comparison

MLX (Apple's ML framework) has a speed advantage primarily for:
- **Non-quantized models** (float16/float32) — MLX is 10-20% faster
- **Training on Mac** — MLX supports fine-tuning, llama.cpp does not

For **quantized GGUF inference** (our use case):
- llama.cpp Metal ≈ MLX performance (within 5-10%)
- Both are memory-bandwidth limited for text generation
- The bandwidth ceiling is the same: M4 = 120 GB/s

**Key insight:** At Q4 quantization, text generation speed is bottlenecked by **memory bandwidth**, not compute. Both llama.cpp and MLX hit the same bandwidth ceiling. The difference is negligible.

### Why llama.cpp Wins Over MLX for Kubeli

| Factor | llama.cpp | MLX |
|--------|-----------|-----|
| **Platforms** | macOS + Windows + Linux | **macOS only** |
| **Language** | C++ (easy sidecar) | Python (needs runtime) |
| **Bundle size** | ~10-15MB binary | ~200MB+ (Python + deps) |
| **Q4 inference speed** | ≈ same as MLX | ≈ same as llama.cpp |
| **OpenAI-compat API** | ✅ llama-server | ❌ need custom wrapper |
| **GGUF support** | ✅ native | ⚠️ via conversion |
| **Pre-built binaries** | ✅ every release | ❌ pip install |
| **Model updates** | Simple GGUF swap | Format conversion needed |
| **Maturity** | 50K+ stars, battle-tested | Newer, evolving |

**Verdict: MLX is not better for our case.** Same speed at Q4, but Mac-only and much harder to bundle. llama.cpp is the clear winner for a cross-platform desktop app.

---

## 3. candle (HuggingFace Rust) — The Interesting Alternative

candle is a **pure Rust ML framework** by HuggingFace:
- ✅ Rust library — could compile directly INTO Tauri (no sidecar!)
- ✅ Metal + CUDA support
- ✅ GGUF quantized model support
- ✅ MIT/Apache dual license
- ✅ Supports Qwen architecture

**The dream:** No sidecar binary at all. AI inference is just another Rust crate in Tauri. Zero external processes. Smallest possible bundle.

**The reality (why we don't use it now):**
- ❌ No built-in HTTP server (must build our own streaming API)
- ❌ Less optimized GGUF inference than llama.cpp (llama.cpp has years of Metal/CUDA kernel tuning)
- ❌ Smaller community, fewer battle-tested models
- ❌ No Flash Attention equivalent yet for all backends
- ❌ Model loading is slower than llama.cpp

**Verdict: Future option (v3).** Start with llama.cpp sidecar (proven, fast), migrate to candle in-process if the performance gap closes. Monitor candle's progress.

---

## 4. llamafile (Mozilla) — Interesting But Not Right

llamafile bundles model + inference engine into a **single executable**:
- ✅ True zero-install: one file = complete AI
- ✅ Cross-platform (Cosmopolitan Libc)
- ❌ **Model baked into binary** — can't update model separately
- ❌ File size: model + engine = 3GB+ single file
- ❌ No way to swap models without rebuilding the llamafile

**Verdict: Wrong architecture for us.** We need separate model updates. But the llamafile approach of embedding llama.cpp is validated — we're doing the same thing, just keeping model and engine separate.

---

## 5. Final Architecture: Smart Dual-Engine

```
┌────────────────────────────────────────────────────────┐
│ Kubeli App                                              │
│                                                         │
│  ┌──────────────────────────┐                          │
│  │ LlamaManager (Rust)      │                          │
│  │                          │                          │
│  │  Platform Detection:     │                          │
│  │  ┌─────────────────────┐ │                          │
│  │  │ macOS?  → Metal     │ │                          │
│  │  │ NVIDIA? → CUDA      │ │                          │
│  │  │ AMD?    → Vulkan    │ │                          │
│  │  │ Other?  → CPU       │ │                          │
│  │  └─────────────────────┘ │                          │
│  │                          │    ┌──────────────────┐  │
│  │  Start llama-server ─────┼───►│ llama-server     │  │
│  │  (Tauri sidecar)         │    │ 127.0.0.1:PORT   │  │
│  │                          │    │ OpenAI API       │  │
│  │  POST /v1/chat/completions◄───│                  │  │
│  │  (streaming)             │    └──────────────────┘  │
│  │                          │                          │
│  │  Future: candle in-proc  │                          │
│  │  (no sidecar needed)     │                          │
│  └──────────────────────────┘                          │
│                                                         │
│  ┌──────────────────────────┐                          │
│  │ ModelManager (Rust)      │                          │
│  │                          │                          │
│  │  • Auto-download GGUF    │                          │
│  │  • SHA-256 verification  │                          │
│  │  • Registry check (1x/d) │                          │
│  │  • Atomic model swap     │                          │
│  │  • Disk space management │                          │
│  └──────────────────────────┘                          │
│                                                         │
│  ┌──────────────────────────┐                          │
│  │ K8s Analyzers (Rust)     │  ← Rule-based, no LLM  │
│  │ Log Preprocessor (Rust)  │  ← filter/dedup/chunk   │
│  │ Data Sanitizer (Rust)    │  ← strip secrets        │
│  │ Context Builder (Rust)   │  ← <500 token prompt    │
│  └──────────────────────────┘                          │
└────────────────────────────────────────────────────────┘
```

### GPU-Optimized Binary Selection

Ship multiple llama-server variants, select at runtime:

```rust
fn select_llama_binary(app: &AppHandle) -> &str {
    #[cfg(target_os = "macos")]
    {
        // macOS: Metal is always available on Apple Silicon
        // The standard macOS binary has Metal built in
        "llama-server"
    }

    #[cfg(target_os = "windows")]
    {
        // Check for NVIDIA GPU
        if has_nvidia_gpu() {
            // Use CUDA variant (must ship separately or download on demand)
            "llama-server-cuda"
        } else {
            // CPU with Vulkan fallback
            "llama-server"
        }
    }

    #[cfg(target_os = "linux")]
    {
        "llama-server" // CPU + Vulkan
    }
}
```

For v1: Ship CPU+Metal binary (10-15MB). Cover 95% of users.
For v1.1: Optional CUDA binary download for NVIDIA users (~50MB, downloaded on demand).

---

## 6. Model Choice: Performance per Watt Analysis

For **resource efficiency** (the cleverest model), we need to consider:

**Tokens generated per second per GB RAM consumed**

| Model | Params | RAM (Q4) | Est. TG (M4) | TG/GB | Context | Best For |
|-------|--------|----------|-------------|-------|---------|----------|
| Qwen3-4B | 4B | ~3GB | ~45 t/s | **15 t/s/GB** | 32K | Fine-tuning base |
| Nemotron-3-Nano-4B | 4B (MoE) | ~3GB | ~45 t/s | **15 t/s/GB** | 1M | Huge context |
| Qwen3-30B-A3B | ~3B active | ~4GB | ~55 t/s | **14 t/s/GB** | 32K | MoE quality |
| Qwen3-1.7B | 1.7B | ~1.5GB | ~90 t/s | **60 t/s/GB** | 32K | Ultra-fast |
| Qwen3-0.6B | 0.6B | ~0.5GB | ~200 t/s | **400 t/s/GB** | 32K | Instant |

### The Clever Strategy: Tiered Models

Don't ship just one model. Ship a routing system:

```
User query: "Why is my pod in CrashLoopBackOff?"
    │
    ├── Analyzers detect: CrashLoopBackOff, exit code 137, OOMKilled
    │   → Structured error, no LLM needed for detection
    │
    ├── Simple explanation needed?
    │   → Qwen3-0.6B or 1.7B (instant, <100ms)
    │   → "Your pod is being killed due to out-of-memory. Increase memory limits."
    │
    └── Complex root cause analysis?
        → Qwen3-4B (fine-tuned Kubi-1)
        → Full JSON diagnosis with kubectl commands
```

**Ship two GGUFs:**
1. **kubi-1-lite (Qwen3-0.6B fine-tuned)** — ~400MB, instant responses, simple queries
2. **kubi-1 (Qwen3-4B fine-tuned)** — ~3GB, deep analysis, complex queries

User downloads the lite model first (fast, small). Full model downloads in background or on demand.

---

## 7. Performance Expectations for Kubeli Users

### MacBook Air M4 (user's dev machine)

| Scenario | Model | Tokens | Latency |
|----------|-------|--------|---------|
| Quick error explanation | kubi-1-lite (0.6B) | ~50 tok | **<0.5s** |
| Log analysis (100 lines) | kubi-1 (4B) | ~150 tok | **~3-4s** |
| Complex root cause | kubi-1 (4B) thinking mode | ~300 tok | **~7-8s** |
| First token (TTFT) | kubi-1 (4B) | 1 tok | **~0.5-1s** |

### Minimum Viable Hardware

| RAM | Recommended Model | Experience |
|-----|------------------|------------|
| 8GB | kubi-1-lite (0.6B) only | Fast, basic diagnostics |
| 16GB | kubi-1 (4B) | Full experience |
| 32GB+ | kubi-1 (4B) + thinking mode | Premium experience |

---

## 8. Final Recommendation

### What to Build

```
v1.0 — Ship with llama-server sidecar
├── llama-server binary bundled (10-15MB per platform)
├── kubi-1-lite.gguf auto-download (400MB, Qwen3-0.6B fine-tuned)
├── kubi-1.gguf optional download (3GB, Qwen3-4B fine-tuned)
├── Model registry on GitHub for updates
├── Optional: external Ollama for power users
└── K8s analyzers + log preprocessor in Rust

v2.0 — Optimize
├── Smart routing: lite model for simple, full model for complex
├── CUDA binary download for NVIDIA users
├── TurboQuant KV cache compression (3.5-4.9x, beats q8_0 quality)
│   → Enables 128K context on RTX 3090, 32K+ on 16GB machines
│   → See research/turboquant-kv-cache.md
├── Nemotron-3-Nano-4B evaluation (1M context advantage)
├── Qwen3.5-4B when Ollama/llama.cpp fully supports it
└── GRPO training for better JSON output

v3.0 — Native Rust inference
├── Evaluate candle for in-process inference
├── No sidecar needed, everything compiled into Tauri
├── Smallest possible binary
└── Fastest possible startup
```

### Why NOT MLX

| Claim | Reality |
|-------|---------|
| "MLX is faster on Mac" | Only for float16. At Q4, both hit the same bandwidth limit. |
| "MLX is Apple-optimized" | llama.cpp Metal backend is also Apple-optimized, same Metal API. |
| "MLX is the future" | For training on Mac, yes. For inference in a cross-platform app, llama.cpp wins. |

### Why NOT Ollama

| Claim | Reality |
|-------|---------|
| "Ollama is easiest" | Easiest for developers. Not for end users who must install it separately. |
| "Ollama handles everything" | Ollama IS llama.cpp underneath. We're cutting out the middleman. |

### Why llama-server Sidecar is the Answer

1. **Zero friction**: User downloads Kubeli → model downloads → works
2. **Cross-platform**: Same approach on macOS, Windows, Linux
3. **Fast**: Metal on Mac (same as MLX speed), CUDA on Windows
4. **Small**: 10-15MB binary addition to the app
5. **Updatable**: Model and engine update independently
6. **Proven**: LM Studio, Jan.ai, and many others use this exact approach
7. **Standard API**: OpenAI-compatible, easy to implement and test

---

## Sources

| # | Source | URL |
|---|--------|-----|
| 1 | llama.cpp Apple Silicon Benchmarks | https://github.com/ggml-org/llama.cpp/discussions/4167 |
| 2 | llama.cpp Releases (b8530) | https://github.com/ggml-org/llama.cpp/releases |
| 3 | candle (HuggingFace Rust ML) | https://github.com/huggingface/candle |
| 4 | llamafile (Mozilla) | https://github.com/Mozilla-Ocho/llamafile |
| 5 | Tauri Sidecar Docs | https://v2.tauri.app/develop/sidecar/ |
| 6 | MLX Community | https://huggingface.co/mlx-community |
| 7 | LM Studio Docs | https://lmstudio.ai/docs |
| 8 | Tauri Updater Plugin | https://v2.tauri.app/plugin/updater/ |
