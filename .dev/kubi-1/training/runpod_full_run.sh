#!/bin/bash
# End-to-end Kubi-1 RunPod training flow for the real/full run.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
WORK_DIR="${KUBI_WORK_DIR:-/workspace/kubi1}"
VENV_DIR="${KUBI_VENV_DIR:-/workspace/.venv-kubi1}"
LOG_DIR="${KUBI_LOG_DIR:-${WORK_DIR}/logs}"

mkdir -p "${WORK_DIR}" "${LOG_DIR}"
exec > >(tee -a "${LOG_DIR}/runpod-full-run.log") 2>&1

echo "============================================================"
echo "Kubi-1 RunPod Full Run"
echo "============================================================"
echo "repo:     ${ROOT_DIR}"
echo "workdir:  ${WORK_DIR}"
echo "log dir:  ${LOG_DIR}"

if [[ -z "${HF_TOKEN:-}" ]]; then
  echo "HF_TOKEN is required."
  exit 1
fi

if [[ ! -d "${VENV_DIR}" ]]; then
  echo "Virtualenv ${VENV_DIR} is missing."
  echo "Run .dev/kubi-1/training/runpod_setup.sh first."
  exit 1
fi

source "${VENV_DIR}/bin/activate"

export HF_HOME="${HF_HOME:-${WORK_DIR}/.cache/huggingface}"
export UNSLOTH_STABLE_DOWNLOADS="${UNSLOTH_STABLE_DOWNLOADS:-1}"
mkdir -p "${HF_HOME}"

CPT_BASE_MODEL="${CPT_BASE_MODEL:-unsloth/Qwen3-4B-Base-bnb-4bit}"
CPT_HF_REPO="${CPT_HF_REPO:-atilladeniz/kubi1-checkpoints}"
CPT_OUTPUT_DIR="${CPT_OUTPUT_DIR:-${WORK_DIR}/checkpoints/cpt}"
CPT_ADAPTER_DIR="${CPT_ADAPTER_DIR:-${WORK_DIR}/adapters/kubi1-cpt}"
CPT_SEQ_LEN="${CPT_SEQ_LEN:-4096}"
CPT_RANK="${CPT_RANK:-128}"
CPT_BATCH_SIZE="${CPT_BATCH_SIZE:-2}"
CPT_GRAD_ACCUM="${CPT_GRAD_ACCUM:-8}"
CPT_EPOCHS="${CPT_EPOCHS:-5}"
CPT_NO_4BIT="${CPT_NO_4BIT:-1}"  # bf16 by default for full run

SFT_BASE_MODEL="${SFT_BASE_MODEL:-atilladeniz/kubi1-checkpoints}"
SFT_BASE_MODEL_REV="${SFT_BASE_MODEL_REV:-merged}"  # use merged branch from CPT
SFT_OUTPUT_DIR="${SFT_OUTPUT_DIR:-${WORK_DIR}/checkpoints/sft}"
SFT_EXPORT_DIR="${SFT_EXPORT_DIR:-${WORK_DIR}/exports/gguf}"
SFT_HF_REPO="${SFT_HF_REPO:-atilladeniz/kubi1}"
SFT_SEQ_LEN="${SFT_SEQ_LEN:-4096}"
SFT_RANK="${SFT_RANK:-32}"
SFT_BATCH_SIZE="${SFT_BATCH_SIZE:-4}"
SFT_GRAD_ACCUM="${SFT_GRAD_ACCUM:-4}"
SFT_EPOCHS="${SFT_EPOCHS:-2}"

echo
echo "[1/3] Dry-run Hugging Face artifact check"
hf download "${CPT_HF_REPO}" --dry-run >/dev/null 2>&1 || echo "  (checkpoints repo will be created during training)"
hf download atilladeniz/kubi1-data --repo-type dataset --dry-run >/dev/null

echo
echo "[2/3] Continued pretraining"
python "${ROOT_DIR}/.dev/kubi-1/training/train_cpt.py" \
  --base-model "${CPT_BASE_MODEL}" \
  --max-seq-length "${CPT_SEQ_LEN}" \
  --lora-rank "${CPT_RANK}" \
  --batch-size "${CPT_BATCH_SIZE}" \
  --grad-accum "${CPT_GRAD_ACCUM}" \
  --epochs "${CPT_EPOCHS}" \
  --max-chunks 0 \
  --output-dir "${CPT_OUTPUT_DIR}" \
  --adapter-dir "${CPT_ADAPTER_DIR}" \
  --hf-repo "${CPT_HF_REPO}" \
  $([ "${CPT_NO_4BIT:-1}" = "1" ] && echo "--no-4bit")

echo
echo "[3/3] Supervised fine-tuning + GGUF export"
python "${ROOT_DIR}/.dev/kubi-1/training/train_kubi1.py" \
  --base-model "${SFT_BASE_MODEL}" \
  --max-seq-length "${SFT_SEQ_LEN}" \
  --lora-rank "${SFT_RANK}" \
  --batch-size "${SFT_BATCH_SIZE}" \
  --grad-accum "${SFT_GRAD_ACCUM}" \
  --epochs "${SFT_EPOCHS}" \
  --output-dir "${SFT_OUTPUT_DIR}" \
  --export-dir "${SFT_EXPORT_DIR}" \
  --hf-repo "${SFT_HF_REPO}"

echo
echo "Full run complete."
echo "GGUF repo: ${SFT_HF_REPO}"

if [[ "${AUTO_STOP_POD:-0}" == "1" && -n "${RUNPOD_POD_ID:-}" ]]; then
  echo "Stopping pod ${RUNPOD_POD_ID}"
  runpodctl stop pod "${RUNPOD_POD_ID}" || true
fi
