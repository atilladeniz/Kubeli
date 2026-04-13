#!/bin/bash
# ============================================================================
# Kubi-1 RunPod Training — All-in-One Script
# ============================================================================
#
# Single script that handles setup + training on a RunPod pod.
# Designed for the Unsloth Docker image (unslothai/unsloth:latest).
#
# RunPod setup:
#   1. Create pod with template "Unsloth" or image "unslothai/unsloth:latest"
#   2. GPU: A40 (48GB) recommended, A100 also works
#   3. Set environment variable: HF_TOKEN=hf_xxx
#   4. Run this script:
#
#        export HF_TOKEN=hf_xxx
#        git clone https://github.com/user/Kubeli.git /workspace/Kubeli
#        bash /workspace/Kubeli/.dev/kubi-1/training/runpod_run.sh
#
#   Or if scripts are on HuggingFace:
#        huggingface-cli download atilladeniz/kubi1-data training/runpod_run.sh \
#          --repo-type dataset --local-dir /workspace/kubi1-scripts
#        bash /workspace/kubi1-scripts/training/runpod_run.sh
#
# What this script does:
#   [1/6] Validate environment (GPU, VRAM, HF token, disk space)
#   [2/6] Install/upgrade dependencies (skips if Unsloth image detected)
#   [3/6] Download datasets from HuggingFace
#   [4/6] Phase 1: Continued Pretraining (CPT)
#   [5/6] Phase 2: Supervised Fine-Tuning (SFT) + GGUF export
#   [6/6] Verify GGUF output + push to HuggingFace
#
# Total time: ~2-4 hours on A40, ~1-2 hours on A100
# Total cost: ~$2-5 depending on GPU
# ============================================================================

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────

WORK_DIR="${KUBI_WORK_DIR:-/workspace/kubi1}"
LOG_DIR="${WORK_DIR}/logs"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# HuggingFace repos (consolidated structure)
HF_DATA_REPO="atilladeniz/kubi1-data"
HF_CHECKPOINTS_REPO="atilladeniz/kubi1-checkpoints"
HF_MODEL_REPO="atilladeniz/kubi1"

# CPT config
CPT_BASE_MODEL="${CPT_BASE_MODEL:-unsloth/Qwen3-4B-Base-bnb-4bit}"
CPT_SEQ_LEN="${CPT_SEQ_LEN:-4096}"
CPT_RANK="${CPT_RANK:-128}"
CPT_BATCH_SIZE="${CPT_BATCH_SIZE:-2}"
CPT_GRAD_ACCUM="${CPT_GRAD_ACCUM:-8}"
CPT_EPOCHS="${CPT_EPOCHS:-5}"
CPT_NO_4BIT="${CPT_NO_4BIT:-1}"

# SFT config
SFT_SEQ_LEN="${SFT_SEQ_LEN:-4096}"
SFT_RANK="${SFT_RANK:-32}"
SFT_BATCH_SIZE="${SFT_BATCH_SIZE:-4}"
SFT_GRAD_ACCUM="${SFT_GRAD_ACCUM:-4}"
SFT_EPOCHS="${SFT_EPOCHS:-2}"

# Auto-stop pod when done (set to 1 to enable)
AUTO_STOP="${AUTO_STOP:-0}"

# ── Helper functions ───────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*"; }
ok()   { echo -e "${GREEN}[$(date +%H:%M:%S)] OK${NC} $*"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] WARN${NC} $*"; }
fail() { echo -e "${RED}[$(date +%H:%M:%S)] FAIL${NC} $*"; exit 1; }

elapsed() {
  local secs=$1
  printf '%dh %dm %ds' $((secs/3600)) $((secs%3600/60)) $((secs%60))
}

# ── Setup ──────────────────────────────────────────────────────────────────

mkdir -p "${WORK_DIR}" "${LOG_DIR}"
MAIN_LOG="${LOG_DIR}/run-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "${MAIN_LOG}") 2>&1
TOTAL_START=$SECONDS

echo "============================================================"
echo "  Kubi-1 Training Pipeline"
echo "============================================================"
echo "  Work dir:  ${WORK_DIR}"
echo "  Log:       ${MAIN_LOG}"
echo "  Started:   $(date)"
echo "============================================================"

# ── [1/6] Validate environment ─────────────────────────────────────────────

log "[1/6] Validating environment..."

# HF token
if [[ -z "${HF_TOKEN:-}" ]]; then
  fail "HF_TOKEN not set. Export it first: export HF_TOKEN=hf_xxx"
