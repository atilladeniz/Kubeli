# Kubi-1: Optimal Model, Training & Infrastructure Strategy

> **Research Brief — March 26, 2026**
> Validates and refines the existing OpenSpec plan against current state.

---

## Executive Summary

The existing OpenSpec plan (Qwen3-4B + llama-server sidecar + Unsloth QLoRA) is **fundamentally solid**, but several significant developments have occurred:

1. **Qwen3.5 is out** (March 2, 2026) — new Small series with 0.8B, 2B, **4B**, 9B. 256K context, thinking/non-thinking, better tool calling. It is a strong future candidate for Kubeli's sidecar-based inference path.
2. **Unsloth Studio** (March 17, 2026) — No-code UI for training + inference + Data Recipes. Game-changer for workflow.
3. **Unsloth Data Recipes** — Transforms PDFs/CSVs/docs into synthetic training data automatically. Powered by NVIDIA NeMo Data Designer.
4. **Local-first training**: RTX 3090 is the primary training machine. Mac connects via SSH/Tailscale. Cloud (Vast.ai) is fallback only.
5. **Grephuboverflow** can be extended as a K8s doc harvester, or use standalone script.

### Recommendation: Dual Approach

| Phase | Model | Reason |
|-------|-------|--------|
| **v1 (now)** | `kubi-1` on Qwen3-4B via llama-server | Stable default, zero-install inside Kubeli |
| **v2 (fine-tune)** | Qwen3.5-4B via Unsloth | Better, 256K context, evaluate as next-gen base |
| **Fallback** | `qwen3:8b` or `qwen3-30b-a3b` (MoE) | As planned, updated fallback |

---

## 1. Model Landscape (March 2026)

### 1.1 Qwen3.5 — New Top Candidate

Released March 2, 2026. Small series (0.8B, 2B, 4B, 9B) is especially relevant:

| Feature | Qwen3-4B (current plan) | Qwen3.5-4B (NEW) |
|---------|------------------------|-------------------|
| Context | 32K | **256K** (extendable to 1M via YaRN) |
| Thinking Mode | ✅ | ✅ (OFF by default for Small) |
| Tool Calling | 0.880 | **Improved** (Unsloth fixed chat template bugs) |
| Vision | ❌ | ✅ (multimodal) |
| Languages | many | **201 languages** |
| Kubeli sidecar path | ✅ | ✅ |
| llama.cpp | ✅ | ✅ (recommended) |
| Unsloth Fine-tune | ✅ | ✅ |
| License | Apache 2.0 | Apache 2.0 |

### 1.2 Updated Model Rankings

| Priority | Model | Params (active) | RAM Q4 | Context | Ollama | Role |
|----------|-------|----------------|--------|---------|--------|------|
| 1 | **Qwen3-4B-Instruct-2507** | 4B | ~3GB | 32K | ✅ | **v1 Default** |
| 2 | **Qwen3.5-4B** | 4B | ~3GB | 256K | ❌ | **v2 Fine-tune base** |
| 3 | **Qwen3-30B-A3B** | ~3B active | ~4GB | 32K | ✅ | MoE fallback (replaces Granite) |
| 4 | Qwen3.5-9B | 9B | ~6GB | 256K | ❌ | Quality pick ≥16GB |
| 5 | Qwen3-8B | 8B | ~5GB | 32K | ✅ | Quality pick via Ollama |

**New finding: Qwen3-30B-A3B** is a MoE model with 30B total but only ~3B active params. Replaces `granite3.1-moe:3b` — significantly better at similar RAM usage.

### 1.3 Other Models

- **Llama 4**: Scout is 109B MoE — far too large for desktop. No small model released.
- **Gemma 3n**: Released July 2025, Unsloth supports fine-tuning. But 2B is too small, 9B competes with Qwen3.5-9B which benchmarks better.
- **Phi-4-mini**: Solid MIT alternative at 3.8B, but Qwen3-4B wins on tool calling benchmarks.

---

## 2. Unsloth Ecosystem (March 2026)

### 2.1 Unsloth Studio (NEW — March 17, 2026)

Open-source, no-code web UI:

- **Run**: GGUF + safetensor models locally (Mac, Windows, Linux)
- **Train**: 500+ models, 2x faster, 70% less VRAM
- **Data Recipes**: Docs → synthetic datasets (PDFs, CSVs, JSON, YAML)
- **Export**: Direct to GGUF, Ollama, vLLM, LM Studio
- **Model Arena**: Compare 2 models side-by-side (base vs fine-tuned)
- **Privacy**: 100% offline, no telemetry

**Training platform support:**
- ✅ NVIDIA RTX 30/40/50, Blackwell, DGX
- ✅ Intel GPUs
- ⏳ Apple MLX — "coming very soon"
- ✅ CPU — Chat + Data Recipes only (no training)

