# Deep Research Summary — April 4, 2026

> Condensed action items from comprehensive 8-topic research report.
> Full report archived externally. This document captures decisions and integration points.

---

## Key Decisions

### 1. Qwen3.5-4B confirmed as Standard v2 (over Gemma 4 E4B)

- MMLU Pro: 79.1% vs 69.4% (+9.7 points)
- Tool calling: TAU2 79.9% vs not published
- GGUF Q4_K_M: 2.74 GB vs 5.41 GB (half the size)
- Context: 262K vs 128K
- Caveat: DeltaNet hybrid arch has llama.cpp edge cases (parallel-slot crashes with --parallel 3+, Issue #20222). Single-slot (our use case) works reliably.
- Caveat: No Ollama support for Qwen3.5.

### 2. QLoRA is dead for Qwen3.5 and Gemma 4

- Unsloth explicitly warns: "higher than normal quantization differences" for Qwen3.5 DeltaNet.
- Gemma 4 E4B also recommends bf16 LoRA over 4-bit.
- **All training plans updated to bf16 LoRA.**
- Exception: Qwen3-8B (standard arch) can still use QLoRA if VRAM-constrained.

### 3. --fit flag replaces manual hardware/context configuration

- Available since b7300 (December 2025), enabled by default in b8660+.
- Auto-adjusts -ngl and --ctx-size based on available memory.
- Respects user-set values (never overrides explicit flags).
- Works correctly with turbo3 KV-cache (accounts for reduced memory footprint).
- Apple Silicon: reads `recommendedMaxWorkingSetSize` (~75% unified memory).
- No Apple Silicon-specific bugs.
- **Kubeli sidecar config: `--fit on --fit-ctx 8192 --fit-target 1024`**

### 4. Asymmetric KV-cache is critical for tool calling

- Symmetric turbo3/turbo3 degrades tool-calling quality.
- **Use `-ctk q8_0 -ctv turbo3`** (asymmetric: preserve K precision, compress V).
- This is confirmed in llama.cpp's own function-calling documentation.
- Updated all TurboQuant config in tasks.md.

### 5. Grammar constraints + fine-tuning = hybrid approach

- JSON schema constraints guarantee 100% structural validity.
- Fine-tuning provides semantic quality (correct K8s diagnosis).
- Combined: 99.5% schema accuracy + 94.0% content similarity (SLOT paper, EMNLP 2025).
- llama.cpp lazy grammars: model thinks freely, grammar activates on tool-call trigger.
- **New Task 2.5 added for grammar integration.**
- No public kubectl GBNF grammars exist — must build custom.

### 6. No competitors in local AI + Kubernetes

- Headlamp AI plugin = cloud APIs only.
- Lens Prism AI = cloud-based.
- kubectl-ai = CLI/web, not desktop.
- **Kubeli is first and only.** Blue ocean confirmed.

### 7. Competitor UX patterns to adopt

| Pattern | Source | What to adopt |
|---------|--------|---------------|
| Compatibility Score | Msty Studio 2.6 | Percentage-based model fit rating before download |
| Guided onboarding | Jan v0.7.9 | Single recommended model with quick-start |
| Hardware panel | LM Studio 0.4.9 | GPU details in settings for power users |

### 8. Unsloth Dynamic 2.0 is the new GGUF standard

- Per-layer, per-model quantization calibrated on 1.5M+ tokens.
- ARM/Apple Silicon optimized formats (Q4_NL, Q5.1).
- All future Unsloth GGUFs default to Dynamic 2.0.
- Code not open-sourced — must use pre-quantized or Unsloth export.
- **Updated GGUF export tasks to use UD-Q4_K_M as default.**

### 9. Build flags for llama-server

- Metal: `-DGGML_METAL=ON -DGGML_AMX=ON` (AMX for M4 Apple Matrix instructions)
- CUDA: `-DGGML_CUDA=ON -DGGML_CUDA_FA=ON -DGGML_CUDA_FA_ALL_QUANTS=ON -DCMAKE_CUDA_ARCHITECTURES=86`
- Launch: `--fit on --fit-ctx 8192 --fit-target 1024 -fa on --mlock --parallel 1 --defrag-thold 0.1`

### 10. Hardware detection: sysinfo + IOKit, not Tauri plugins

- No mature Tauri hardware detection plugin for Apple Silicon Metal capabilities.
- Recommended: `sysinfo` crate + Apple `IOKit` FFI for GPU details.
- Or shell out to `system_profiler SPDisplaysDataType`.
- `llmfit-core` remains primary, with sysinfo as fallback.

---

## Sources (confirmed)

| Topic | Key URLs |
|-------|----------|
| Qwen3.5-4B | huggingface.co/Qwen/Qwen3.5-4B |
| Gemma 4 E4B | huggingface.co/google/gemma-4-E4B-it |
| --fit PR | github.com/ggml-org/llama.cpp/pull/16653 |
| TurboQuant | github.com/TheTom/llama-cpp-turboquant |
| TurboQuant paper | arxiv.org/abs/2504.19874 |
| SLOT paper (grammar+FT) | EMNLP Industry 2025 |
| Jan | github.com/janhq/jan |
| Msty | msty.app |
| LM Studio | lmstudio.ai |
| Unsloth Dynamic 2.0 | unsloth.ai/blog/dynamic-v2 |
| Unsloth Studio | unsloth.ai/docs/new/studio |
