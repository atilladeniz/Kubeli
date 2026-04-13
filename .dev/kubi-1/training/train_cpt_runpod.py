#!/usr/bin/env python3
"""
Kubi-1: CPT on RunPod (RTX 4090 / A100)
Full quality: bf16 LoRA, rank 128, seq 4096

Usage on RunPod:
  pip install unsloth wandb
  wandb login
  python train_cpt_runpod.py

After training, the CPT adapter is saved to HuggingFace.
"""

import os
import torch

# --- Config ---
BASE_MODEL = "unsloth/Qwen3-4B-Base"
DATASET = "atilladeniz/kubi1-data"
DATASET_FILE = "cpt_corpus.jsonl"
HF_TOKEN = os.environ.get("HF_TOKEN", "")
ADAPTER_REPO = "atilladeniz/kubi1-checkpoints"

MAX_SEQ_LENGTH = 4096
LORA_RANK = 128
BATCH_SIZE = 4       # RTX 4090: 4, A100: 8
GRAD_ACCUM = 4       # effective batch = 16 (4090) or 32 (A100)
EPOCHS = 1
LR = 5e-5
EMBED_LR = 5e-6

print("=" * 60)
print("  Kubi-1 CPT — RunPod Edition")
print("=" * 60)
print(f"  GPU:       {torch.cuda.get_device_name(0)}")
print(f"  VRAM:      {torch.cuda.get_device_properties(0).total_memory / 1024**3:.0f} GB")
print(f"  Model:     {BASE_MODEL}")
print(f"  Rank:      {LORA_RANK}")
print(f"  Seq:       {MAX_SEQ_LENGTH}")
print(f"  Batch:     {BATCH_SIZE} x {GRAD_ACCUM} = {BATCH_SIZE * GRAD_ACCUM}")
print("=" * 60)

if not HF_TOKEN:
    raise ValueError("Set HF_TOKEN in the environment before running this script.")

# Auto-adjust batch size based on VRAM
vram = torch.cuda.get_device_properties(0).total_memory / 1024**3
if vram >= 70:  # A100/H100
    BATCH_SIZE = 8
    GRAD_ACCUM = 4
    print(f"  Auto: A100/H100 detected, batch={BATCH_SIZE}")
elif vram >= 20:  # RTX 4090/3090
    BATCH_SIZE = 2
    GRAD_ACCUM = 8
    print(f"  Auto: 24GB GPU detected, batch={BATCH_SIZE}")

# --- Load model ---
from unsloth import FastLanguageModel

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=BASE_MODEL,
    max_seq_length=MAX_SEQ_LENGTH,
    dtype=None,
    load_in_4bit=False,  # bf16 LoRA (full quality, enough VRAM on 4090+)
    token=HF_TOKEN,
)

# Fix Qwen3 EOS/PAD alignment (ChatML needs <|im_end|> as stop signal)
tokenizer.eos_token = "<|im_end|>"
tokenizer.eos_token_id = 151645
tokenizer.pad_token = "<|endoftext|>"
tokenizer.pad_token_id = 151643
assert tokenizer.eos_token_id != tokenizer.pad_token_id, "FATAL: EOS == PAD"
print(f"  EOS: {repr(tokenizer.eos_token)} ({tokenizer.eos_token_id})")
print(f"  PAD: {repr(tokenizer.pad_token)} ({tokenizer.pad_token_id})")

model = FastLanguageModel.get_peft_model(
    model,
    r=LORA_RANK,
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
        "lm_head", "embed_tokens",
    ],
    lora_alpha=LORA_RANK,
    use_rslora=True,
    lora_dropout=0,
    use_gradient_checkpointing="unsloth",
)

# --- Load dataset from HuggingFace ---
from datasets import load_dataset

print(f"\nLoading dataset: {DATASET}/{DATASET_FILE}")
dataset = load_dataset(DATASET, data_files=DATASET_FILE, split="train", token=HF_TOKEN)
print(f"  {len(dataset)} chunks loaded")

# --- Train ---
from unsloth import UnslothTrainer, UnslothTrainingArguments, unsloth_train

training_args = UnslothTrainingArguments(
    per_device_train_batch_size=BATCH_SIZE,
    gradient_accumulation_steps=GRAD_ACCUM,
    num_train_epochs=EPOCHS,
    learning_rate=LR,
    embedding_learning_rate=EMBED_LR,
    fp16=not torch.cuda.is_bf16_supported(),
    bf16=torch.cuda.is_bf16_supported(),
    output_dir="./checkpoints",
    logging_steps=1,
    save_strategy="steps",
    save_steps=500,
    save_total_limit=3,
    optim="adamw_8bit",
    lr_scheduler_type="cosine",
    warmup_ratio=0.05,
    max_grad_norm=1.0,
    weight_decay=0.01,
    seed=42,
    report_to="wandb",
    run_name="kubi1-cpt-runpod",
    dataloader_num_workers=4,
)

trainer = UnslothTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=dataset,
    dataset_text_field="text",
    max_seq_length=MAX_SEQ_LENGTH,
    args=training_args,
)

trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
total = sum(p.numel() for p in model.parameters())
print(f"\n  Params: {trainable:,} / {total:,} ({100*trainable/total:.1f}%)")

print("\nStarting training...")
unsloth_train(trainer)
print("\nTraining complete!")

# --- Save adapter to HuggingFace ---
print(f"\nPushing adapter to: {ADAPTER_REPO}")
try:
    model.push_to_hub(ADAPTER_REPO, token=HF_TOKEN, private=True)
    tokenizer.push_to_hub(ADAPTER_REPO, token=HF_TOKEN, private=True)
    print(f"Adapter saved: https://huggingface.co/{ADAPTER_REPO}")
except Exception as e:
    # Fallback: save locally
    model.save_pretrained("./kubi1-cpt-adapter")
    tokenizer.save_pretrained("./kubi1-cpt-adapter")
    print(f"Saved locally (upload failed: {e})")

print("\nDone! Next: merge adapter, then run SFT.")
