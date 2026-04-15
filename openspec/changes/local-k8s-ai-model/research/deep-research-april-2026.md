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

## Round 2 Findings (Sidecar Readiness Deep-Dive)

### 11. CRITICAL: Grammar + Thinking mode mutual exclusion (Issue #20345)

- When `response_format` (JSON Schema) is used with `enable_thinking: true`, grammar enforcement is **silently inactive**
- Qwen3.5 wraps JSON in markdown fences when thinking is ON → PEG parser rejects with 500 error
- **Saving grace**: Qwen3.5-4B has thinking OFF by default (Unsloth explicitly: "Small models disable thinking by default")
- **Action**: Remove `--reasoning-format deepseek` from all sidecar flags. Never enable thinking for tool-calling requests.

### 12. CRITICAL: DeltaNet multi-turn full prompt reprocessing (Issues #20225, #19794, #20003)

- Every conversation turn forces full prompt re-evaluation due to DeltaNet recurrent state
- `llama_memory_seq_rm()` cannot partially truncate hybrid recurrent state, always returns `false`
- PRs #19924 and #20087 partially improved but did NOT fix it
- **Impact at 8K context**: ~8-16 seconds per turn on M3/M4 Apple Silicon (too slow)
- **Impact at 4K context**: ~2-4 seconds per turn (tolerable for K8s assistant)
- **Action**: Reduce `--fit-ctx` from 8192 → 4096. Implement client-side context windowing.

### 13. TurboQuant will NOT merge upstream before Q4 2026

