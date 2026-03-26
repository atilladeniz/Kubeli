# Kubi-1: Kubeli's Local K8s AI Model

Fine-tuned LLM for Kubernetes troubleshooting — runs entirely on-device, no third-party tools needed.

## Key Decisions

- **Model**: Qwen3-4B (fine-tuned) — best tool-calling + thinking at this size
- **Alternative**: Nemotron-3-Nano-4B — NVIDIA's 1M context, ~3GB RAM, worth evaluating
- **Inference**: **llama.cpp as Tauri sidecar** — no Ollama required, zero user setup
- **Training**: QLoRA via Unsloth on local RTX 3090 (Windows)
- **Data**: GitHub K8s docs + StackOverflow + k8sgpt patterns + synthetic

## Why No Ollama?

Bundling `llama-server` (from llama.cpp) as a Tauri sidecar means:
- ✅ User downloads Kubeli → works immediately (model auto-downloads)
- ✅ No "install Ollama" step — zero friction
- ✅ OpenAI-compatible REST API (same as Ollama uses internally)
- ✅ Native Metal on Mac, CUDA on Windows/Linux — no MLX dependency
- ✅ Full control over version, security, and configuration
- ❌ Larger app bundle (+5-10MB for llama-server binary)

## Directory Structure

```
.dev/kubi-1/
├── README.md                  # This file
├── SETUP-WINDOWS.md           # Windows RTX 3090 training server setup
├── SETUP-CONNECTION.md        # Mac ↔ Windows remote training guide
├── training/
│   ├── train_kubi1.py         # Unsloth QLoRA training script
│   ├── remote_train.sh        # One-command remote training
│   ├── eval.py                # Evaluation against test set
│   └── export_gguf.py         # GGUF export + Modelfile
├── data/
│   ├── harvest_k8s.py         # GitHub K8s docs harvester
│   ├── load_hf_datasets.py    # Download HuggingFace datasets
│   ├── convert_docs.py        # MD → instruction pairs
│   ├── merge_and_filter.py    # Dedup, quality filter, balance
│   ├── raw/                   # Downloaded source files (gitignored)
│   ├── processed/             # Per-source JSONL files
│   └── final/                 # Merged training + eval sets
├── eval/
│   ├── test_cases/            # 500 hand-crafted test cases
│   └── results/               # Per-model evaluation results
├── models/                    # Exported GGUF files (gitignored)
└── cloud/                     # Cloud GPU scripts (Vast.ai fallback)
```

## Model Candidates (March 2026)

| Model | Params | RAM (Q4) | Context | Tool Calling | Thinking | License |
|-------|--------|----------|---------|-------------|----------|---------|
| **Qwen3-4B** | 4B | ~3GB | 32K | ✅ 0.880 | ✅ | Apache 2.0 |
| **Nemotron-3-Nano-4B** | 4B | ~3GB | **1M** | ✅ | ✅ | Apache 2.0 |
| Qwen3.5-4B | 4B | ~3GB | 256K | ✅ improved | ✅ | Apache 2.0 |
| Qwen3-30B-A3B (MoE) | ~3B active | ~4GB | 32K | ✅ | ✅ | Apache 2.0 |

**Top pick: Qwen3-4B** (most proven for fine-tuning, Unsloth-optimized)
**Worth testing: Nemotron-3-Nano-4B** (1M context, NVIDIA-backed, same RAM)

## Quick Start

```bash
# 1. Set up Windows training box (see SETUP-WINDOWS.md + SETUP-CONNECTION.md)

# 2. Harvest K8s docs (on Mac)
cd data && GITHUB_TOKEN=ghp_xxx python harvest_k8s.py

# 3. Prepare dataset
python load_hf_datasets.py
python convert_docs.py
python merge_and_filter.py

# 4. Train on Windows RTX 3090
cd ../training && ./remote_train.sh --monitor

# 5. Test the model
ollama create kubeli-k8s:4b -f ../models/Modelfile
# or directly via llama-server:
llama-server --model ../models/kubeli-k8s-4b-Q4_K_M.gguf --port 8080
```

## Hardware

| Machine | Role | Specs |
|---------|------|-------|
| MacBook Air M4 | Dev, data prep, eval, inference testing | M4, 32GB, Metal 3 |
| Windows Desktop | Training server | RTX 3090 24GB VRAM, CUDA 12 |
