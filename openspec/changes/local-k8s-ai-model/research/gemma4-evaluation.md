# Gemma 4 26B-A4B: Evaluation for Kubeli

> **Research Brief — April 4, 2026**
> Evaluates Google's Gemma 4 26B-A4B MoE model as a potential Kubi model candidate.

---

## What It Is

Gemma 4 is Google DeepMind's latest open model family (Apache 2.0). The **26B-A4B** variant is a Mixture-of-Experts model with 25.2B total parameters but only **3.8B active parameters** per token — making it speed-comparable to a 4B model while accessing 26B worth of knowledge.

### Architecture

| Spec | Value |
|------|-------|
| Total params | 25.2B |
| Active params | 3.8B |
| Expert config | 128 total + 1 shared, 8 active |
| Layers | 30 |
| Context length | 256K tokens |
| Vision encoder | ~550M params |
| Sliding window | 1024 tokens |
| Vocab size | 262K |
| License | Apache 2.0 |

### Model Family

| Variant | Architecture | Active Params | Context | Modalities |
|---------|-------------|---------------|---------|------------|
| E2B | Dense + PLE | 2B | 128K | Text, Image, Audio |
| E4B | Dense + PLE | 4B | 128K | Text, Image, Audio |
| **26B-A4B** | MoE | 3.8B | 256K | Text, Image |
| 31B | Dense | 31B | 256K | Text, Image |

---

## Benchmarks

### Quality vs. Current Kubi Candidates

| Benchmark | Gemma 4 26B-A4B | Qwen3-4B (Kubi-1) | Qwen3-8B (Kubi-1 Pro) |
|-----------|----------------|-------------------|----------------------|
| MMLU Pro | 82.6% | ~55-60%* | ~65-70%* |
| AIME 2026 | 88.3% | — | — |
| LiveCodeBench | 77.1% | — | — |
| GPQA Diamond | 82.3% | — | — |
| Codeforces ELO | 1718 | — | — |

*Estimated from public leaderboards. Gemma 4 26B-A4B is in a completely different quality tier.

### Special Capabilities

- **Thinking mode**: Toggleable via `<|think|>` token — intermediate reasoning visible
- **Tool/function calling**: Native support
- **Vision**: Variable aspect ratio/resolution, document/PDF parsing, OCR, chart comprehension
- **Video**: Frame-by-frame up to 60s @ 1fps
- **140+ languages**

---

## GGUF Quantization (Unsloth Dynamic 2.0)

Available at `unsloth/gemma-4-26B-A4B-it-GGUF`:

| Quant | File Size | Est. VRAM | Kubeli Hardware Fit |
|-------|-----------|-----------|-------------------|
| UD-IQ2_M | 9.97 GB | ~12 GB | 16GB RAM (tight) |
| UD-Q3_K_M | 12.5 GB | ~15 GB | 16GB RAM |
| **UD-IQ4_XS** | **13.4 GB** | **~16 GB** | **16GB RAM** |
| UD-Q4_K_M | 16.9 GB | ~20 GB | 32GB RAM |
| UD-Q5_K_M | 21.2 GB | ~25 GB | 32GB RAM |
| Q8_0 | 26.9 GB | ~31 GB | 32GB+ RAM |

### Comparison to Current Kubi Models (GGUF)

| Model | Q4_K_M Size | Active Params | Quality Tier |
|-------|-------------|---------------|-------------|
| Kubi-1 Nano (Qwen3-1.7B) | ~1.2 GB | 1.7B | Basic |
| Kubi-1 (Qwen3-4B) | ~2.5 GB | 4B | Good |
| Kubi-1 Pro (Qwen3-8B) | ~5 GB | 8B | Strong |
| **Gemma 4 26B-A4B** | **~17 GB** | **3.8B** | **Excellent** |

The catch: despite having similar active params to Qwen3-4B, the full 25.2B model must be loaded into memory. The MoE routing means inference speed is 4B-class, but memory footprint is 26B-class.

---

## Training with Unsloth

### Supported Methods

- SFT (Supervised Fine-Tuning)
- GRPO (Reinforcement Learning)
- LoRA / QLoRA
- Vision fine-tuning (E2B/E4B only)

### Recommended Settings

```python
# LoRA config
r = 16
lora_alpha = 16
lora_dropout = 0
bias = "none"

# Training
max_seq_length = 2048
per_device_train_batch_size = 1
learning_rate = 2e-4
gradient_accumulation_steps = 4
```

### RTX 3090 24GB Feasibility

Not explicitly confirmed by Unsloth docs, but estimated:

| Model | Method | RTX 3090 24GB? |
|-------|--------|---------------|
| E2B | QLoRA SFT | Yes (comfortably) |
| E4B | QLoRA SFT | Yes (comfortably) |
| 26B-A4B | QLoRA SFT | Tight — MoE QLoRA not recommended by Unsloth |
| 31B | QLoRA SFT | No (need A100) |

**Important**: Unsloth explicitly states "MoE QLoRA not recommended" for the 26B-A4B. The dense 31B would be better for fine-tuning but requires more VRAM than we have.

