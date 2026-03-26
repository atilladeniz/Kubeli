# Windows RTX 3090 Training Server Setup

One-time setup for the Windows desktop with RTX 3090.

## Option A: WSL2 (Recommended)

WSL2 has native CUDA support — the simplest path.

### 1. Install WSL2 + Ubuntu

```powershell
# PowerShell (Admin)
wsl --install -d Ubuntu-24.04
```

Reboot, then open Ubuntu terminal and set username/password.

### 2. Verify CUDA in WSL2

The Windows NVIDIA driver automatically exposes CUDA to WSL2. No separate Linux driver needed.

```bash
nvidia-smi
# Should show RTX 3090, Driver Version, CUDA Version 12.x
```

If `nvidia-smi` not found:
- Update Windows NVIDIA driver to latest (https://www.nvidia.com/drivers)
- Reboot

### 3. Install Python + uv

```bash
# Fast Python package manager
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc

# Create project environment
mkdir -p ~/kubi-training && cd ~/kubi-training
uv init --python 3.12
```

### 4. Install Unsloth

```bash
cd ~/kubi-training

# Install with CUDA 12.1 support
uv pip install "unsloth[cu121]" datasets transformers trl

# Verify
python -c "import unsloth; print('Unsloth OK')"
python -c "import torch; print(f'CUDA: {torch.cuda.is_available()}, GPU: {torch.cuda.get_device_name(0)}')"
```

Expected output:
```
Unsloth OK
CUDA: True, GPU: NVIDIA GeForce RTX 3090
```

### 5. Install Unsloth Studio (optional, for no-code training)

```bash
curl -fsSL https://unsloth.ai/install.sh | sh
unsloth studio -H 0.0.0.0 -p 8888
# Opens web UI at http://localhost:8888
```

### 6. Optional: install Ollama for compatibility testing

You do not need Ollama for the main Kubeli workflow. Install it only if you want to test exported Modelfiles outside the bundled `llama-server` path.

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama serve &
```

### 7. Enable SSH Access

```bash
sudo apt install openssh-server
sudo systemctl enable ssh
sudo systemctl start ssh

# Set a password if you haven't
sudo passwd $USER
```

Find WSL2 IP (needed for connection from Mac):
```bash
hostname -I
# e.g. 172.23.45.67
```

**Important:** WSL2 IP changes on reboot. See SETUP-CONNECTION.md for stable solutions.

---

## Option B: Native Windows + Docker

If you prefer not to use WSL2:

```powershell
# Install Docker Desktop with WSL2 backend
winget install Docker.DockerDesktop

# Run Unsloth container
docker run -d --name kubi-training `
  -e JUPYTER_PASSWORD="kubi2026" `
  -p 8888:8888 -p 2222:22 `
  -v ${HOME}/kubi-training:/workspace/work `
  --gpus all `
  unsloth/unsloth
```

Then SSH into the container:
```powershell
ssh -p 2222 unsloth@localhost
```

---

## Verify Setup

Run the versioned test script from the repo to confirm everything works:

```bash
cd /Users/atilla/Github/Kubeli/.dev/kubi-1/data
python test_setup.py
```
