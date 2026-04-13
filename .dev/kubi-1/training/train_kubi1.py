#!/usr/bin/env python3
"""
Kubi-1: SFT fine-tuning for K8s troubleshooting.
Phase 2 — run after CPT (train_cpt.py).

Loads the MERGED CPT model (not adapter) and applies fresh LoRA for SFT.
Uses Unsloth's native chat template system (get_chat_template) for proper
EOS handling and GGUF export.

Reads HF_TOKEN from environment variable.

Usage:
  python train_kubi1.py
  python train_kubi1.py --base-model ./merged-cpt
  python train_kubi1.py --resume
"""

import argparse
import os
import torch
from pathlib import Path

SYSTEM_PROMPT = (
    "You are Kubi-1, the Kubernetes specialist assistant of the Kubeli project. "
    "Stay focused on Kubernetes topics such as pods, services, deployments, RBAC, "
    "networking, manifests, logs, and troubleshooting. "
    "Prefer concise, structured analysis. Explain findings and likely causes first. "
    "Do not reveal secret values or environment variable contents. "
    "Do not claim to perform destructive cluster changes. "
    "If a question is off-topic, state that you focus on Kubernetes and redirect to a relevant Kubernetes task."
)


def parse_args():
    p = argparse.ArgumentParser(description="Kubi-1 SFT Training")
    p.add_argument("--base-model", default=None,
                    help="Merged CPT model path or HF repo")
    p.add_argument("--dataset", default=None,
                    help="SFT dataset JSONL path or HF dataset ID")
    p.add_argument("--max-seq-length", type=int, default=4096)
    p.add_argument("--lora-rank", type=int, default=32)
    p.add_argument("--batch-size", type=int, default=4)
    p.add_argument("--grad-accum", type=int, default=4)
    p.add_argument("--epochs", type=int, default=2)
    p.add_argument("--lr", type=float, default=2e-4)
    p.add_argument("--output-dir", default="./checkpoints/sft")
    p.add_argument("--export-dir", default="./exports/kubi1-gguf")
    p.add_argument("--hf-repo", default=None,
                    help="HuggingFace repo to push GGUF (optional)")
    p.add_argument("--resume", action="store_true")
    p.add_argument("--skip-export", action="store_true")
    p.add_argument("--train-on-responses-only",
                    action=argparse.BooleanOptionalAction,
                    default=True,
                    help="Mask user turns so the loss only trains assistant responses.")
    return p.parse_args()


def find_base_model():
    """Auto-detect merged CPT model."""
    candidates = [
        Path("/mnt/e/kubi-training/adapters/kubi1-cpt-merged"),
        Path("./adapters/kubi1-cpt-merged"),
        Path("./merged-cpt"),
    ]
    for c in candidates:
        if c.exists():
            return str(c)
    return None


def find_dataset():
    """Auto-detect SFT dataset."""
    candidates = [
        Path("/mnt/e/kubi-training/scripts/final/kubeli-k8s-train.jsonl"),
        Path("../data/final/kubeli-k8s-train.jsonl"),
        Path("./data/final/kubeli-k8s-train.jsonl"),
    ]
    for c in candidates:
        if c.exists():
            return str(c.resolve())
    return None


def convert_to_sharegpt(example):
    """Convert instruction/input/output format to ShareGPT conversations."""
    instruction = example.get("instruction", "")
    input_text = example.get("input", "")
    output = example.get("output", "")

    user_content = f"{instruction}\n\n{input_text}" if input_text else instruction

    return {"conversations": [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
        {"role": "assistant", "content": output},
    ]}