fi
# Quick validation: HF tokens start with hf_
if [[ "${HF_TOKEN}" != hf_* ]]; then
  fail "HF_TOKEN doesn't look right (should start with hf_). Check your token."
fi

# GPU
if ! command -v nvidia-smi &>/dev/null; then
  fail "nvidia-smi not found. Is this a GPU pod?"
fi

GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)
GPU_VRAM_MB=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1)
GPU_VRAM_GB=$((GPU_VRAM_MB / 1024))

echo "  GPU:       ${GPU_NAME}"
echo "  VRAM:      ${GPU_VRAM_GB} GB"

if [[ ${GPU_VRAM_GB} -lt 20 ]]; then
  fail "Need at least 20GB VRAM. Got ${GPU_VRAM_GB}GB."
fi

# Auto-tune batch sizes based on VRAM
if [[ ${GPU_VRAM_GB} -ge 70 ]]; then
  # A100 80GB / H100
  CPT_BATCH_SIZE="${CPT_BATCH_SIZE:-4}"
  CPT_GRAD_ACCUM="${CPT_GRAD_ACCUM:-4}"
  SFT_BATCH_SIZE="${SFT_BATCH_SIZE:-8}"
  SFT_GRAD_ACCUM="${SFT_GRAD_ACCUM:-2}"
  log "  A100/H100 detected — using larger batches"
elif [[ ${GPU_VRAM_GB} -ge 40 ]]; then
  # A40 48GB
  CPT_BATCH_SIZE="${CPT_BATCH_SIZE:-2}"
  CPT_GRAD_ACCUM="${CPT_GRAD_ACCUM:-8}"
  SFT_BATCH_SIZE="${SFT_BATCH_SIZE:-4}"
  SFT_GRAD_ACCUM="${SFT_GRAD_ACCUM:-4}"
  log "  A40 detected — using default batches"
elif [[ ${GPU_VRAM_GB} -ge 20 ]]; then
  # RTX 3090/4090 24GB
  CPT_BATCH_SIZE=1
  CPT_GRAD_ACCUM=16
  SFT_BATCH_SIZE=2
  SFT_GRAD_ACCUM=8
  log "  24GB GPU detected — using smaller batches"
fi

# Disk space
DISK_FREE_GB=$(df -BG "${WORK_DIR}" | tail -1 | awk '{print $4}' | sed 's/G//')
echo "  Disk free: ${DISK_FREE_GB} GB"
if [[ ${DISK_FREE_GB} -lt 30 ]]; then
  fail "Need at least 30GB free disk. Got ${DISK_FREE_GB}GB."
fi

# Python + CUDA
PYTHON_VERSION=$(python3 --version 2>&1)
echo "  Python:    ${PYTHON_VERSION}"

ok "Environment validated"

# ── [2/6] Install dependencies ─────────────────────────────────────────────

log "[2/6] Checking dependencies..."

# Check if Unsloth is already installed (true in unslothai/unsloth image)
UNSLOTH_INSTALLED=0
python3 -c "import unsloth; print(f'  Unsloth {unsloth.__version__} already installed')" 2>/dev/null && UNSLOTH_INSTALLED=1

if [[ ${UNSLOTH_INSTALLED} -eq 1 ]]; then
  # Unsloth image — just upgrade to latest
  log "  Unsloth image detected, upgrading to latest..."
  pip install --upgrade --no-cache-dir --no-deps unsloth unsloth_zoo 2>&1 | tail -3
  pip install --upgrade datasets huggingface_hub 2>&1 | tail -3
else
  # Fresh pod — full install
  log "  Fresh pod, installing Unsloth + dependencies..."
  pip install --upgrade pip setuptools wheel 2>&1 | tail -1
  pip install --upgrade --force-reinstall --no-cache-dir --no-deps unsloth unsloth_zoo 2>&1 | tail -3
  pip install --upgrade datasets huggingface_hub trl peft accelerate bitsandbytes xformers 2>&1 | tail -3
fi

# HuggingFace login
python3 -c "
from huggingface_hub import login
import os
login(token=os.environ['HF_TOKEN'], add_to_git_credential=False)
print('  HuggingFace login OK')
"

# Print versions
python3 -c "
import torch, unsloth
print(f'  torch {torch.__version__}, cuda {torch.version.cuda}, unsloth {unsloth.__version__}')
print(f'  GPU: {torch.cuda.get_device_name(0)}')
"

