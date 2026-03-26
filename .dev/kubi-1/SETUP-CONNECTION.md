# Mac ↔ Windows Connection for Remote Training

Connect your MacBook Air M4 to the Windows RTX 3090 desktop for remote training.

## Option 1: Tailscale (Recommended)

Zero-config mesh VPN. Works from anywhere — same LAN, different networks, even mobile hotspot. **Free for personal use (up to 100 devices).**

### Setup

**On Windows:**
1. Download from https://tailscale.com/download/windows
2. Install and sign in with GitHub/Google account
3. Note the Tailscale IP (e.g. `100.64.x.y`) shown in the system tray

**On Mac:**
```bash
# Already installed at /opt/homebrew/bin/tailscale
# Start the Tailscale service
sudo tailscaled &
tailscale up
# Sign in via the browser link
```

Or install the Mac app from https://tailscale.com/download/mac

**On Windows WSL2 (if using WSL):**
```bash
# Inside WSL2 Ubuntu
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscaled &
tailscale up
```

### Usage

```bash
# From Mac — find Windows machine name
tailscale status

# SSH directly (no port forwarding needed!)
ssh username@windows-desktop   # Tailscale hostname
# or
ssh username@100.64.x.y        # Tailscale IP
```

### SSH Config (add to ~/.ssh/config on Mac)

```
Host kubi-train
    HostName 100.64.x.y         # Replace with Tailscale IP
    User your-wsl-username       # Your WSL2 username
    Port 22
    ForwardAgent yes
    # If using 1Password SSH agent (already in your config):
    # IdentityAgent "~/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock"
```

Then just:
```bash
ssh kubi-train
```

### Tailscale Benefits
- ✅ Stable IP (doesn't change like WSL2 IPs)
- ✅ Works across networks (home, office, coffee shop)
- ✅ Encrypted WireGuard tunnel
- ✅ No port forwarding / router config needed
- ✅ Free for personal use

---

## Option 2: Same LAN (SSH with port forwarding)

If both machines are on the same local network.

### Find Windows IP

On Windows (PowerShell):
```powershell
# If using WSL2, you need to forward the port
# Get WSL2 IP
wsl hostname -I
# e.g. 172.23.45.67

# Forward port 22 from Windows to WSL2
netsh interface portproxy add v4tov4 listenport=2222 listenaddress=0.0.0.0 connectport=22 connectaddress=172.23.45.67

# Open firewall
New-NetFirewallRule -DisplayName "SSH for Kubi Training" -Direction Inbound -Protocol TCP -LocalPort 2222 -Action Allow
```

Find Windows LAN IP:
```powershell
ipconfig | findstr /i "IPv4"
# e.g. 192.168.1.100
```

### SSH from Mac

```bash
ssh -p 2222 username@192.168.1.100
```

### SSH Config

```
Host kubi-train
    HostName 192.168.1.100
    User your-wsl-username
    Port 2222
    ForwardAgent yes
```

**Note:** WSL2 IP changes on reboot. You need to re-run the `netsh` command each time. Tailscale avoids this entirely.

---

## Option 3: Same LAN (Docker on native Windows)

If using Docker instead of WSL2:

```bash
# Docker exposes SSH on port 2222
ssh -p 2222 unsloth@192.168.1.100
```

---

## Remote Training Workflow

Once connected, the workflow is:

### 1. Prepare data on Mac

```bash
cd /Users/atilla/Github/Kubeli/.dev/kubi-1/data
GITHUB_TOKEN=ghp_xxx python harvest_k8s.py
python load_hf_datasets.py
python convert_docs.py
python merge_and_filter.py
# Result: data/final/kubeli-k8s-train.jsonl
```

### 2. Upload dataset to Windows

```bash
# One command to sync dataset + training scripts
rsync -avz --progress \
  /Users/atilla/Github/Kubeli/.dev/kubi-1/ \
  kubi-train:~/kubi-training/ \
  --exclude 'data/raw/' \
  --exclude '__pycache__' \
  --exclude '.git'
```

### 3. Start training on Windows

```bash
ssh kubi-train
cd ~/kubi-training/training
python train_kubi1.py

# Or use Unsloth Studio (browser-based)
unsloth studio -H 0.0.0.0 -p 8888
# Then open http://kubi-train:8888 in browser on Mac
```

### 4. Monitor training from Mac

```bash
# Watch training logs live
ssh kubi-train "tail -f ~/kubi-training/training/checkpoints/training.log"

# Or open Unsloth Studio in browser
open http://kubi-train:8888
```

### 5. Pull trained model back to Mac

```bash
# Download GGUF files
rsync -avz --progress \
  kubi-train:~/kubi-training/training/kubeli-k8s-4b/*.gguf \
  /Users/atilla/Github/Kubeli/.dev/kubi-1/models/

# Test locally with llama-server
llama-server --model /Users/atilla/Github/Kubeli/.dev/kubi-1/models/kubeli-k8s-4b-Q4_K_M.gguf --port 8080

# Optional compatibility test with Ollama
ollama create kubeli-k8s:4b -f models/Modelfile
ollama run kubeli-k8s:4b "My pod nginx-abc is in CrashLoopBackOff"
```

---

## Helper Script: remote_train.sh

```bash
#!/bin/bash
# .dev/kubi-1/training/remote_train.sh
# Usage: ./remote_train.sh

set -euo pipefail

HOST="kubi-train"
REMOTE_DIR="~/kubi-training"

echo "📤 Uploading dataset + scripts..."
rsync -avz --progress \
  /Users/atilla/Github/Kubeli/.dev/kubi-1/ \
  ${HOST}:${REMOTE_DIR}/ \
  --exclude 'data/raw/' \
  --exclude 'models/' \
  --exclude '__pycache__'

echo "🚀 Starting training..."
ssh ${HOST} "cd ${REMOTE_DIR}/training && nohup python train_kubi1.py > train.log 2>&1 &"
echo "Training started in background. Monitor with:"
echo "  ssh ${HOST} 'tail -f ${REMOTE_DIR}/training/train.log'"

echo ""
echo "When done, pull the model:"
echo "  rsync -avz ${HOST}:${REMOTE_DIR}/training/kubeli-k8s-4b/*.gguf .dev/kubi-1/models/"
```
