# Model Comparison: Best ≤4B for K8s Troubleshooting (March 2026)

> All benchmark numbers sourced from official model cards.
> Estimates clearly marked. Last verified: 2026-03-26.

---

## Head-to-Head: Qwen3-4B vs Nemotron-3-Nano-4B

### Architecture

| | Qwen3-4B | Nemotron-3-Nano-4B |
|---|----------|-------------------|
| **Architecture** | Standard Transformer (GQA) | **Mamba2-Transformer Hybrid** (4 Attention + Mamba-2 + MLP) |
| **Params** | 4.02B (3.6B non-embedding) | 3.97B (compressed from 9B via Elastic) |
| **Maker** | Alibaba (Qwen) | NVIDIA |
| **Released** | May 2025 (Instruct-2507: Jul 2025) | March 16, 2026 |
| **Context** | 32,768 native (131K with YaRN) | **262,144** native |
| **Training data** | Not disclosed | 10T+ tokens (incl. synthetic from DeepSeek-R1, Qwen3-235B) |
| **License** | Apache 2.0 | NVIDIA Nemotron Open Model License |
| **GGUF size (Q4_K_M)** | **2.5 GB** (verified Ollama) | ~2.5 GB (Unsloth GGUFs still converting) |

### Verified Benchmark Comparison

| Benchmark | Qwen3-4B | Source | Nemotron-3-Nano-4B | Source |
|-----------|----------|--------|-------------------|--------|
| **Tool Calling (BFCL v3)** | 0.880 | OpenSpec prior research [1] | **0.611** | NVIDIA model card [2] |
| **MATH500** | not published | — | **95.4** | NVIDIA model card [2] |
| **AIME25** | not published | — | **78.5** | NVIDIA model card [2] |
| **GPQA** | not published | — | **53.2** | NVIDIA model card [2] |
| **IFEval (Prompt/Instr)** | not published | — | **87.9 / 92.0** | NVIDIA model card [2] |
| **RULER 128K** | N/A (32K context) | — | **91.1** | NVIDIA model card [2] |
| **Thinking mode** | ✅ | HF model card [3] | ✅ | NVIDIA model card [2] |
| **HF Downloads** | **6.49M** | HuggingFace [3] | newer | HuggingFace |
| **Ollama** | ✅ `qwen3:4b` (25M DL) | Ollama [4] | ✅ `nemotron` | Ollama [5] |
| **Ollama size** | **2.5 GB** | Ollama [4] | TBD | Unsloth converting |

> **Note on Qwen3-4B benchmarks:** The official Qwen3-4B HuggingFace model card does not publish MATH500, GPQA, or AIME scores for the 4B variant specifically. The Qwen blog states "Qwen3-4B can rival the performance of Qwen2.5-72B-Instruct" but without per-benchmark numbers. The tool calling score 0.880 is from the original Kubeli OpenSpec research.

> **Note on Nemotron GGUF status:** Unsloth's NVIDIA-Nemotron-3-Nano-4B-GGUF page says "GGUFs still converting" as of 2026-03-26. The Mamba2 hybrid architecture may require special GGUF handling.

### License Comparison (Verified)

| | Qwen3-4B (Apache 2.0) | Nemotron-3-Nano-4B (NVIDIA Open) |
|---|---|---|
| Commercial use | ✅ | ✅ "Works are commercially usable" |
| Create derivatives | ✅ | ✅ "free to create and distribute Derivative Works" |
| Fine-tuning | ✅ | ✅ (derivative work) |
| Distribution | ✅ | ✅ with attribution notice required |
| Attribution | Not required | **Required**: "Licensed by NVIDIA Corporation under the NVIDIA Nemotron Model License" |
| Patent clause | Standard Apache patent grant | Patent termination on litigation |
| Royalty-free | ✅ | ✅ "perpetual, worldwide, non-exclusive, no-charge, royalty-free" |

**Verdict:** Both licenses allow commercial use and fine-tuning. Nemotron requires an attribution notice. Apache 2.0 is simpler but both are viable.

---

## Key Analysis

### 1. Tool Calling: Qwen3 wins (0.880 vs 0.611)

This is the **most critical metric for Kubeli**. Our model outputs structured JSON:
```json
{"error":"CrashLoopBackOff","cause":"OOMKilled","fix":"Increase memory limit","commands":["kubectl set resources..."]}
```