### 2.2 Data Recipes (NVIDIA NeMo Data Designer)

**Best path for our K8s training data.** Instead of scripting everything manually:

1. Upload K8s docs as PDF/MD, SO data as CSV/JSONL as Seed
2. Build workflow: Seed → LLM Generation → Validation → Output
3. Blocks: Seed, LLM+Models, Expression, Validators, Samplers
4. Built-in linters for Python, SQL, JS/TS (need custom for kubectl/YAML)
5. Preview → Full Run → Dataset ready for fine-tuning

Works with external OpenAI-compatible APIs — can use local llama.cpp server.

### 2.3 Training Best Practices

**QLoRA remains the right choice** for 4B on RTX 3090:

| Setting | Current Plan | 2026 Recommendation |
|---------|-------------|-------------------|
| LoRA Rank | r=16 | r=16 (good) or **r=32** for more capacity |
| Target Modules | all linear | ✅ correct |
| Batch Size | 4 | **8** (RTX 3090 has headroom) |
| Grad Accum | 4 | 4 (effective batch=32) |
| Epochs | 3 | **2** (50K samples is enough for 2) |
| LR | 2e-4 | ✅ standard for QLoRA |
| Seq Length | 8192 | ✅ matches context budget |

**VRAM budget on RTX 3090 (24GB):**
- Model (4-bit): ~3GB
- LoRA adapters: ~0.5GB
- Optimizer states: ~1.5GB
- Activations + gradients: ~6-8GB
- KV-cache: ~2-4GB
- **Total: ~13-17GB** → plenty of room, batch can go to 8

### 2.4 GRPO (Reinforcement Learning)

Unsloth supports **GRPO with 7x longer context**. Relevant for phase 3:
- On 24GB VRAM: Qwen3-4B QLoRA with 20K+ context for GRPO
- Could use to train for **better JSON structuring**
- Needs reward function (e.g. "is JSON valid? Is kubectl command correct?")

**Recommendation:** SFT first (QLoRA), then optionally GRPO for JSON quality.

### 2.5 Unsloth Dynamic 2.0 GGUF

New quantization method from Unsloth:
- Important layers upcasted to 8 or 16-bit, rest stays 4-bit
- **Better quality than standard Q4_K_M** at similar size
- Format: `UD-Q4_K_XL`, `UD-Q3_K_XL`

**Recommendation:** Export after fine-tuning as Unsloth Dynamic instead of standard GGUF.

---

## 3. Training Data & Scraping Strategy

### 3.1 Available Datasets

| Dataset | Size | License | Quality | Status |
|---------|------|---------|---------|--------|
| `mcipriano/stackoverflow-kubernetes-questions` | ~30K | CC-BY-SA-4.0 | ⭐⭐⭐ Real Q&A | ✅ Available |
| `ComponentSoft/k8s-kubectl-35k` | ~35K | Unspecified | ⭐⭐ kubectl examples | ⚠️ Check license |
| `kubernetes/website` (GitHub) | ~15K sections | Apache 2.0 | ⭐⭐⭐⭐ Official docs | Must scrape |
| `k8sgpt-ai/k8sgpt` analyzers | ~30+ patterns | Apache 2.0 | ⭐⭐⭐⭐⭐ Error→Diagnosis | Must extract |

### 3.2 Scraping: harvest_k8s.py

Standalone Python script at `.dev/kubi-1/data/harvest_k8s.py`:
- Uses GitHub Trees API (1 API call per repo tree)
- Fetches individual file blobs
- Rate limiting built in
- Needs `GITHUB_TOKEN` env var
- Can also extend Grephuboverflow later if needed

### 3.3 Data Pipeline

```
Phase 1: Harvest (Mac)
├── harvest_k8s.py → GitHub repos → JSONL per repo
├── load_hf_datasets.py → HuggingFace → JSONL
└── (future) SO API for latest questions

Phase 2: Convert (Mac)
├── convert_docs.py → MD sections → instruction-response pairs
├── k8sgpt patterns → error→diagnosis pairs
└── (future) YAML mutation → error/fix pairs

Phase 3: Filter (Mac)
├── merge_and_filter.py → dedup, quality, balance
└── Output: final/kubeli-k8s-train.jsonl + eval.jsonl

Phase 4: Train (Windows RTX 3090)
├── rsync data to Windows
├── python train_kubi1.py
└── Export GGUF

Phase 5: Test (Mac)
├── rsync GGUF back to Mac
├── llama-server --model ./models/kubeli-k8s-4b-Q4_K_M.gguf --port 8080
├── optional: ollama create kubeli-k8s:4b
└── Run eval.py
```

---

## 4. Local Training Infrastructure

### 4.1 Architecture

