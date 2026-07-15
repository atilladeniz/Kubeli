# Kubi-1 v2 Training Pipeline — Master Index

> April 8, 2026 — Post-v1 budget run evaluation

## Status: v1 Complete, v2 Required

v1 proved the concept works but has a critical EOS/stop-token defect in the exported GGUF.
The model content is correct (identity, refusals, troubleshooting structure) but inference is broken.

---

## v1 Results Summary

### What worked
- CPT absorbed K8s domain knowledge (loss 0.448 over 1 epoch)
- SFT learned correct identity ("Ich bin Kubi-1")
- SFT learned correct refusals ("I cannot delete", "I don't know about Elon Musk")
- SFT learned correct diagnostic format (Findings / Likely Cause / What To Verify)
- CrashLoopBackOff troubleshooting answer was structurally correct

### What is broken
- Model does not stop generating after a complete answer
- Garbage tokens appear: `mPid:`, `ontvangst`, `NdrFcuser`, `<LM`
- System prompt rules leak into model output
- Model enters infinite repetition loops
- These are NOT content problems — they are tokenizer/EOS/export problems

### Root cause (verified via GGUF inspection)
- EOS token ID in GGUF is correct (151643 = `<|endoftext|>`)
- PAD token ID is correct (151669)
- **BUT: no `chat_template` is embedded in the GGUF**
- This means the model does not know `<|im_end|>` marks end-of-turn
- The model generates correct content, then continues past the answer boundary
- Garbage tokens are the model generating random tokens after exhausting its useful output
- **The fix is to re-export with Unsloth's native GGUF export which embeds the chat template**
- See `v2-eos-fix-plan.md` for the detailed technical plan

---

## v2 Pipeline — Step by Step

### Phase 1: Fix the Export (highest ROI, no retraining needed)

- [ ] **1.1** Verify EOS/PAD tokens in the merged HF model on HF
  - Check `atilladeniz/kubi1-sft-adapter-budget` adapter_config.json
  - Check `atilladeniz/kubi1-cpt-merged-budget` config.json and tokenizer_config.json
  - Confirm eos_token_id=151643, pad_token_id=151669
- [ ] **1.2** Re-merge using Unsloth's native merge instead of AutoPeftModel
  - Use `model.save_pretrained_merged()` which handles special tokens correctly
  - Verify `tie_word_embeddings` handling
- [ ] **1.3** Re-export GGUF using Unsloth's built-in export instead of manual llama.cpp
  - Use `model.save_pretrained_gguf()` which embeds correct chat template and EOS
  - Compare with manual export to identify the difference
- [ ] **1.4** Test locally with Ollama
  - Use the correct Qwen3 chat template (not custom)
  - Verify stop behavior on all test cases
  - Run the full test suite below

### Phase 2: Improve SFT Data (if Phase 1 fixes the stop problem)

- [ ] **2.1** Add more short, correctly-stopping examples
  - Focus on examples that end cleanly after 2-4 sentences
  - Ensure every example ends with `<|im_end|>` in training data
- [ ] **2.2** Add explicit stop-training examples
  - Short Q&A pairs where the model answers in 1-2 lines and stops
  - "What is a Pod?" -> 2 sentences, done
- [ ] **2.3** Reduce the synthetic addon repeat count
  - Current: 12-24x repeat for identity examples
  - Better: 4-8x, to avoid overfitting on specific phrases
- [ ] **2.4** Verify response-only masking is correct
  - Confirm training loss is not 0.0 (would mean all labels are -100)
  - Print sample tokenized examples with labels before training

### Phase 3: Improve CPT (only if Phase 2 is not enough)

- [ ] **3.1** Consider rank 128 instead of 64 for better knowledge absorption
- [ ] **3.2** Consider 2 epochs instead of 1
- [ ] **3.3** Consider seq_len 3072 instead of 2048

### Phase 4: Production Integration

- [ ] **4.1** Use Unsloth's native GGUF export with embedded chat template
- [ ] **4.2** Create proper Ollama Modelfile with Qwen3-native template
- [ ] **4.3** Integrate into Kubeli's llama-server sidecar path
- [ ] **4.4** Test with real Kubeli runtime context (system prompt + logs + pod status)

---

## Test Suite

Run all of these after every model change:

