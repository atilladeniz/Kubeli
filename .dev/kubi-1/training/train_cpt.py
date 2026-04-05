#!/usr/bin/env python3
"""
Kubi-1: Continued Pretraining (CPT) on K8s corpus.
Phase 1 of the training pipeline — shifts model distribution toward K8s knowledge.

Hardware: RTX 3060 12GB (single GPU, QLoRA 4-bit to fit in 12GB)
Base: Qwen3-4B-Base (NOT Instruct)
Note: Multi-GPU device_map="auto" fails with Xformers attention bias device mismatch.

Usage:
  python train_cpt.py
  python train_cpt.py --resume
  python train_cpt.py --epochs 3 --batch-size 1

After CPT, run train_sft.py for Phase 2.
"""

import argparse
import os
import torch
from pathlib import Path


def parse_args():
    p = argparse.ArgumentParser(description="Kubi-1 Continued Pretraining")
    p.add_argument("--base-model", default="unsloth/Qwen3-4B-Base",
                    help="Base model (default: unsloth/Qwen3-4B-Base)")
    p.add_argument("--dataset", default=None,
                    help="CPT corpus JSONL (default: auto-detect)")
    p.add_argument("--max-seq-length", type=int, default=4096,
                    help="Max sequence length (default: 4096)")
    p.add_argument("--lora-rank", type=int, default=64,
                    help="LoRA rank for CPT (default: 64)")
    p.add_argument("--batch-size", type=int, default=4,
                    help="Per-device batch size (default: 4, QLoRA fits on 12GB)")
    p.add_argument("--grad-accum", type=int, default=8,
                    help="Gradient accumulation steps (default: 8, effective batch=32)")
    p.add_argument("--epochs", type=int, default=1,
                    help="Training epochs over CPT corpus (default: 1)")
    p.add_argument("--lr", type=float, default=5e-5,
                    help="Learning rate (default: 5e-5)")
    p.add_argument("--embed-lr", type=float, default=5e-6,
                    help="Embedding learning rate (default: 5e-6, 10x smaller)")
    p.add_argument("--output-dir", default="/mnt/e/kubi-training/checkpoints/cpt",
                    help="Checkpoint output directory")
    p.add_argument("--adapter-dir", default="/mnt/e/kubi-training/adapters/kubi1-cpt",
                    help="Final adapter output directory")
    p.add_argument("--resume", action="store_true",
                    help="Resume from last checkpoint")
    p.add_argument("--save-steps", type=int, default=500,
                    help="Save checkpoint every N steps")
    return p.parse_args()


def find_dataset():
    """Auto-detect CPT corpus location."""
    candidates = [
        Path("/mnt/e/kubi-training/scripts/final/cpt_corpus.jsonl"),
        Path("/mnt/e/kubi-training/data/final/cpt_corpus.jsonl"),
        Path("../data/final/cpt_corpus.jsonl"),
    ]
    for c in candidates:
        if c.exists():
            return str(c.resolve())
    raise FileNotFoundError(f"CPT corpus not found. Tried: {[str(c) for c in candidates]}")


def main():
    args = parse_args()
    dataset_path = args.dataset or find_dataset()

    num_gpus = torch.cuda.device_count()

    print("=" * 60)
    print("  Kubi-1 — Continued Pretraining (Phase 1)")
    print("=" * 60)
    print(f"  Base model:    {args.base_model}")
    print(f"  Dataset:       {dataset_path}")
    print(f"  LoRA rank:     {args.lora_rank}")
    print(f"  Batch:         {args.batch_size} × {args.grad_accum} = {args.batch_size * args.grad_accum} per GPU")
    print(f"  Epochs:        {args.epochs}")
    print(f"  Seq length:    {args.max_seq_length}")
    print(f"  LR:            {args.lr} (embeddings: {args.embed_lr})")
    print(f"  GPUs:          {num_gpus}")
    for i in range(num_gpus):
        name = torch.cuda.get_device_name(i)
        vram = torch.cuda.get_device_properties(i).total_memory / 1024**3
        print(f"    GPU {i}:       {name} — {vram:.0f} GB")
    print(f"  Output:        {args.output_dir}")
    print(f"  Adapter:       {args.adapter_dir}")
    print("=" * 60)

    # --- Load model ---
    print("\nLoading model...")
    from unsloth import FastLanguageModel

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.base_model,
        max_seq_length=args.max_seq_length,
        dtype=None,
        load_in_4bit=True,   # QLoRA to fit on single 12GB GPU
    )

    # --- Add LoRA for CPT ---
    # Higher rank + train embeddings for distribution shift
    model = FastLanguageModel.get_peft_model(
        model,
        r=args.lora_rank,
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
            "lm_head", "embed_tokens",  # Critical for CPT
        ],
        lora_alpha=32,
        use_rslora=True,  # Rank-stabilized LoRA
        lora_dropout=0,
        use_gradient_checkpointing="unsloth",
    )

    # --- Load CPT dataset ---
    from datasets import load_dataset

    print(f"\nLoading CPT corpus: {dataset_path}")
    dataset = load_dataset("json", data_files=dataset_path, split="train")
    print(f"  {len(dataset)} chunks loaded")

    # CPT uses raw text — the "text" field from cpt_corpus.jsonl
    # No instruction formatting needed

    # --- Train ---
    from unsloth import UnslothTrainer, UnslothTrainingArguments

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
        logging_dir=os.path.join(args.output_dir, "logs"),
        save_strategy="steps",
        save_steps=args.save_steps,
        save_total_limit=3,
        optim="adamw_8bit",
        warmup_ratio=0.05,
        max_grad_norm=1.0,
        seed=42,
        report_to="none",
    )

    trainer = UnslothTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=args.max_seq_length,
        args=training_args,
    )

    # Count parameters
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    print(f"\n  Parameters: {trainable:,} trainable / {total:,} total ({100*trainable/total:.1f}%)")

    # Estimate training time
    steps = len(dataset) // (args.batch_size * args.grad_accum * max(1, num_gpus)) * args.epochs
    print(f"  Estimated steps: ~{steps}")
    print(f"  Checkpoints every {args.save_steps} steps")

    print("\n" + "=" * 60)
    print("  Starting CPT training...")
    print("  Stop with: Ctrl+C or 'pkill -f train_cpt'")
    print("  Resume with: python train_cpt.py --resume")
    print("=" * 60 + "\n")

    if args.resume and Path(args.output_dir).exists():
        checkpoints = sorted(Path(args.output_dir).glob("checkpoint-*"))
        if checkpoints:
            print(f"  Resuming from: {checkpoints[-1]}")
            trainer.train(resume_from_checkpoint=True)
        else:
            print("  No checkpoints found, starting fresh")
            trainer.train()
    else:
        trainer.train()

    print("\nCPT training complete!")

    # --- Save adapter ---
    print(f"\nSaving CPT adapter to: {args.adapter_dir}")
    os.makedirs(args.adapter_dir, exist_ok=True)
    model.save_pretrained(args.adapter_dir)
    tokenizer.save_pretrained(args.adapter_dir)
    print(f"  Adapter saved. Use this as base for SFT (Phase 2).")
    print(f"\n  Next: python train_sft.py --base-model {args.adapter_dir}")


if __name__ == "__main__":
    main()