```
MacBook Air M4 (32GB)              Windows Desktop (RTX 3090)
──────────────────────              ──────────────────────────
Data harvesting                     Unsloth training
Data conversion                     GGUF export
Dataset preparation                 Model testing
Evaluation                    ←──── Trained model (GGUF)
Inference testing (llama-server, optional Ollama compatibility)

        ╔═══════════════╗
        ║  Connection   ║
        ║  Tailscale    ║
        ║  or SSH/LAN   ║
        ╚═══════════════╝
```

### 4.2 Connection: Tailscale (Recommended)

Already installed on Mac (`/opt/homebrew/bin/tailscale`). Free, zero-config, works everywhere.

See `.dev/kubi-1/SETUP-CONNECTION.md` for full setup.

### 4.3 Workflow

```bash
# Mac: prepare data
cd .dev/kubi-1/data
GITHUB_TOKEN=ghp_xxx python harvest_k8s.py
python load_hf_datasets.py
python convert_docs.py
python merge_and_filter.py

# Mac: upload + start training on Windows
cd ../training
./remote_train.sh --monitor

# Mac: pull model back + test
rsync -avz kubi-train:~/kubi-training/training/kubeli-k8s-4b/*.gguf ../models/
llama-server --model ../models/kubeli-k8s-4b-Q4_K_M.gguf --port 8080
# optional compatibility path
ollama create kubeli-k8s:4b -f ../models/Modelfile
```

### 4.4 Cloud Fallback (Vast.ai)

Only if Windows machine is unavailable. ~$0.10/training run on spot RTX 3090.
Scripts in `.dev/kubi-1/cloud/` when/if that fallback is added.

---

## 5. Delta from Existing OpenSpec Plan

| Aspect | Current Plan | Change | Reason |
|--------|-------------|--------|--------|
| **v1 Model** | Qwen3-4B | ✅ Keep | Stable default for shipped Kubi-1 |
| **v2 Model** | Qwen3:4b fine-tuned | **Qwen3.5-4B fine-tuned** | 256K context, better |
| **MoE Fallback** | granite3.1-moe:3b | **Qwen3-30B-A3B** (~3B active) | Much better |
| **Training UI** | CLI scripts | **Unsloth Studio + CLI** | No-code option |
| **Data Pipeline** | Custom scripts only | **Scripts + Data Recipes eval** | Best of both |
| **GGUF Export** | Q4_K_M + Q5_K_M | **+ Unsloth Dynamic UD-Q4_K_XL** | Better quality |
| **Training Focus** | Not specified | **Local RTX 3090 first** | Zero cost, fastest iteration |
| **Connection** | SSH tunnel suggestion | **Tailscale** | Already installed, stable |
| **Cloud GPU** | Not planned | **Vast.ai as fallback** | $0.10/run if needed |
| **Batch Size** | 4 | **8** | RTX 3090 has room |
| **Epochs** | 3 | **2** | 50K samples is enough |

---

## Sources

| # | Source | URL | Retrieved |
|---|--------|-----|-----------|
| 1 | Qwen3 HuggingFace Collection | https://huggingface.co/collections/Qwen/qwen3-67dd247413f0e2e4f653967f | 2026-03-26 |
| 2 | Unsloth Blog | https://unsloth.ai/blog | 2026-03-26 |
| 3 | Unsloth Studio Docs | https://unsloth.ai/docs/new/studio | 2026-03-26 |
| 4 | Qwen3.5 Unsloth Guide | https://unsloth.ai/docs/models/qwen3.5 | 2026-03-26 |
| 5 | Unsloth GRPO Long Context | https://docs.unsloth.ai/new/grpo-long-context | 2026-03-26 |
| 6 | Unsloth Data Recipes | https://docs.unsloth.ai/new/studio/data-recipe | 2026-03-26 |
| 7 | Unsloth Docker | https://docs.unsloth.ai/new/how-to-train-llms-with-unsloth-and-docker | 2026-03-26 |
| 8 | RunPod Pricing | https://www.runpod.io/pricing | 2026-03-26 |
| 9 | Vast.ai Pricing | https://vast.ai/pricing | 2026-03-26 |
| 10 | k8sgpt GitHub | https://github.com/k8sgpt-ai/k8sgpt | 2026-03-26 |
| 11 | SO K8s Dataset (HF) | https://huggingface.co/datasets/mcipriano/stackoverflow-kubernetes-questions | 2026-03-26 |
| 12 | kubectl-35k Dataset (HF) | https://huggingface.co/datasets/ComponentSoft/k8s-kubectl-35k | 2026-03-26 |
| 13 | Kubeli OpenSpec | ./openspec/changes/local-k8s-ai-model/ | 2026-03-26 |
| 14 | Grephuboverflow | /Users/atilla/Github/Grephuboverflow/ | 2026-03-26 |