ok "Dependencies ready"

# ── [3/6] Download datasets ────────────────────────────────────────────────

log "[3/6] Downloading datasets from ${HF_DATA_REPO}..."

DATA_DIR="${WORK_DIR}/data"
mkdir -p "${DATA_DIR}"

python3 -c "
from huggingface_hub import hf_hub_download
import os

token = os.environ['HF_TOKEN']
repo = '${HF_DATA_REPO}'
out = '${DATA_DIR}'

for f in ['cpt_corpus.jsonl', 'kubeli-k8s-train.jsonl', 'kubeli-k8s-eval.jsonl']:
    try:
        path = hf_hub_download(repo, f, repo_type='dataset', token=token, local_dir=out)
        size_mb = os.path.getsize(path) / 1024 / 1024
        print(f'  {f}: {size_mb:.1f} MB')
    except Exception as e:
        print(f'  {f}: SKIP ({e})')
"

# Verify critical files exist
for f in "${DATA_DIR}/cpt_corpus.jsonl" "${DATA_DIR}/kubeli-k8s-train.jsonl"; do
  if [[ ! -f "${f}" ]]; then
    fail "Missing: ${f}. Upload datasets to ${HF_DATA_REPO} first."
  fi
done

CPT_DATASET="${DATA_DIR}/cpt_corpus.jsonl"
SFT_DATASET="${DATA_DIR}/kubeli-k8s-train.jsonl"
CPT_LINES=$(wc -l < "${CPT_DATASET}")
SFT_LINES=$(wc -l < "${SFT_DATASET}")
echo "  CPT corpus:  ${CPT_LINES} chunks"
echo "  SFT dataset: ${SFT_LINES} examples"

ok "Datasets downloaded"

# ── [4/6] Continued Pretraining ────────────────────────────────────────────

log "[4/6] Phase 1: Continued Pretraining (CPT)..."
log "  Model: ${CPT_BASE_MODEL}, Rank: ${CPT_RANK}, Epochs: ${CPT_EPOCHS}"
log "  Batch: ${CPT_BATCH_SIZE} x ${CPT_GRAD_ACCUM} = $((CPT_BATCH_SIZE * CPT_GRAD_ACCUM))"

CPT_START=$SECONDS
CPT_OUTPUT="${WORK_DIR}/checkpoints/cpt"
CPT_ADAPTER="${WORK_DIR}/adapters/kubi1-cpt"

# Find training script (from git clone or from current dir)
TRAIN_CPT=""
for candidate in \
  "${SCRIPT_DIR}/train_cpt.py" \
  "/workspace/Kubeli/.dev/kubi-1/training/train_cpt.py" \
  "${WORK_DIR}/training/train_cpt.py"; do
  if [[ -f "${candidate}" ]]; then
    TRAIN_CPT="${candidate}"
    break
  fi
done
if [[ -z "${TRAIN_CPT}" ]]; then
  fail "train_cpt.py not found. Clone the Kubeli repo or download from HF."
fi

TRAIN_SFT="$(dirname "${TRAIN_CPT}")/train_kubi1.py"
if [[ ! -f "${TRAIN_SFT}" ]]; then
  fail "train_kubi1.py not found alongside train_cpt.py"
fi

log "  Scripts: ${TRAIN_CPT}"

python3 "${TRAIN_CPT}" \
  --base-model "${CPT_BASE_MODEL}" \
  --dataset "${CPT_DATASET}" \
  --max-seq-length "${CPT_SEQ_LEN}" \
  --lora-rank "${CPT_RANK}" \
  --batch-size "${CPT_BATCH_SIZE}" \
  --grad-accum "${CPT_GRAD_ACCUM}" \
  --epochs "${CPT_EPOCHS}" \
  --max-chunks 0 \
  --output-dir "${CPT_OUTPUT}" \
  --adapter-dir "${CPT_ADAPTER}" \
  --hf-repo "${HF_CHECKPOINTS_REPO}" \
  $([ "${CPT_NO_4BIT}" = "1" ] && echo "--no-4bit")

CPT_ELAPSED=$((SECONDS - CPT_START))
ok "CPT complete in $(elapsed ${CPT_ELAPSED})"

# ── [5/6] Supervised Fine-Tuning + GGUF ────────────────────────────────────

log "[5/6] Phase 2: SFT + GGUF Export..."

