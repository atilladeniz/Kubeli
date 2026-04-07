# v2 EOS/Stop Token Fix — Technical Plan

> April 8, 2026 — Critical fix for v1 loop/garbage problem

## GGUF Inspection Results (verified)

```
tokenizer.ggml.eos_token_id = 151643   (<|endoftext|>) — CORRECT
tokenizer.ggml.padding_token_id = 151669 — CORRECT
tokenizer.ggml.model = gpt2
tokenizer.ggml.pre = qwen2
chat_template = NOT PRESENT            — THIS IS THE PROBLEM
bos_token_id = NOT PRESENT
```

The EOS token ID is correct, but the GGUF has NO embedded chat template.
This means the model does not know that `<|im_end|>` marks the end of an assistant turn.
The model generates past the correct answer because nothing tells it to stop at the turn boundary.

## The Problem

v1 GGUF produces correct answers but:
- Does not stop generating
- Emits garbage tokens: `mPid:`, `ontvangst`, `NdrFcuser`, `<LM`
- Leaks system prompt rules into output
- Enters infinite repetition loops

## Key Discovery: Qwen3 EOS Token Confusion

Qwen3 underwent a tokenizer update where `eos_token` changed from `<|im_end|>` (ID 151645) to `<|endoftext|>` (ID 151643). Our SFT formats data with `<|im_end|>` as the turn delimiter (ChatML), but the GGUF has `eos_token_id=151643`. The inference engine never sees the ChatML stop signal.

