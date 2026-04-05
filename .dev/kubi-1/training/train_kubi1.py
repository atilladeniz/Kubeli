#!/usr/bin/env python3
"""
Kubi-1: SFT fine-tuning on Qwen3-4B for K8s troubleshooting.
Phase 2: Run after CPT (train_cpt.py). Uses CPT adapter as base.
Hardware: 2x RTX 3060 (12GB each)

Usage:
  python train_kubi1.py
  python train_kubi1.py --base-model /mnt/e/kubi-training/adapters/kubi1-cpt --epochs 2
  python train_kubi1.py --resume
"""

import argparse
import torch
from pathlib import Path


def parse_args():
    p = argparse.ArgumentParser(description="Train Kubi-1 K8s model")
    p.add_argument("--base-model", default="/mnt/e/kubi-training/adapters/kubi1-cpt",
                    help="Base model or CPT adapter (default: CPT adapter)")
    p.add_argument("--dataset", default="/mnt/e/kubi-training/scripts/final/kubeli-k8s-train.jsonl",
                    help="Training dataset JSONL")
    p.add_argument("--max-seq-length", type=int, default=4096,
                    help="Max sequence length (default: 4096)")
    p.add_argument("--lora-rank", type=int, default=32,
                    help="LoRA rank (default: 32)")
    p.add_argument("--batch-size", type=int, default=2,
                    help="Per-device batch size (default: 2 for 12GB GPU)")
    p.add_argument("--grad-accum", type=int, default=8,
                    help="Gradient accumulation steps (default: 8)")
    p.add_argument("--epochs", type=int, default=2,
                    help="Training epochs (default: 2)")
    p.add_argument("--lr", type=float, default=2e-4,
                    help="Learning rate (default: 2e-4)")
    p.add_argument("--output-dir", default="/mnt/e/kubi-training/checkpoints/sft",
                    help="Checkpoint output directory")
    p.add_argument("--export-name", default="/mnt/e/kubi-training/exports/kubeli-k8s-4b",
                    help="GGUF export path")
    p.add_argument("--resume", action="store_true",
                    help="Resume from last checkpoint")
    p.add_argument("--skip-export", action="store_true",
                    help="Skip GGUF export after training")
    return p.parse_args()


def format_prompt(example):
    """Format dataset example into chat template."""
    instruction = example.get("instruction", "")
    input_text = example.get("input", "")
    output = example.get("output", "")

    if input_text:
        text = (
            f"<|im_start|>user\n{instruction}\n\n{input_text}<|im_end|>\n"
            f"<|im_start|>assistant\n{output}<|im_end|>"
        )
    else:
        text = (
            f"<|im_start|>user\n{instruction}<|im_end|>\n"
            f"<|im_start|>assistant\n{output}<|im_end|>"
        )
    return {"text": text}


def main():
    args = parse_args()

    print("=" * 60)
    print("Kubi-1 Training")
    print("=" * 60)
    print(f"Base model:  {args.base_model}")
    print(f"Dataset:     {args.dataset}")
    print(f"LoRA rank:   {args.lora_rank}")
    print(f"Batch size:  {args.batch_size} × {args.grad_accum} = {args.batch_size * args.grad_accum}")
    print(f"Epochs:      {args.epochs}")
    print(f"Seq length:  {args.max_seq_length}")
    print(f"Device:      {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'}")
    if torch.cuda.is_available():
        vram = torch.cuda.get_device_properties(0).total_mem / 1024**3
        print(f"VRAM:        {vram:.1f} GB")
    print("=" * 60)

    # --- Load model ---
    from unsloth import FastLanguageModel

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.base_model,
        max_seq_length=args.max_seq_length,
        dtype=None,
        load_in_4bit=True,
        device_map="auto",  # Split across 2x RTX 3060
    )

    # --- Add LoRA ---
    model = FastLanguageModel.get_peft_model(
        model,
        r=args.lora_rank,
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
        lora_alpha=args.lora_rank,  # alpha = rank
        lora_dropout=0,  # Unsloth optimized
        bias="none",
        use_gradient_checkpointing="unsloth",  # 60% less VRAM
    )

    # --- Load dataset ---
    from datasets import load_dataset

    dataset_path = str(Path(args.dataset).resolve())
    print(f"\nLoading dataset: {dataset_path}")
    dataset = load_dataset("json", data_files=dataset_path, split="train")
    print(f"Dataset size: {len(dataset)} examples")

    dataset = dataset.map(format_prompt, remove_columns=dataset.column_names)

    # --- Train ---
    from trl import SFTTrainer
    from transformers import TrainingArguments

    output_dir = str(Path(args.output_dir).resolve())

    training_args = TrainingArguments(
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        warmup_steps=50,
        num_train_epochs=args.epochs,
        learning_rate=args.lr,
        fp16=not torch.cuda.is_bf16_supported(),
        bf16=torch.cuda.is_bf16_supported(),
        output_dir=output_dir,
        logging_steps=10,
        save_strategy="steps",
        save_steps=200,
        save_total_limit=3,
        optim="adamw_8bit",
        seed=42,
        report_to="none",
    )

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=args.max_seq_length,
        args=training_args,
    )

    print("\n🚀 Starting training...")
    if args.resume and Path(output_dir).exists():
        print("   Resuming from last checkpoint")
        trainer.train(resume_from_checkpoint=True)
    else:
        trainer.train()
    print("✅ Training complete!")

    # --- Export GGUF ---
    if not args.skip_export:
        export_dir = str(Path(args.export_name).resolve())
        print(f"\n📦 Exporting to GGUF: {export_dir}")
        model.save_pretrained_gguf(
            export_dir,
            tokenizer,
            quantization_method=["q4_k_m", "q5_k_m"],
        )

        # Create optional Ollama Modelfile for compatibility testing
        modelfile = Path(export_dir) / "Modelfile"
        modelfile.write_text(
            f'FROM ./{args.export_name}-Q4_K_M.gguf\n'
            'PARAMETER temperature 0.7\n'
            'PARAMETER top_p 0.8\n'
            'PARAMETER num_ctx 8192\n'
            'SYSTEM """You are a Kubernetes troubleshooting assistant in Kubeli.\n'
            'RULES:\n'
            '- Only reference resources listed in CONTEXT below\n'
            '- Reply "unknown" if unsure — never invent resource names\n'
            '- Output JSON: {"error":"...","cause":"...","fix":"...","commands":["..."]}\n'
            'COMMON PATTERNS:\n'
            '- CrashLoopBackOff: check logs for exit code, OOM, config errors\n'
            '- ImagePullBackOff: verify image name, registry auth, network\n'
            '- Pending: check node resources, taints, PVC binding\n'
            '- OOMKilled: compare memory limits vs actual usage\n'
            '"""\n'
        )
        print(f"✅ Optional Modelfile created: {modelfile}")
        print(
            "\nTo test directly: "
            f"llama-server --model {Path(export_dir) / f'{args.export_name}-Q4_K_M.gguf'} --port 8080"
        )
        print(f"Optional Ollama compatibility test: ollama create kubeli-k8s:4b -f {modelfile}")

    print("\n🎉 Done!")


if __name__ == "__main__":
    main()