```bash
# Troubleshooting (must be concise and stop)
ollama run kubi1 "My pod is in CrashLoopBackOff. What should I check?"
ollama run kubi1 "Pod is Pending with FailedScheduling"
ollama run kubi1 "ImagePullBackOff — what are the common causes?"

# Identity (must be correct and stop)
ollama run kubi1 "Was ist Kubeli?"
ollama run kubi1 "Wer bist du?"
ollama run kubi1 "What is Kubi-1?"

# Refusals (must refuse and stop)
ollama run kubi1 "Who is Elon Musk?"
ollama run kubi1 "Write me a poem"
ollama run kubi1 "Can you delete this deployment for me?"

# Short answer (must be brief and stop)
ollama run kubi1 "What is a Pod?"
ollama run kubi1 "Give me kubectl commands to list all pods"

# Log analysis (must diagnose and stop)
ollama run kubi1 "Analyze: ERROR failed to connect to postgres: connection refused"
```

Pass criteria:
- Answer must be correct
- Answer must stop within 300 tokens
- No garbage tokens
- No system prompt leak
- No repetition loops

---

## HuggingFace Repos

| Repo | Purpose | Status |
|------|---------|--------|
| `atilladeniz/kubi1-training` | Training scripts | Current |
| `atilladeniz/kubi1-cpt-corpus` | CPT raw text corpus | Complete |
| `atilladeniz/kubi1-sft-dataset` | SFT instruction pairs | Complete |
| `atilladeniz/kubi1-cpt-adapter-budget` | CPT LoRA adapter | Complete |
| `atilladeniz/kubi1-cpt-merged-budget` | Merged CPT base model | Complete |
| `atilladeniz/kubi1-sft-adapter-budget` | SFT LoRA adapter checkpoint | Complete |
| `atilladeniz/kubi1-gguf-budget` | GGUF exports (broken EOS) | Needs re-export |

---

## RunPod Workflow

### GPU Selection
- **SFT + Export**: A40 48GB ($0.40/h) — confirmed working
- **CPT**: A100 80GB ($1.22/h) — only if re-CPT needed
- **Export only**: A40 or even cheaper GPU sufficient

### Pod Setup (copy-paste ready)
See `/tmp/kubi1-sft-next-run.md` for the full setup block.

Key: always use `unsloth/unsloth` image with pinned venv packages.

### Cost Tracking
- v1 CPT (A100, 7h): ~$8.50
- v1 SFT (A40, 1.5h): ~$0.60
- v1 Export (A40, 2h): ~$0.80
- **v1 Total: ~$10**
- v2 target: $2-5 (re-export + possibly re-SFT, no re-CPT)

---

## Critical References (from v2 research)

- [Qwen3 Tokenizer Update: im_end becomes endoftext](https://kaitchup.substack.com/p/qwen3-when-im_end-suddenly-becomes) — explains why our EOS is wrong
- [QwenLM #1064: Non-stop generation with wrong EOS](https://github.com/QwenLM/Qwen3/issues/1064)
- [Ollama #12444: Qwen3 continues past endoftext](https://github.com/ollama/ollama/issues/12444)
- [Unsloth #2860: Qwen3 GGUF garbage output fix](https://github.com/unslothai/unsloth/issues/2860) — exactly our bug
- [HF Transformers #38160: tie_word_embeddings lost after merge](https://github.com/huggingface/transformers/issues/38160)
- [Unsloth #3726: Qwen3 merge to 16-bit GGUF](https://github.com/unslothai/unsloth/issues/3726)
- [Unsloth GGUF export docs](https://unsloth.ai/docs/basics/inference-and-deployment/saving-to-gguf)

## Key Learnings from v1

1. **Unsloth's auto-export is better than manual llama.cpp** — it handles EOS, chat template, and tokenizer correctly
2. **sudo is not available in unsloth containers** — plan for user-space operations
3. **sentencepiece must be installed separately** in the venv
4. **The model content quality was surprisingly good for a budget run** — identity, refusals, and troubleshooting structure all worked
5. **The biggest risk is not training quality but export/inference alignment**
6. **System prompt at runtime is the strongest lever for controlling behavior** — don't try to bake everything into weights

---

## Files in This Research Directory

| File | Purpose |
|------|---------|
| `v2-training-index.md` | **This file** — master index for v2 pipeline |
| `v2-eos-fix-plan.md` | Technical plan for fixing the EOS/stop problem |
| `wow-model-budget-playbook-april-2026.md` | Strategy for budget "wow" models |
| `synthetic-sft-addon-april-2026.md` | Synthetic SFT data strategy |
| `kubi1-optimal-strategy.md` | Dual-model architecture strategy |
| `dataset-optimization.md` | Dataset quality optimization |
| `deep-research-april-2026.md` | Initial deep research |
| `kubi1-specialist-training.md` | Specialist training approach |
