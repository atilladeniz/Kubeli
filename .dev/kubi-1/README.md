# Kubi-1: Kubeli's Local K8s AI Model

Fine-tuned LLM for Kubernetes troubleshooting that runs entirely on-device.

## Key Decisions

- **Default model family**: Kubi-1 Nano / Kubi-1 / Kubi-1 Pro
- **Primary base**: Qwen3-4B for the mainline model
- **Inference**: `llama.cpp` as Tauri sidecar, no third-party install required
- **Training**: QLoRA and CPT via Unsloth on the local RTX 3090
- **Data**: GitHub K8s docs + StackOverflow + k8sgpt patterns + synthetic pairs
- **Advanced compatibility**: optional Ollama Modelfiles for users who want external testing

## Why No Ollama by Default?

Bundling `llama-server` means:
- User downloads Kubeli and can stay inside Kubeli for setup
- No extra "install Ollama" step
- OpenAI-compatible REST API with full control over configuration
- Native Metal on Mac and portable CPU/GPU variants on desktop platforms

Ollama remains useful for compatibility testing and power-user workflows, but it is no longer the main architecture.

## Directory Structure

```text
.dev/kubi-1/
├── README.md
├── SETUP-WINDOWS.md
├── SETUP-CONNECTION.md
├── training/
│   ├── train_kubi1.py
│   ├── remote_train.sh
│   └── train_cpt.py                # planned
├── data/
│   ├── harvest_k8s.py
│   ├── load_hf_datasets.py
│   ├── convert_docs.py
│   ├── merge_and_filter.py
│   ├── generate_refusals.py
│   ├── prepare_cpt_corpus.py
│   ├── generate_synthetic.py       # planned
│   ├── test_setup.py
│   ├── raw/
│   ├── processed/
│   └── final/
├── eval/
│   ├── test_cases/                 # planned
│   ├── results/                    # planned
│   └── eval.py                     # planned
└── models/
```

## Model Candidates (March 2026)

| Model | Role | Context | Notes |
|-------|------|---------|------|
| **Qwen3-4B** | Mainline default | 32K | proven fine-tune base |
| Qwen3-1.7B | Nano | 32K | smaller, faster fallback |
| Qwen3-8B | Pro | 32K | larger quality tier |
| Qwen3.5-4B | Research candidate | 256K | likely v2 fine-tune candidate |
| Qwen3-30B-A3B | Research candidate | 32K | MoE fallback candidate |
| Nemotron-3-Nano-4B | Research candidate | 262K+ | experimental long-context eval |

## Quick Start

```bash
# 1. Set up the Windows training box

# 2. Harvest and prepare data on the Mac
cd data && GITHUB_TOKEN=ghp_xxx python harvest_k8s.py
python load_hf_datasets.py
python convert_docs.py
python generate_refusals.py --count 5000
python merge_and_filter.py

# 3. Verify local training environment
python test_setup.py

# 4. Start remote training
cd ../training && ./remote_train.sh --monitor

# 5. Test the exported GGUF directly
llama-server --model ../models/kubeli-k8s-4b-Q4_K_M.gguf --port 8080

# Optional compatibility test
ollama create kubeli-k8s:4b -f ../models/Modelfile
```

## Hardware

| Machine | Role | Specs |
|---------|------|-------|
| MacBook Air M4 | Dev, data prep, eval, inference testing | M4, 32GB, Metal 3 |
| Windows Desktop | Training server | RTX 3090 24GB VRAM, CUDA 12 |