### GGUF Export

Supported formats: q4_k_m, q8_0, f16. Direct export from Unsloth to GGUF confirmed.

---

## Fit Assessment for Kubeli

### Arguments For

1. **Quality leap**: 82.6% MMLU Pro vs. ~55-60% for Qwen3-4B. For complex K8s troubleshooting, root cause analysis, and multi-step reasoning, this could be transformative.
2. **Thinking mode**: Built-in chain-of-thought reasoning, toggleable. Matches our planned "thinking mode" for complex analysis.
3. **256K context**: Native 256K without TurboQuant hacks. Entire log files without chunking.
4. **Tool calling**: Native — better structured output for our JSON-based tool use.
5. **Vision**: Could analyze K8s dashboard screenshots, architecture diagrams, Grafana panels.
6. **Apache 2.0**: No licensing issues for bundling.
7. **TurboQuant compatibility**: TheTom's fork already has Gemma 4 MoE Metal support (PR #52).

### Arguments Against

1. **Memory footprint**: 17GB GGUF (Q4_K_M) vs. 2.5GB for Qwen3-4B. Only viable for 32GB+ RAM users.
2. **MoE training concerns**: Unsloth says "MoE QLoRA not recommended." Fine-tuning for Kubi-specific K8s knowledge may be harder.
3. **New model risk**: Just released — less battle-tested than Qwen3 in production llama.cpp deployments.
4. **No audio**: E2B/E4B have audio but 26B-A4B does not (not relevant for Kubeli).
5. **Download size**: Users need to download 17GB+ model file. Significant first-run friction.

### Where It Fits in the Kubi Lineup

If adopted, Gemma 4 26B-A4B would be a **Kubi-1 Ultra** tier — above Kubi-1 Pro (Qwen3-8B):

| Tier | Model | Min RAM | GGUF Size | Use Case |
|------|-------|---------|-----------|----------|
| Nano | Qwen3-1.7B | 8 GB | 1.2 GB | Quick queries, simple lookups |
| Standard | Qwen3-4B | 16 GB | 2.5 GB | General K8s assistance |
| Pro | Qwen3-8B | 32 GB | 5 GB | Complex analysis |
| **Ultra** | **Gemma 4 26B-A4B** | **32 GB** | **17 GB** | **Deep reasoning, multi-step diagnosis** |

With TurboQuant KV cache, the 32GB requirement could potentially drop or enable longer context.

### Alternative: Gemma 4 E4B as Kubi-1 Replacement?

The dense E4B (4B active, 4B total) is worth watching:
- Same quality tier as current Qwen3-4B but with vision/audio
- 128K context (vs. Qwen3-4B's 32K default)
- Dense model = no MoE QLoRA issues for fine-tuning
- GGUF size would be ~2.5-3GB — same as current Kubi-1

**We should evaluate E4B benchmarks against Qwen3-4B for K8s tasks specifically.**

---

## Recommendation

| Phase | Action |
|-------|--------|
| **Now** | Download `UD-IQ4_XS` (13.4 GB) and test with llama-server on M-series Mac. Evaluate K8s prompt quality vs. Qwen3-4B. |
| **Now** | Monitor Gemma 4 E4B GGUF availability for potential Kubi-1 replacement evaluation. |
| **v1** | Ship with Qwen3 lineup as planned. Gemma 4 too new for v1. |
| **v2** | If quality delta is significant: add Gemma 4 26B-A4B as "Kubi-1 Ultra" tier. |
| **v2** | Evaluate E4B as potential Kubi-1 Standard replacement (same size, possibly better). |
| **Training** | Do NOT attempt MoE QLoRA on 26B-A4B. If fine-tuning needed, use E4B (dense). |

---

## Open Questions

1. **E4B vs. Qwen3-4B head-to-head**: Which performs better on K8s-specific tasks? Need benchmark.
2. **MoE inference on llama.cpp**: How stable is Gemma 4 MoE on llama-server? Any edge cases with expert routing on Apple Silicon?
3. **TurboQuant + Gemma 4 MoE**: PR #52 is still open. When merged, test KV cache compression with 26B-A4B on our hardware.
4. **E4B fine-tuning**: Can we apply our existing Kubi-1 training pipeline (CPT + SFT) to Gemma 4 E4B via Unsloth?

---

## Sources

| # | Source | URL | Retrieved |
|---|--------|-----|-----------|
| 1 | Unsloth Gemma 4 docs | https://unsloth.ai/docs/de/modelle/gemma-4 | 2026-04-04 |
| 2 | Unsloth Gemma 4 training | https://unsloth.ai/docs/de/modelle/gemma-4/train | 2026-04-04 |
| 3 | GGUF model card | https://huggingface.co/unsloth/gemma-4-26B-A4B-it-GGUF | 2026-04-04 |
| 4 | TurboQuant Gemma 4 PR | https://github.com/TheTom/llama-cpp-turboquant/pull/52 | 2026-04-04 |
