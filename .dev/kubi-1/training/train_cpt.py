#!/usr/bin/env python3
"""
Kubi-1: Continued Pretraining (CPT) on K8s corpus.
Phase 1 — shifts model distribution toward K8s knowledge.

Supports local (RTX 3060/4090) and cloud (RunPod A40/A100) training.
Reads HF_TOKEN from environment variable.

Usage:
  python train_cpt.py
  python train_cpt.py --resume
  python train_cpt.py --base-model unsloth/Qwen3-4B-Base-bnb-4bit
"""

import argparse
import os
import torch
from pathlib import Path


def parse_args():
    p = argparse.ArgumentParser(description="Kubi-1 Continued Pretraining")
    p.add_argument("--base-model", default="unsloth/Qwen3-4B-Base-bnb-4bit")
    p.add_argument("--dataset", default=None,
                    help="CPT corpus JSONL path or HF dataset ID")
    p.add_argument("--max-seq-length", type=int, default=2048)
    p.add_argument("--lora-rank", type=int, default=32)
    p.add_argument("--batch-size", type=int, default=2)
    p.add_argument("--grad-accum", type=int, default=8)
    p.add_argument("--epochs", type=int, default=1)
    p.add_argument("--lr", type=float, default=5e-5)
    p.add_argument("--embed-lr", type=float, default=5e-6)
    p.add_argument("--max-chunks", type=int, default=5000,
                    help="Max chunks to use (0 = all)")
    p.add_argument("--output-dir", default="./checkpoints/cpt")
    p.add_argument("--adapter-dir", default="./adapters/kubi1-cpt")
    p.add_argument("--hf-repo", default=None,
                    help="HuggingFace repo for checkpoints (adapter on main, merged on 'merged' branch)")
    p.add_argument("--resume", action="store_true")
    p.add_argument("--save-steps", type=int, default=200)
    p.add_argument("--no-4bit", action="store_true",
                    help="Use bf16 LoRA instead of QLoRA 4-bit (needs more VRAM)")
    return p.parse_args()


def find_dataset():
    """Auto-detect CPT corpus location."""
    candidates = [
        Path("/mnt/e/kubi-training/scripts/final/cpt_corpus.jsonl"),
        Path("../data/final/cpt_corpus.jsonl"),
        Path("./data/final/cpt_corpus.jsonl"),
    ]
    for c in candidates:
        if c.exists():
            return str(c.resolve())
    return None


def main():
    args = parse_args()
    hf_token = os.environ.get("HF_TOKEN", "")

    # Find dataset
    dataset_path = args.dataset or find_dataset()
    use_hf_dataset = dataset_path is None

    print("=" * 60)
    print("  Kubi-1 — Continued Pretraining (CPT)")
    print("=" * 60)
    print(f"  Model:     {args.base_model}")
    print(f"  Rank:      {args.lora_rank}")
    print(f"  Batch:     {args.batch_size} x {args.grad_accum} = {args.batch_size * args.grad_accum}")
    print(f"  Seq len:   {args.max_seq_length}")
    print(f"  GPU:       {torch.cuda.get_device_name(0)}")
    print(f"  VRAM:      {torch.cuda.get_device_properties(0).total_memory / 1024**3:.0f} GB")
    print("=" * 60)

    from unsloth import FastLanguageModel

    use_4bit = not args.no_4bit
    if not use_4bit:
        # bf16 LoRA: better quality but needs ~24GB+ VRAM for 4B model
        base = args.base_model.replace("-bnb-4bit", "")
        print(f"  Mode:      bf16 LoRA (full quality)")
    else:
        base = args.base_model
        print(f"  Mode:      QLoRA 4-bit")

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=base,
        max_seq_length=args.max_seq_length,
        dtype=None,
        load_in_4bit=use_4bit,
        token=hf_token or None,
    )

    # Fix Qwen3 EOS/PAD alignment (ChatML needs <|im_end|> as stop signal)
    # See: https://github.com/QwenLM/Qwen3/issues/1064
    tokenizer.eos_token = "<|im_end|>"
    tokenizer.eos_token_id = 151645
    tokenizer.pad_token = "<|endoftext|>"
    tokenizer.pad_token_id = 151643
    assert tokenizer.eos_token_id != tokenizer.pad_token_id, "FATAL: EOS == PAD"
    print(f"  EOS: {repr(tokenizer.eos_token)} ({tokenizer.eos_token_id})")
    print(f"  PAD: {repr(tokenizer.pad_token)} ({tokenizer.pad_token_id})")

    model = FastLanguageModel.get_peft_model(
        model, r=args.lora_rank,
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
            "lm_head", "embed_tokens",
        ],
        lora_alpha=args.lora_rank,
        use_rslora=True,
        lora_dropout=0,
        use_gradient_checkpointing="unsloth",
    )

    # Load dataset
    from datasets import load_dataset

    if use_hf_dataset:
        print("Loading from HuggingFace...")
        dataset = load_dataset("atilladeniz/kubi-1-data",
                               data_files="cpt_corpus.jsonl",
                               split="train", token=hf_token)
    else:
        print(f"Loading from: {dataset_path}")
        dataset = load_dataset("json", data_files=dataset_path, split="train")

    if args.max_chunks > 0:
        dataset = dataset.select(range(min(args.max_chunks, len(dataset))))
    print(f"  {len(dataset)} chunks")

    # Train
    from unsloth import UnslothTrainer, UnslothTrainingArguments, unsloth_train

    os.makedirs(args.output_dir, exist_ok=True)

    training_args = UnslothTrainingArguments(
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        num_train_epochs=args.epochs,
        learning_rate=args.lr,
        embedding_learning_rate=args.embed_lr,
        fp16=not torch.cuda.is_bf16_supported(),
        bf16=torch.cuda.is_bf16_supported(),
        output_dir=args.output_dir,
        logging_steps=10,
        save_strategy="steps",
        save_steps=args.save_steps,
        save_total_limit=2,
        optim="adamw_8bit",
        lr_scheduler_type="cosine",
        warmup_ratio=0.1,
        max_grad_norm=1.0,
        seed=42,
        report_to="none",
    )

    trainer = UnslothTrainer(
        model=model, tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=args.max_seq_length,
        args=training_args,
    )

    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    print(f"  Params: {trainable:,} / {total:,} ({100*trainable/total:.1f}%)")

    if args.resume and Path(args.output_dir).exists():
        cps = sorted(Path(args.output_dir).glob("checkpoint-*"))
        if cps:
            print(f"  Resuming from: {cps[-1]}")
            unsloth_train(trainer, resume_from_checkpoint=True)
        else:
            unsloth_train(trainer)
    else:
        unsloth_train(trainer)

    print("\nCPT complete!")

    # Save adapter locally
    os.makedirs(args.adapter_dir, exist_ok=True)
    model.save_pretrained(args.adapter_dir)
    tokenizer.save_pretrained(args.adapter_dir)
    print(f"Adapter saved: {args.adapter_dir}")

    # Push to HuggingFace (if token available)
    if hf_token and args.hf_repo:
        model.push_to_hub(args.hf_repo, token=hf_token, private=True)
        tokenizer.push_to_hub(args.hf_repo, token=hf_token, private=True)
        # Save merged model for SFT (same repo, "merged" branch)
        model.push_to_hub_merged(args.hf_repo, tokenizer,
                                  save_method="merged_16bit",
                                  token=hf_token, private=True,
                                  revision="merged")
        print(f"Pushed to: {args.hf_repo} (adapter: main, merged: merged branch)")

    print("Next: python train_kubi1.py --base-model ./adapters/kubi1-cpt")


if __name__ == "__main__":
    main()
