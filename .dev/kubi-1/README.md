# Kubi-1: Kubeli's Local K8s AI Model

Fine-tuned LLM for Kubernetes troubleshooting that runs entirely on-device.

## Key Decisions

- **Default model family**: Kubi-1 Nano / Kubi-1 / Kubi-1 Pro
- **Primary base**: Qwen3-4B for the mainline model
- **Inference**: `llama.cpp` as Tauri sidecar, no third-party install required
- **Training**: QLoRA and CPT via Unsloth on RunPod (A40/A100)
- **Data**: GitHub K8s docs + StackOverflow + k8sgpt patterns + synthetic pairs
- **Advanced compatibility**: optional Ollama Modelfiles for users who want external testing

## HuggingFace Repos

| Repo | Type | Contents |
|------|------|----------|
| `atilladeniz/kubi1-data` | Dataset | CPT corpus + SFT train/eval JSONL |
| `atilladeniz/kubi1-checkpoints` | Model | CPT adapter (main branch) + merged model (merged branch) |
| `atilladeniz/kubi1` | Model | Final GGUF exports (Q4_K_M, Q5_K_M) |

## RunPod Training (One-Click)

### Setup

1. Create a RunPod pod:
   - Template: **Unsloth** (or image `unslothai/unsloth:latest`)
   - GPU: **A40** (48GB, ~$0.40/hr) or **A100** (80GB, ~$1.00/hr)
   - Disk: 50GB minimum
2. Set your HuggingFace token as environment variable

### Run

```bash
# On the RunPod terminal:
export HF_TOKEN=hf_xxx
git clone https://github.com/atilladeniz/Kubeli.git /workspace/Kubeli
bash /workspace/Kubeli/.dev/kubi-1/training/runpod_run.sh
```

That's it. The script handles everything:
- Validates GPU, VRAM, disk space
- Installs/upgrades dependencies (detects Unsloth image)
- Downloads datasets from HuggingFace
- Runs CPT (Phase 1) + SFT (Phase 2) + GGUF export
- Pushes results to HuggingFace
- Auto-tunes batch sizes per GPU

### After Training

```bash
# Download the GGUF
huggingface-cli download atilladeniz/kubi1

# Test with llama.cpp
llama-server --model unsloth.Q5_K_M.gguf --port 8080

# Or with Ollama
ollama create kubi1 -f Modelfile
ollama run kubi1 "What is a CrashLoopBackOff?"
```

## Data Preparation (Mac)

Run these on your dev machine before training:

```bash
cd .dev/kubi-1/data

# 1. Harvest K8s documentation
GITHUB_TOKEN=ghp_xxx python harvest_k8s.py

# 2. Download HuggingFace datasets
python load_hf_datasets.py

# 3. Convert to instruction pairs
python convert_docs.py

# 4. Generate refusal examples
python generate_refusals.py --count 5000

# 5. Merge, deduplicate, filter
python merge_and_filter.py

# 6. (Optional) Compact dataset for targeted training
python prepare_sft_compact.py

# 7. Upload to HuggingFace
huggingface-cli upload atilladeniz/kubi1-data final/ --repo-type dataset
```

## Directory Structure

```text
.dev/kubi-1/
├── README.md
├── SETUP-WINDOWS.md
├── SETUP-CONNECTION.md
├── training/
│   ├── runpod_run.sh          # All-in-one RunPod script
│   ├── train_cpt.py           # Phase 1: Continued Pretraining
│   ├── train_kubi1.py         # Phase 2: SFT + GGUF export
│   ├── train_cpt_runpod.py    # Standalone CPT (legacy)
│   ├── runpod_setup.sh        # Legacy setup (use runpod_run.sh instead)
│   ├── runpod_full_run.sh     # Legacy run (use runpod_run.sh instead)
│   └── remote_train.sh        # Local RTX 3090 training
├── data/
│   ├── harvest_k8s.py
│   ├── load_hf_datasets.py
│   ├── convert_docs.py
│   ├── generate_refusals.py
│   ├── merge_and_filter.py
│   ├── prepare_sft_compact.py
│   ├── prepare_cpt_corpus.py
│   ├── raw/
│   ├── processed/
│   └── final/
└── models/
```

## Model Candidates (March 2026)

| Model | Role | Context | Notes |
|-------|------|---------|------|
| **Qwen3-4B** | Mainline default | 32K | proven fine-tune base |
| Qwen3-1.7B | Nano | 32K | smaller, faster fallback |
| Qwen3-8B | Pro | 32K | larger quality tier |
| Qwen3.5-4B | Research candidate | 256K | likely v2 fine-tune candidate |

## Hardware

| Machine | Role | Specs |
|---------|------|-------|
| MacBook Air M4 | Dev, data prep, eval, inference testing | M4, 32GB, Metal 3 |
| RunPod A40 | Cloud training | 48GB VRAM, CUDA 12 |
| Windows Desktop | Backup local training | RTX 3090 24GB VRAM |
