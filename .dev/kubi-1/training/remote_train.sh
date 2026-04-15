#!/bin/bash
# Remote training: upload data + start training on Windows RTX 3090
# Usage: ./remote_train.sh [--monitor]
set -euo pipefail

HOST="${KUBI_TRAIN_HOST:-kubi-train}"
REMOTE_DIR="~/kubi-training"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "╔══════════════════════════════════════╗"
echo "║  Kubi-1 Remote Training              ║"
echo "╠══════════════════════════════════════╣"
echo "║  Host: ${HOST}"
echo "║  Local: ${LOCAL_DIR}"
echo "╚══════════════════════════════════════╝"

# 1. Test connection
echo ""
echo "📡 Testing connection to ${HOST}..."
if ! ssh -o ConnectTimeout=5 "${HOST}" "echo OK" 2>/dev/null; then
    echo "❌ Cannot connect to ${HOST}"
    echo ""
    echo "Make sure:"
    echo "  1. Windows machine is on and SSH is running"
    echo "  2. Tailscale is connected (tailscale up)"
    echo "  3. SSH config has 'kubi-train' host (see SETUP-CONNECTION.md)"
    echo ""
    echo "Or set: KUBI_TRAIN_HOST=user@ip ./remote_train.sh"
    exit 1
fi
echo "✅ Connected"

# 2. Check GPU
echo ""
echo "🖥️  Checking GPU..."
ssh "${HOST}" "nvidia-smi --query-gpu=name,memory.total --format=csv,noheader"

# 3. Ensure remote directory exists
ssh "${HOST}" "mkdir -p ${REMOTE_DIR}/{training,data/final,models}"

# 4. Upload dataset + scripts
echo ""
echo "📤 Uploading dataset + training scripts..."
rsync -avz --progress \
    "${LOCAL_DIR}/training/" \
    "${HOST}:${REMOTE_DIR}/training/" \
    --exclude '__pycache__' \
    --exclude 'checkpoints' \
    --exclude '*.gguf'

rsync -avz --progress \
    "${LOCAL_DIR}/data/final/" \
    "${HOST}:${REMOTE_DIR}/data/final/" \
    --exclude '__pycache__'

echo "✅ Upload complete"

# 5. Start training
echo ""
echo "🚀 Starting training..."
ssh "${HOST}" "cd ${REMOTE_DIR}/training && \
    nohup python train_kubi1.py \
        --dataset ../data/final/kubeli-k8s-train.jsonl \
        --output-dir ./checkpoints \
        --export-dir ./kubeli-k8s-4b \
        > train.log 2>&1 &"

echo "✅ Training started in background"
echo ""
echo "════════════════════════════════════════"
echo "Monitor:  ssh ${HOST} 'tail -f ${REMOTE_DIR}/training/train.log'"
echo "Studio:   http://${HOST}:8888  (if Unsloth Studio is running)"
echo "Pull GGUF:"
echo "  rsync -avz ${HOST}:${REMOTE_DIR}/training/kubeli-k8s-4b/*.gguf ${LOCAL_DIR}/models/"
echo "════════════════════════════════════════"

if [[ "${1:-}" == "--monitor" ]]; then
    echo ""
    echo "📊 Monitoring training log (Ctrl+C to detach)..."
    ssh "${HOST}" "tail -f ${REMOTE_DIR}/training/train.log"
fi