- Issue #20977: bare feature request, **no maintainer comments**
- ggerganov's own PR #21038: simpler rotation approach, explicitly stated to "raise the baseline before the incoming flood of vibe-generated TurboQuant PRs"
- PR #21089 (most complete TurboQuant upstream attempt): ggerganov called it "pure slop"
- Two PRs (#21062, #21010) **closed for violating AI-generated code policy**
- **Conclusion**: Full TurboQuant types land incrementally starting Q4 2026 at earliest, multi-backend parity in H1 2027
- **Action**: Bundle TheTom's fork for v2. Abstract type names (`turbo3` vs future `tbq3_0`).

### 14. Plan B: ggerganov's rotation approach (PR #21038)

- Hadamard rotation on Q/K/V activations that works with ALL existing quant types
- On Llama-3.2-1B with q4_0 KV: PPL 6.6148 → 6.5962 (q4_0 already close to f16's 6.5788)
- If this merges upstream, `--cache-type-k q8_0 --cache-type-v q4_0` + rotation could be a viable alternative to TurboQuant with zero fork dependency
- **Action**: Monitor PR #21038. Test when merged.

### 15. TheTom fork maintenance assessment

- 478 stars, 111 forks, syncs with upstream every 6 hours
- Delta concentrated in KV cache code paths and kernels, not entire codebase
- Single-maintainer risk: TheTom currently very active
- Estimated maintenance: ~2-4 hours/month quiet, ~8-16 hours during upstream KV changes
- **Naming mismatch**: Fork `turbo3`/`turbo4` ≠ upstream PRs `tbq3_0`/`tbq4_0`

### 16. Qwen3.5-4B single-slot stability: CONFIRMED SAFE

- Issue #20222 crash: only --parallel 3+, single-slot explicitly stable in reproduction matrix
- Fix landed in PR #20232 (merged March 10, 2026)
- Issue #19879 loading failures: only affected 35B MoE variants, not 4B
- Pin to build >= 8212 (post-PR #20232)
- Tool calling verified as working on Qwen3.5-4B Q4_K_M in independent benchmark

### 17. Apple Silicon performance estimates (Qwen3.5-4B Q4_K_M)

- M3 Pro 36GB: ~40 tok/s decode, ~4.8s TTFT cold, 50K safe context (WillItRunAI)
- M3/M4 base: estimated ~35-50 tok/s decode, ~500-1000 tok/s prefill at 8K
- M4 Pro: estimated ~70-100 tok/s decode (273 GB/s bandwidth)
- Model size (2.74 GB) fits entirely in unified memory on any M3/M4

### 18. Data Recipes: pilot only, not full replacement

- No published quality benchmarks vs manual pipelines
- No built-in kubectl/K8s YAML validators (only Python/SQL/JS)
- Custom validators possible via NeMo DataDesigner Python API (`LOCAL_CALLABLE`) but not in Studio UI
- At 0.13 rec/sec with local 7B: ~21 hours for 10K instruction pairs
- Beta software (launched March 17, 2026)
- **Action**: Run pilot on 1K token subset. Evaluate LLM Judge block as standalone quality gate. Keep production pipeline in Python scripts.

### 20. STRATEGY SHIFT: Dual-model architecture (Final Research, April 4, 2026)

**Qwen3-4B stays as default. Qwen3.5-4B becomes "Deep Analysis" mode. Both ship together.**

Key finding: Thinking mode is transformative at 4B scale (EvalScope benchmarks):
- MATH-500: Qwen3-4B thinking=95.2% vs non-thinking=43.6% (+51.6 pts!)
- AIME 2024: thinking=70.0% vs non-thinking=23.3% (+46.7 pts)
- IFEval: thinking=87.8% vs non-thinking=68.9% (+18.9 pts)

Since Qwen3.5-4B CANNOT use thinking + grammar simultaneously (Issue #20345),
and K8s diagnosis requires structured reasoning + JSON output:
- Qwen3-4B + thinking + grammar → ~95% accuracy on structured reasoning
- Qwen3.5-4B without thinking + grammar → ~43% accuracy (estimated)

Additional advantages of Qwen3-4B as default:
- Zero multi-turn reprocessing (standard transformer KV cache)
- 100% benefit from TurboQuant KV compression (vs 25% for Qwen3.5)
- QLoRA fine-tuning works (6-8GB VRAM, vs bf16 LoRA 10GB for Qwen3.5)
- Thinking mode distilled from Qwen3-32B and Qwen3-235B-A22B

Qwen3.5-4B still valuable for:
- Single-shot long-context analysis (262K native context)
- Vision (screenshot/diagram analysis)
- Superior raw tool-calling benchmarks (TAU2 79.9%) for non-grammar scenarios
- Cases where thinking is not needed

Corrected assumption: Ollama supports BOTH models (qwen3.5:4b has 4.7M pulls).

Total download: 2.5GB + 2.86GB = 5.36GB. Both fit in ~6.5GB unified memory simultaneously.

### 19. Final validated sidecar configurations

**Qwen3-4B (default — multi-turn chat, tool calling):**

```bash
llama-server \
  --model Qwen3-4B-Q4_K_M.gguf \
  --fit on --fit-ctx 8192 --fit-target 1024 \
  -fa on --mlock --parallel 1 \
  --defrag-thold 0.1 \
  --jinja --no-warmup \
  --chat-template-kwargs '{"enable_thinking":true}'
  # v2 TurboQuant: -ctk q8_0 -ctv turbo3 (benefits 100% of layers)
```

**Qwen3.5-4B (deep analysis — single-shot, vision, long context):**

```bash
llama-server \
  --model Qwen3.5-4B-UD-Q4_K_M.gguf \
  --fit on --fit-ctx 4096 --fit-target 1024 \
  -fa on --mlock --parallel 1 \
  --defrag-thold 0.1 \
  --jinja --no-warmup
  # NO --chat-template-kwargs thinking (breaks grammar)
  # v2 TurboQuant: limited benefit (~25% of layers)
```

DO NOT ADD to Qwen3.5: `--reasoning-format deepseek`, `--parallel >1`, thinking enabled

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
| Issue #20345 (grammar+thinking) | github.com/ggml-org/llama.cpp/issues/20345 |
| Issues #20225/#19794 (DeltaNet reprocessing) | github.com/ggml-org/llama.cpp/issues/20225 |
| Issue #20977 (TurboQuant upstream) | github.com/ggml-org/llama.cpp/issues/20977 |
| PR #21038 (ggerganov rotation) | github.com/ggml-org/llama.cpp/pull/21038 |
| PR #21089 (TurboQuant upstream attempt) | github.com/ggml-org/llama.cpp/pull/21089 |
| PR #20232 (parallel-slot fix) | github.com/ggml-org/llama.cpp/pull/20232 |
| WillItRunAI (M3 Pro benchmarks) | willitrunai.com |
| NeMo DataDesigner | nvidia-nemo.github.io/DataDesigner |