# SFT loads from HF checkpoints repo (merged branch) or local merged dir
# The CPT script pushes merged model to the "merged" branch
SFT_BASE="${HF_CHECKPOINTS_REPO}"
# Check if local merged dir exists (faster than downloading from HF)
if [[ -d "${CPT_ADAPTER}" ]]; then
  SFT_BASE="${CPT_ADAPTER}"
  log "  Using local CPT adapter: ${SFT_BASE}"
else
  log "  Using HF checkpoint: ${SFT_BASE}"
fi

SFT_OUTPUT="${WORK_DIR}/checkpoints/sft"
SFT_EXPORT="${WORK_DIR}/exports/gguf"

log "  Base: ${SFT_BASE}, Rank: ${SFT_RANK}, Epochs: ${SFT_EPOCHS}"
log "  Batch: ${SFT_BATCH_SIZE} x ${SFT_GRAD_ACCUM} = $((SFT_BATCH_SIZE * SFT_GRAD_ACCUM))"

SFT_START=$SECONDS

python3 "${TRAIN_SFT}" \
  --base-model "${SFT_BASE}" \
  --dataset "${SFT_DATASET}" \
  --max-seq-length "${SFT_SEQ_LEN}" \
  --lora-rank "${SFT_RANK}" \
  --batch-size "${SFT_BATCH_SIZE}" \
  --grad-accum "${SFT_GRAD_ACCUM}" \
  --epochs "${SFT_EPOCHS}" \
  --output-dir "${SFT_OUTPUT}" \
  --export-dir "${SFT_EXPORT}" \
  --hf-repo "${HF_MODEL_REPO}"

SFT_ELAPSED=$((SECONDS - SFT_START))
ok "SFT + GGUF export complete in $(elapsed ${SFT_ELAPSED})"

# ── [6/6] Verify output ───────────────────────────────────────────────────

log "[6/6] Verifying GGUF output..."

GGUF_Q4="${SFT_EXPORT}/unsloth.Q4_K_M.gguf"
GGUF_Q5="${SFT_EXPORT}/unsloth.Q5_K_M.gguf"

FAIL_COUNT=0

for gguf in "${GGUF_Q4}" "${GGUF_Q5}"; do
  if [[ -f "${gguf}" ]]; then
    SIZE_MB=$(du -m "${gguf}" | cut -f1)
    ok "  $(basename ${gguf}): ${SIZE_MB} MB"
    # Sanity check: Q4_K_M of 4B model should be ~2.5GB
    if [[ ${SIZE_MB} -lt 500 ]]; then
      warn "  File suspiciously small (<500MB) — may be corrupt"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  else
    warn "  $(basename ${gguf}): MISSING"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

# ── Summary ────────────────────────────────────────────────────────────────

TOTAL_ELAPSED=$((SECONDS - TOTAL_START))

echo
echo "============================================================"
echo "  Kubi-1 Training Complete"
echo "============================================================"
echo "  Total time:   $(elapsed ${TOTAL_ELAPSED})"
echo "  CPT:          $(elapsed ${CPT_ELAPSED})"
echo "  SFT + GGUF:   $(elapsed ${SFT_ELAPSED})"
echo "  GPU:          ${GPU_NAME} (${GPU_VRAM_GB}GB)"
echo
echo "  HuggingFace:"
echo "    Data:        https://huggingface.co/datasets/${HF_DATA_REPO}"
echo "    Checkpoints: https://huggingface.co/${HF_CHECKPOINTS_REPO}"
echo "    Model:       https://huggingface.co/${HF_MODEL_REPO}"
echo
echo "  Local GGUF:"
echo "    ${SFT_EXPORT}/"
echo
if [[ ${FAIL_COUNT} -eq 0 ]]; then
  echo "  Status: ALL GOOD"
else
  echo "  Status: ${FAIL_COUNT} WARNING(S) — check output above"
fi
echo
echo "  Next steps:"
echo "    1. Download GGUF: huggingface-cli download ${HF_MODEL_REPO}"
echo "    2. Test locally:  llama-server --model unsloth.Q5_K_M.gguf --port 8080"
echo "    3. Ollama:        ollama create kubi1 -f Modelfile"
echo "============================================================"
echo
echo "  Log: ${MAIN_LOG}"

# Auto-stop pod
if [[ "${AUTO_STOP}" == "1" && -n "${RUNPOD_POD_ID:-}" ]]; then
  log "Auto-stopping pod ${RUNPOD_POD_ID} in 60s (Ctrl+C to cancel)..."
  sleep 60
  runpodctl stop pod "${RUNPOD_POD_ID}" || true
fi
