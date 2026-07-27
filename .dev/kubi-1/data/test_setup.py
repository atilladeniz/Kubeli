#!/usr/bin/env python3
"""Quick environment check for the Kubi-1 training box."""

from __future__ import annotations

import sys

import torch
from unsloth import FastLanguageModel


def main() -> int:
    print(f"PyTorch: {torch.__version__}")
    print(f"CUDA available: {torch.cuda.is_available()}")

    if not torch.cuda.is_available():
        print("CUDA is not available. Training setup is incomplete.", file=sys.stderr)
        return 1

    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name="unsloth/Qwen3-4B",
        max_seq_length=2048,
        load_in_4bit=True,
    )
    print("Model load OK")

    inputs = tokenizer("Hello from Kubi-1", return_tensors="pt").to("cuda")
    outputs = model.generate(**inputs, max_new_tokens=10)
    print(f"Generation OK: {tokenizer.decode(outputs[0])}")
    print("Environment check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