Sources:
- [Qwen3 Tokenizer Update: im_end becomes endoftext](https://kaitchup.substack.com/p/qwen3-when-im_end-suddenly-becomes)
- [QwenLM #1064: Non-stop generation with wrong EOS](https://github.com/QwenLM/Qwen3/issues/1064)
- [Ollama #12444: Qwen3 continues past endoftext](https://github.com/ollama/ollama/issues/12444)
- [Unsloth #2860: Qwen3 GGUF garbage output fix](https://github.com/unslothai/unsloth/issues/2860)
- [HF Transformers #38160: tie_word_embeddings not saved after merge](https://github.com/huggingface/transformers/issues/38160)

## Root Cause Analysis

The v1 export pipeline was:
1. `AutoPeftModelForCausalLM.from_pretrained()` — loads adapter + base
2. `.merge_and_unload()` — merges LoRA into base weights
3. `.save_pretrained()` — saves merged HF model
4. Manual `convert_hf_to_gguf.py` — converts to GGUF
5. Manual `llama-quantize` — quantizes to Q4_K_M / Q5_K_M

Problems in this pipeline:

### Problem 1: AutoPeftModel merge does not guarantee correct special tokens
- `merge_and_unload()` merges weight matrices but may not correctly handle:
  - `tie_word_embeddings=true` (Qwen3-4B has this)
  - Special token embeddings that were separately trained in CPT
  - The tokenizer_config.json special token mapping

### Problem 2: Manual convert_hf_to_gguf.py may embed wrong EOS
- Qwen3-4B-Base has multiple EOS candidates:
  - `<|endoftext|>` (151643) — the actual EOS
  - `<|im_end|>` (151645) — chat turn end
  - `<|im_start|>` (151644) — chat turn start
- If the tokenizer_config.json in the merged model is incomplete or wrong,
  convert_hf_to_gguf.py may not embed the correct stop behavior

### Problem 3: No chat template embedded in GGUF
- Unsloth's native export (`save_pretrained_gguf`) embeds the chat template
  directly into the GGUF metadata
- Manual llama.cpp export does NOT — it relies on Ollama's Modelfile to provide it
- This mismatch can cause the model to not recognize turn boundaries

### Problem 4: Garbage tokens indicate tokenizer corruption
- `mPid:`, `ontvangst` are real tokens from the vocabulary that should never appear
- This suggests the model's output distribution is broken after the correct answer
- Likely cause: the EOS logit is not high enough because the token was not properly
  trained or the embedding was corrupted during merge

## The Fix

### Option A: Re-export using Unsloth (recommended, cheapest)

Instead of the manual pipeline, use Unsloth's native export on the existing
SFT checkpoint. This requires a RunPod pod for ~30 minutes.

CRITICAL: Before export, fix the EOS token alignment:
- Set `tokenizer.eos_token = "<|im_end|>"` (151645) — this is the ChatML stop signal
- Set `tokenizer.pad_token = "<|endoftext|>"` (151643) — safe padding, not EOS
- Verify `model.config.tie_word_embeddings == True` after merge (HF bug #38160)
- Update Unsloth to latest version (bug #2860 fixed Qwen3 GGUF garbage)

```python
from unsloth import FastLanguageModel

# Load the CPT-merged base + SFT adapter
model, tokenizer = FastLanguageModel.from_pretrained(
    "atilladeniz/kubi1-cpt-merged-budget",
    load_in_4bit=True,
)

# Load the SFT adapter on top
from peft import PeftModel
model = PeftModel.from_pretrained(model, "atilladeniz/kubi1-sft-adapter-budget")

# CRITICAL: Fix EOS/PAD alignment before merge
tokenizer.eos_token = "<|im_end|>"
tokenizer.eos_token_id = 151645
tokenizer.pad_token = "<|endoftext|>"
tokenizer.pad_token_id = 151643

print(f"EOS: {tokenizer.eos_token} ({tokenizer.eos_token_id})")
print(f"PAD: {tokenizer.pad_token} ({tokenizer.pad_token_id})")
assert tokenizer.eos_token_id != tokenizer.pad_token_id, "FATAL: EOS == PAD"

# Merge
model = model.merge_and_unload()

# Verify tie_word_embeddings survived merge
print(f"tie_word_embeddings: {model.config.tie_word_embeddings}")

# Export with Unsloth's native GGUF (embeds chat template + correct EOS)
model.save_pretrained_gguf(
    "kubi1-sft-merged",
    tokenizer,
    quantization_method=["q5_k_m", "q4_k_m"],
)

# Push to HF
if hf_token:
    model.push_to_hub_gguf(
        "atilladeniz/kubi1-gguf-budget-v2",
        tokenizer,
        quantization_method=["q5_k_m", "q4_k_m"],
        token=hf_token,
        private=True,
    )
```

### Option B: Fix the manual export (if Unsloth export also fails)

1. Verify the merged model's tokenizer_config.json has correct special tokens
2. Add `eos_token_id` override to the generation_config.json
3. Use `--override-kv tokenizer.ggml.eos_token_id=uint32:151643` in convert_hf_to_gguf.py
4. Embed chat template manually in GGUF metadata

### Option C: Fix only the Ollama Modelfile (quickest test)

Use Ollama's native Qwen3 template instead of a custom one:
```
ollama show qwen3:4b --template
```
Then apply that exact template to our GGUF.

### Option D: Check if train_on_responses_only masks <|im_end|>

The garbage tokens may also indicate that `train_on_responses_only()` masked
the `<|im_end|>` token at the end of assistant turns during SFT. If so, the
model never learned to produce this token.

Verification: print sample labels after applying response-only masking.
If the last token of each assistant turn is -100, the model never trained on EOS.

Fix: ensure the `<|im_end|>` token is NOT masked in the loss.

## Verification Checklist

After any re-export:

- [ ] `gguf-dump kubi1-Q5_K_M.gguf | grep eos` shows 151643
- [ ] `gguf-dump kubi1-Q5_K_M.gguf | grep template` shows correct ChatML
- [ ] `ollama run kubi1 "What is a Pod?"` stops after 2-3 sentences
- [ ] No garbage tokens in any of the 12 test cases
- [ ] No system prompt leak
- [ ] No repetition loops

## Cost Estimate

- Option A (Unsloth re-export): ~$0.20-0.40 (A40, 30 min)
- Option B (manual fix): $0 if done locally, or same as A
- Option C (Modelfile fix): $0, immediate

Recommended: Try Option C first (free), then Option A if needed.