def main():
    args = parse_args()
    hf_token = os.environ.get("HF_TOKEN", "")
    gguf_quantizations = ["q4_k_m", "q5_k_m"]

    # Find base model (merged CPT or HF repo)
    base_model = args.base_model or find_base_model()
    if not base_model:
        base_model = "atilladeniz/kubi1-cpt-merged"  # fallback to HF
    use_hf_dataset = args.dataset is None and find_dataset() is None

    dataset_path = args.dataset or find_dataset()

    print("=" * 60)
    print("  Kubi-1 — SFT (Phase 2)")
    print("=" * 60)
    print(f"  Base:      {base_model}")
    print(f"  Rank:      {args.lora_rank}")
    print(f"  Batch:     {args.batch_size} x {args.grad_accum} = {args.batch_size * args.grad_accum}")
    print(f"  Epochs:    {args.epochs}")
    print(f"  GPU:       {torch.cuda.get_device_name(0)}")
    print(f"  VRAM:      {torch.cuda.get_device_properties(0).total_memory / 1024**3:.0f} GB")
    print("=" * 60)

    from unsloth import FastLanguageModel
    from unsloth.chat_templates import get_chat_template, train_on_responses_only

    # Load merged CPT model, apply fresh LoRA for SFT.
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=base_model,
        max_seq_length=args.max_seq_length,
        dtype=None,
        load_in_4bit=True,
        token=hf_token or None,
    )

    # Use Unsloth's native chat template system instead of manual formatting.
    # This correctly configures EOS tokens, chat template, and map_eos_token
    # so that <|im_end|> is properly handled in training AND GGUF export.
    # See: https://unsloth.ai/docs/basics/chat-templates
    tokenizer = get_chat_template(tokenizer, chat_template="chatml")

    # Verify EOS/PAD after template application
    print(f"  EOS: {repr(tokenizer.eos_token)} (id={tokenizer.eos_token_id})")
    print(f"  PAD: {repr(tokenizer.pad_token)} (id={tokenizer.pad_token_id})")
    print(f"  Chat template: {len(tokenizer.chat_template)} chars")
    if tokenizer.pad_token_id == tokenizer.eos_token_id:
        # Fallback: fix manually if get_chat_template didn't separate them
        tokenizer.pad_token = "<|endoftext|>"
        tokenizer.pad_token_id = 151643
        print(f"  Fixed PAD: {repr(tokenizer.pad_token)} (id={tokenizer.pad_token_id})")
    assert tokenizer.eos_token_id != tokenizer.pad_token_id, "FATAL: EOS == PAD"

    # Fresh LoRA for SFT (no lm_head/embed_tokens)
    model = FastLanguageModel.get_peft_model(
        model, r=args.lora_rank,
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
        lora_alpha=args.lora_rank,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing="unsloth",
    )

    # Load dataset
    from datasets import load_dataset

    if use_hf_dataset:
        dataset = load_dataset("atilladeniz/kubi1-sft-dataset",
                               data_files="kubeli-k8s-train.jsonl",
                               split="train", token=hf_token)
    else:
        dataset = load_dataset("json", data_files=dataset_path, split="train")

    print(f"  Dataset: {len(dataset)} examples")

    # Convert to ShareGPT format and apply chat template via tokenizer
    dataset = dataset.map(convert_to_sharegpt, remove_columns=dataset.column_names)

    def apply_template(examples):
        texts = [
            tokenizer.apply_chat_template(
                convo, tokenize=False, add_generation_prompt=False,
            )
            for convo in examples["conversations"]
        ]
        return {"text": texts}

    dataset = dataset.map(apply_template, batched=True, remove_columns=["conversations"])

    # Print a sample to verify formatting
    print("\n  Sample formatted text (first 500 chars):")
    print(f"  {dataset[0]['text'][:500]}")
    print()

    # Train
    from unsloth import UnslothTrainer, UnslothTrainingArguments, unsloth_train

    os.makedirs(args.output_dir, exist_ok=True)

    training_args = UnslothTrainingArguments(
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        num_train_epochs=args.epochs,
        learning_rate=args.lr,
        fp16=not torch.cuda.is_bf16_supported(),
        bf16=torch.cuda.is_bf16_supported(),
        output_dir=args.output_dir,
        logging_steps=10,
        save_strategy="steps",
        save_steps=500,
        save_total_limit=2,
        optim="adamw_8bit",
        lr_scheduler_type="linear",
        warmup_steps=50,
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

    if args.train_on_responses_only:
        trainer = train_on_responses_only(
            trainer,
            instruction_part="<|im_start|>user\n",
            response_part="<|im_start|>assistant\n",
        )

        # Verify the masking includes <|im_end|> at end of assistant turns.
        # If masked, the model never learns to stop → infinite generation.
        sample_labels = trainer.train_dataset[0]["labels"]
        im_end_id = tokenizer.convert_tokens_to_ids("<|im_end|>")
        trained_ids = [t for t in sample_labels if t != -100]
        if im_end_id not in trained_ids:
            print(f"  CRITICAL: <|im_end|> (id={im_end_id}) is masked in loss!")
            print(f"  The model will NOT learn to stop generating.")
            print(f"  Disabling response-only masking as safety fallback.")
            trainer = UnslothTrainer(
                model=model, tokenizer=tokenizer,
                train_dataset=dataset,
                dataset_text_field="text",
                max_seq_length=args.max_seq_length,
                args=training_args,
            )
        else:
            print(f"  Response-only masking OK: <|im_end|> (id={im_end_id}) is in loss")

    print("  Training started...")

    if args.resume and Path(args.output_dir).exists():
        cps = sorted(Path(args.output_dir).glob("checkpoint-*"))
        if cps:
            unsloth_train(trainer, resume_from_checkpoint=True)
        else:
            unsloth_train(trainer)
    else:
        unsloth_train(trainer)

    print("\nSFT complete!")

    # Export GGUF
    if not args.skip_export:
        os.makedirs(args.export_dir, exist_ok=True)

        # Verify chat template is present (get_chat_template should have set it)
        if not getattr(tokenizer, "chat_template", None):
            raise RuntimeError(
                "Chat template missing after get_chat_template()! "
                "This should not happen — check Unsloth version."
            )
        print(f"  Chat template: {len(tokenizer.chat_template)} chars (will be embedded in GGUF)")

        print(f"Exporting GGUF to {args.export_dir}...")
        model.save_pretrained_gguf(
            args.export_dir, tokenizer,
            quantization_method=gguf_quantizations,
        )
        print(f"GGUF exported: {', '.join(gguf_quantizations)}")

        # Push to HuggingFace
        if hf_token and args.hf_repo:
            model.push_to_hub_gguf(args.hf_repo, tokenizer,
                                    quantization_method=gguf_quantizations,
                                    token=hf_token, private=True)
            print(f"Pushed to: {args.hf_repo}")

    print("\nDone! Test with:")
    print(f"  llama-server --model {args.export_dir}/unsloth.Q5_K_M.gguf --port 8080")
    print(f"  ollama create kubi1 -f Modelfile")


if __name__ == "__main__":
    main()
