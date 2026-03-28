# TurboQuant CUDA: KV Cache Compression for llama.cpp

> **Research Brief — March 28, 2026**
> Evaluates TurboQuant CUDA for Kubeli's llama-server sidecar inference.

---

## What It Is

TurboQuant CUDA is a llama.cpp fork that adds aggressive KV cache compression during inference. Instead of storing the KV cache in full precision (fp16 or q8_0), it quantizes the cache to much smaller representations while maintaining or even improving perplexity.

Two repositories:
- **CUDA version**: github.com/spiritbuun/llama-cpp-turboquant-cuda (GPU-accelerated)
- **Original CPU**: github.com/TheTom/llama-cpp-turboquant (CPU reference)

---

## Key Numbers (Verified from Author's Benchmarks)

### Quality: Beats q8_0

Tested on Qwen3.5-27B Q6:

| Config | PPL | vs q8_0 | KV Compression |
|--------|-----|---------|----------------|
| LA-1 | 5.7690 | **-1.17%** (better) | 3.5x |
| LA-5 | 5.8091 | -0.49% (better) | 4.2x |
| turbo3 | 5.8323 | -0.09% (better) | 4.9x |
| q8_0 baseline | 5.8375 | — | 1x |
| q4_0 | 5.8186 | -0.32% (better) | ~5x |

All TurboQuant configs beat q8_0 quality. This is unusual and significant.

### Speed: Minimal Overhead

128K context on RTX 3090 24GB (turbo3 KV cache):

| Context Length | Prefill (t/s) | Decode (t/s) | Notes |
|---------------|--------------|-------------|-------|
| 8K | 1123 | 30.03 | — |
| 32K | 980 | 29.83 | — |
| 64K | 847 | 29.79 | q8_0 OOMs here |
| 96K | 748 | 29.86 | — |
| 128K | 671 | 29.89 | Full context window |

Decode speed is **constant at ~30 t/s across all context lengths**. q8_0 runs out of memory at 64K context.

Compared to q8_0 at equivalent contexts:
- Prefill: 99.6% of q8_0 speed
- Decode: 97.5% of q8_0 speed

---

## Why This Matters for Kubeli

### 1. Unlocks Longer Context on User Hardware

Our current design uses an 8K effective context window because we assumed tight VRAM budgets. TurboQuant changes the math:

| Hardware | Without TurboQuant | With TurboQuant (turbo3, 4.9x) |
|----------|-------------------|-------------------------------|
| 8GB RAM (kubi-1-lite 0.6B) | 8K context | 32K+ context |
| 16GB RAM (kubi-1 4B) | 8K context | 32K context easily |
| 32GB RAM (kubi-1 4B) | 32K context | 128K context possible |

This could eliminate the need for log chunking and map-reduce in many cases.

### 2. Bigger Models on Same Hardware

Instead of using the freed VRAM for longer context, users could run larger models:

| Hardware | Without TurboQuant | With TurboQuant |
|----------|-------------------|----------------|
| 16GB RAM | 4B model max | Could fit 8B model |
| 32GB RAM | 8B model comfortable | Could fit Qwen3-30B-A3B MoE |

### 3. RTX 3090 Training Machine Benefits

Our training/eval setup on the RTX 3090 24GB:
- Can evaluate models at 128K context (currently limited to ~32K with q8_0)
- Better for long-context evaluation of Qwen3.5-4B (256K native context)
- More VRAM headroom during inference testing

### 4. Qwen3.5 Compatibility Validated

The author's benchmarks use Qwen3.5-27B, confirming the Qwen architecture (our target) works with TurboQuant. The 4B variant would benefit proportionally more from KV cache savings.

---

## Integration Path for Kubeli

### Option A: Custom llama-server Build (Recommended for v2)

Build llama-server from the TurboQuant CUDA fork instead of upstream llama.cpp:

```bash
# Instead of upstream llama.cpp release binaries
git clone https://github.com/spiritbuun/llama-cpp-turboquant-cuda
cd llama-cpp-turboquant-cuda
cmake -B build -DGGML_CUDA=ON  # or -DGGML_METAL=ON for Mac
cmake --build build --target llama-server
```

Add flags to sidecar startup:

```rust
// LlamaManager start args — add TurboQuant KV cache config
.args([
    "--model", model_path.to_str().unwrap(),
    "--port", &port.to_string(),
    "--host", "127.0.0.1",
    "--ctx-size", "32768",          // Can now afford larger context
    "--cache-type-k", "turboquant", // TurboQuant KV cache (exact flag TBD)
    "--cache-type-v", "turboquant",
    "--flash-attn",
    "--cont-batching",
])
```

### Option B: Wait for Upstream Merge

TurboQuant is a fork. If it gets merged into mainline llama.cpp, we get it for free with our regular llama-server binary updates. Monitor the upstream PR activity.

### Option C: Expose as User Setting

In Settings → AI → Advanced:
- KV Cache Mode: Auto / Standard / TurboQuant
- Context Length: Auto / 8K / 16K / 32K / 64K / 128K

Let power users choose their tradeoff.

---

## Risks and Considerations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Fork maintenance burden | Medium | Monitor upstream merge status; only adopt if active |
| Metal (macOS) support unclear | Medium | The CUDA fork is GPU-specific. Need to verify Metal backend works |
| Binary size increase | Low | Same llama-server binary, just different build |
| Config complexity for users | Low | Auto-detect and set sensible defaults |
| Stability of new quantization | Low | Author's benchmarks show stable PPL across configs |

### Open Question: Metal Support

The CUDA variant is explicitly for NVIDIA GPUs. For macOS Apple Silicon (Metal), we need to verify:
1. Does the original TheTom/llama-cpp-turboquant support Metal?
2. Or is this CUDA-only optimization?

If Metal is not supported, TurboQuant would only benefit:
- Windows/Linux users with NVIDIA GPUs
- Our RTX 3090 training/eval machine

macOS users (our primary audience) would not benefit until Metal support lands.

---

## Recommendation

| Phase | Action |
|-------|--------|
| **Now** | Add to research tracking. Test on RTX 3090 with Qwen3.5-4B during eval. |
| **v1** | Ship standard llama-server (proven, stable). No TurboQuant. |
| **v2** | If upstream merges TurboQuant or Metal support confirmed: adopt. |
| **v2 alt** | If fork stays separate: build custom CUDA binary for Windows/Linux NVIDIA users. |

The most impactful near-term use is on our RTX 3090 eval machine — we can test models at 128K context without upgrading hardware.

---

## Sources

| # | Source | URL | Retrieved |
|---|--------|-----|-----------|
| 1 | TurboQuant CUDA (spiritbuun) | https://github.com/spiritbuun/llama-cpp-turboquant-cuda | 2026-03-28 |
| 2 | TurboQuant Original (TheTom) | https://github.com/TheTom/llama-cpp-turboquant | 2026-03-28 |
| 3 | Author's benchmark tweet | Twitter @spiritbuun, 2026-03-27 | 2026-03-28 |
| 4 | Kubeli inference engine comparison | ./inference-engine-comparison.md | 2026-03-28 |