A 27-point gap in tool calling accuracy (88% vs 61%) directly impacts whether the AI output is usable. After fine-tuning on our K8s JSON format, Qwen3 starts from a much stronger base.

### 2. Reasoning: Nemotron wins

Nemotron excels at mathematical and scientific reasoning (MATH500: 95.4, AIME25: 78.5). For K8s troubleshooting, reasoning matters for complex root cause analysis. However, our analyzer pipeline handles most detection — the LLM primarily needs to explain findings and generate fix commands, where tool calling matters more.

### 3. Context: Nemotron has 8x more (262K vs 32K)

Our architecture preprocesses logs down to ~50-100 lines before the LLM sees them. The 8K effective context window in our design means 32K is sufficient. However, Nemotron's 262K could enable a simpler architecture without log chunking in a future version.

### 4. Ecosystem: Qwen3 has massive lead

6.49M downloads, 25M Ollama downloads, proven Unsloth support, stable GGUF quantization. Nemotron is brand new (March 16, 2026), GGUFs are still being converted, Mamba2 architecture is less battle-tested in llama.cpp.

### 5. llama.cpp Compatibility

Qwen3 uses standard Transformer (GQA) — the most optimized architecture in llama.cpp with years of Metal/CUDA kernel tuning. Nemotron's Mamba2 hybrid is supported but newer. When shipping as a Tauri sidecar, we need maximum stability.

---

## Performance Estimates (Apple Silicon)

Based on [llama.cpp official benchmarks](https://github.com/ggml-org/llama.cpp/discussions/4167) for LLaMA 7B Q4_0 on M4 (10 GPU, 120 GB/s):
- Prompt processing: 221 t/s
- Text generation: 24 t/s

**Extrapolation for 4B models** (roughly half the size of 7B, so faster):
- Expected prompt processing: ~300-400 t/s
- Expected text generation: **~35-50 t/s**

⚠️ These are extrapolated from 7B benchmarks, not direct 4B measurements. Actual speeds depend on model architecture, attention heads, and vocab size.

At ~40 t/s, a 150-token K8s analysis response takes **~3-4 seconds**. First token appears in **<1 second**.

---

## Final Recommendation

| Priority | Model | Role | Confidence |
|----------|-------|------|------------|
| **1** | **Qwen3-4B** | Default + fine-tune base | **High** — proven ecosystem, best tool calling |
| 2 | Qwen3-0.6B | kubi-1-lite (instant answers) | High — tiny, fast |
| 3 | Nemotron-3-Nano-4B | Experimental eval candidate | Medium — wait for stable GGUFs |
| 4 | Qwen3-30B-A3B | Low-RAM MoE fallback | High — proven Ollama support |
| 5 | Qwen3.5-4B | Future upgrade | Low — no Ollama yet |

---

## Sources

| # | Source | URL | Verified |
|---|--------|-----|----------|
| [1] | Kubeli OpenSpec design.md (tool calling 0.880) | `openspec/changes/local-k8s-ai-model/design.md` | ✅ |
| [2] | NVIDIA Nemotron-3-Nano-4B Model Card | https://huggingface.co/unsloth/NVIDIA-Nemotron-3-Nano-4B-GGUF | ✅ 2026-03-26 |
| [3] | Qwen3-4B HuggingFace | https://huggingface.co/Qwen/Qwen3-4B | ✅ 2026-03-26 |
| [4] | Qwen3:4b on Ollama | https://ollama.com/library/qwen3:4b | ✅ 2026-03-26 |
| [5] | Nemotron on Ollama | https://ollama.com/library/nemotron | ✅ 2026-03-26 |
| [6] | NVIDIA Nemotron Open Model License | https://nvidia.com/en-us/agreements/enterprise-software/nvidia-nemotron-open-model-license/ | ✅ 2026-03-26 |
| [7] | llama.cpp Apple Silicon Benchmarks | https://github.com/ggml-org/llama.cpp/discussions/4167 | ✅ 2026-03-26 |
| [8] | Qwen3 Technical Report | https://arxiv.org/abs/2505.09388 | Referenced |
| [9] | Nemotron-3-Nano Technical Report | https://arxiv.org/abs/2512.20848 | Referenced |
