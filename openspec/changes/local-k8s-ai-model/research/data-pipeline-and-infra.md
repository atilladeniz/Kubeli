# Data Pipeline & Training Infrastructure — Technical Reference

> Supplements the main research brief. Contains implementation details.
> All runnable code lives in `.dev/llm/` — this doc is the design reference.

---

## 1. Local Training Setup (Primary)

### Hardware

| Machine | Role | Specs |
|---------|------|-------|
| **MacBook Air M4** | Data prep, eval, inference testing | M4 10-core, 32GB unified, Metal 3 |
| **Windows Desktop** | Training server | RTX 3090 24GB VRAM, CUDA 12 |

### Connection

**Tailscale** (recommended) — already installed on Mac at `/opt/homebrew/bin/tailscale`.

Setup:
1. Install Tailscale on Windows: https://tailscale.com/download/windows
2. Install Tailscale in WSL2: `curl -fsSL https://tailscale.com/install.sh | sh`
3. `tailscale up` on both machines
4. Add SSH config entry on Mac (see `.dev/llm/SETUP-CONNECTION.md`)

### Windows Setup

See `.dev/llm/SETUP-WINDOWS.md` for:
- WSL2 + CUDA verification
- Unsloth installation (`uv pip install "unsloth[cu121]"`)
- Unsloth Studio (optional no-code UI)
- SSH access from Mac

---

## 2. Data Pipeline

All scripts in `.dev/llm/data/`.

### Step 1: Harvest GitHub Repos

```bash
GITHUB_TOKEN=ghp_xxx python harvest_k8s.py
```

Sources:
- `kubernetes/website` — official K8s docs (Apache 2.0)
- `k8sgpt-ai/k8sgpt` — analyzer patterns in Go (Apache 2.0)
- `kubernauts/practical-kubernetes-problems` — troubleshooting
- `iam-veeramalla/kubernetes-troubleshooting-zero-to-hero` — error walkthroughs
- `kelseyhightower/kubernetes-the-hard-way` — tutorials

Output: `data/raw/*.jsonl` (one per repo)

### Step 2: Download HuggingFace Datasets

```bash
pip install datasets
python load_hf_datasets.py
```

Downloads:
- `mcipriano/stackoverflow-kubernetes-questions` (~30K, CC-BY-SA-4.0)
- `ComponentSoft/k8s-kubectl-35k` (~35K, license TBD)

### Step 3: Convert to Instruction Pairs

```bash
python convert_docs.py
```

Converts:
- Markdown sections → instruction-response pairs (Alpaca format)
- k8sgpt Go code → error pattern pairs
- StackOverflow Q&A → cleaned pairs

Output: `data/processed/*.jsonl`

### Step 4: Merge, Filter, Split

```bash
python merge_and_filter.py
```

- Deduplication (MD5 hash)
- Quality filter (min/max length, URL density)
- Source balancing (max 30% from any single source)
- Train/eval split (90/10, stratified by category)

Output:
- `data/final/kubeli-k8s-train.jsonl` (~45K examples)
- `data/final/kubeli-k8s-eval.jsonl` (~5K examples)

---

## 3. Training

### Local Training (RTX 3090)

```bash
# From Mac:
./training/remote_train.sh --monitor

# Or directly on Windows:
ssh kubi-train
cd ~/kubi-training/training
python train_kubi1.py
```

Config:
- Base: `unsloth/Qwen3-4B`
- QLoRA: r=16, all linear layers
- Batch: 8 × 4 grad accum = 32 effective
- Epochs: 2
- Seq length: 8192
- Export: GGUF Q4_K_M + Q5_K_M

### Unsloth Studio (Alternative)

```bash
# On Windows:
unsloth studio -H 0.0.0.0 -p 8888

# From Mac browser:
open http://kubi-train:8888
```

Upload dataset via Studio UI, configure training visually, export GGUF.

---

## 4. Evaluation

Test set in `.dev/llm/eval/test_cases/` — 500 hand-crafted examples:

| Category | Count | Tests |
|----------|-------|-------|
| Error diagnosis | 150 | CrashLoopBackOff, OOM, ImagePull, Pending, etc. |
| kubectl generation | 100 | create, scale, debug, rollout commands |
| YAML debugging | 100 | Find errors in manifests |
| Networking | 75 | Service selectors, ingress, DNS |
| RBAC | 75 | Permission denied scenarios |

Metrics:
- JSON validity (is output valid JSON?)
- kubectl syntax correctness
- Resource name grounding (no hallucinated names)
- Error category accuracy
- Fix quality (does the suggestion help?)

---

## 5. Extending Grephuboverflow (Future)

The Grephuboverflow project at `/Users/atilla/Github/Grephuboverflow/` has:
- GitHub API client with auth + rate limiting (`ghapi`)
- Repository search and structure extraction
- File fetching service
- Async task management
- Caching layer

Could add a `/api/harvest/k8s` endpoint for automated, recurring data harvesting.
Start with the standalone script first; migrate to Grephuboverflow when the pipeline is proven.

---

## 6. Cloud Fallback (Vast.ai)

Only when Windows machine is unavailable.

```bash
pip install vastai
vastai set api-key YOUR_KEY

# Find cheapest RTX 3090
vastai search offers 'gpu_name=RTX_3090 num_gpus=1 dph<0.30' -o 'dph'

# Start with Unsloth Docker
vastai create instance OFFER_ID --image unsloth/unsloth --disk 50
```

Cost: ~$0.10-0.15 per training run (30 min on RTX 3090 spot).
