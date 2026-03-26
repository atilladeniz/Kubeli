# Zero-Install AI: llama.cpp Sidecar + Model Auto-Download + Updates

> Kubeli ships with AI built in. No Ollama, no third-party installs.
> User downloads Kubeli → model downloads on first use → works forever.

---

## 1. Why This Approach

| Approach | User Steps | Friction |
|----------|-----------|----------|
| Ollama (current plan) | 1. Install Ollama, 2. Run `ollama serve`, 3. Pull model | **High** — 3 extra steps, separate app |
| **llama-server sidecar** | Model auto-downloads on first AI use | **Zero** — just use Kubeli |

**LM Studio** and **Jan.ai** both use llama.cpp internally for the same reason — it's the de facto standard for local LLM inference across all platforms.

---

## 2. Architecture

```
Kubeli.app (distributed)
├── Kubeli binary (Tauri)
├── binaries/
│   └── llama-server-{target-triple}    ← Pre-built, shipped with app
│
└── [App Data Directory]                ← Created at runtime
    └── models/
        ├── manifest.json               ← Model registry + versions
        └── kubeli-k8s-4b-Q4_K_M.gguf  ← Downloaded on first use
```

### Flow: First AI Use

```
User clicks "Analyze Logs" for the first time
    │
    ▼
┌────────────────────────────┐
│ 1. Check: model installed? │  → Look in app data dir
│    manifest.json exists?   │
└─────────┬──────────────────┘
          │ No
          ▼
┌────────────────────────────┐
│ 2. Show download dialog    │  "Kubi-1 needs to download
│    with progress bar       │   a 3GB AI model (one time)"
│    [Download] [Cancel]     │
└─────────┬──────────────────┘
          │ User clicks Download
          ▼
┌────────────────────────────┐
│ 3. Download GGUF from      │  Stream from GitHub Releases
│    GitHub/HuggingFace      │  or HuggingFace CDN
│    ████████░░ 78% 2.3GB    │  Progress via Tauri events
└─────────┬──────────────────┘
          │ Complete
          ▼
┌────────────────────────────┐
│ 4. Verify checksum         │  SHA-256 check
│    Write manifest.json     │
└─────────┬──────────────────┘
          │
          ▼
┌────────────────────────────┐
│ 5. Start llama-server      │  Sidecar process on random port
│    sidecar on 127.0.0.1    │  Health check: GET /health
└─────────┬──────────────────┘
          │ Ready
          ▼
┌────────────────────────────┐
│ 6. Run AI analysis         │  POST /v1/chat/completions
│    Stream response to UI   │  Same OpenAI-compat API
└────────────────────────────┘
```

### Flow: Subsequent Uses

```
User clicks "Analyze Logs"
    │
    ▼
Model already downloaded? → Yes → Start sidecar → Run AI
```

Startup: ~2-3 seconds (model loading). After that: ~30-50 tok/s on Apple Silicon M4.

---

## 3. llama-server Pre-Built Binaries

llama.cpp publishes **pre-built binaries for every platform** on every release. Current: **b8530**.

| Platform | Binary | Size | GPU |
|----------|--------|------|-----|
| macOS Apple Silicon | `llama-b8530-bin-macos-arm64.tar.gz` | ~15MB | Metal (built in) |
| macOS Intel | `llama-b8530-bin-macos-x64.tar.gz` | ~15MB | CPU |
| Windows x64 | `llama-b8530-bin-win-cpu-x64.zip` | ~10MB | CPU |
| Windows x64 CUDA | `llama-b8530-bin-win-cuda-12.4-x64.zip` | ~50MB | CUDA 12 |
| Windows x64 Vulkan | `llama-b8530-bin-win-vulkan-x64.zip` | ~15MB | Vulkan (AMD/Intel/NVIDIA) |
| Linux x64 | `llama-b8530-bin-ubuntu-x64.tar.gz` | ~10MB | CPU |
| Linux Vulkan | `llama-b8530-bin-ubuntu-vulkan-x64.tar.gz` | ~15MB | Vulkan |

**Download URL pattern:**
```
https://github.com/ggml-org/llama.cpp/releases/download/{version}/llama-{version}-bin-{platform}.{ext}
```

**What we ship:** The CPU variants (smallest, ~10-15MB, works everywhere). Metal is automatic on macOS (built into the binary). For users with NVIDIA GPUs, we can offer a CUDA variant as optional download.

### Tauri Config

```json
// tauri.conf.json
{
  "bundle": {
    "externalBin": ["binaries/llama-server"]
  }
}
```

The binary needs platform-specific naming:
```
src-tauri/binaries/
├── llama-server-aarch64-apple-darwin       # macOS Apple Silicon
├── llama-server-x86_64-apple-darwin        # macOS Intel
├── llama-server-x86_64-pc-windows-msvc.exe # Windows
└── llama-server-x86_64-unknown-linux-gnu   # Linux
```

### Build Script

```bash
#!/bin/bash
# scripts/fetch-llama-server.sh
# Run during CI or before local builds

LLAMA_VERSION="b8530"
BINARIES_DIR="src-tauri/binaries"
mkdir -p "$BINARIES_DIR"

# macOS ARM
curl -sL "https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_VERSION}/llama-${LLAMA_VERSION}-bin-macos-arm64.tar.gz" \
  | tar xz -C /tmp
cp /tmp/build/bin/llama-server "${BINARIES_DIR}/llama-server-aarch64-apple-darwin"

# macOS Intel
curl -sL "https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_VERSION}/llama-${LLAMA_VERSION}-bin-macos-x64.tar.gz" \
  | tar xz -C /tmp
cp /tmp/build/bin/llama-server "${BINARIES_DIR}/llama-server-x86_64-apple-darwin"

# Windows
curl -sL "https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_VERSION}/llama-${LLAMA_VERSION}-bin-win-cpu-x64.zip" \
  -o /tmp/llama-win.zip
unzip -o /tmp/llama-win.zip -d /tmp/llama-win
cp /tmp/llama-win/build/bin/llama-server.exe "${BINARIES_DIR}/llama-server-x86_64-pc-windows-msvc.exe"

# Linux
curl -sL "https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_VERSION}/llama-${LLAMA_VERSION}-bin-ubuntu-x64.tar.gz" \
  | tar xz -C /tmp
cp /tmp/build/bin/llama-server "${BINARIES_DIR}/llama-server-x86_64-unknown-linux-gnu"

chmod +x "${BINARIES_DIR}"/llama-server-*
echo "✅ llama-server binaries ready for all platforms"
```

---

## 4. Model Download & Storage

### Model Manifest

```json
// Stored in Tauri app data dir: models/manifest.json
{
  "version": "1",
  "models": {
    "kubeli-k8s-4b": {
      "version": "1.0.0",
      "filename": "kubeli-k8s-4b-Q4_K_M.gguf",
      "size_bytes": 2800000000,
      "sha256": "abc123...",
      "download_url": "https://huggingface.co/kubeli/kubi-1/resolve/main/kubeli-k8s-4b-Q4_K_M.gguf",
      "description": "Kubi-1 K8s troubleshooting model (4B, Q4_K_M)",
      "min_ram_gb": 4,
      "context_length": 8192,
      "downloaded_at": "2026-03-26T10:00:00Z"
    }
  },
  "registry_url": "https://raw.githubusercontent.com/kubeli-app/kubi-1/main/registry.json",
  "last_update_check": "2026-03-26T10:00:00Z"
}
```

### Model Storage Paths

```rust
// Using Tauri's path resolver
use tauri::Manager;

fn models_dir(app: &AppHandle) -> PathBuf {
    // macOS: ~/Library/Application Support/com.kubeli/models/
    // Windows: %APPDATA%/com.kubeli/models/
    // Linux: ~/.local/share/com.kubeli/models/
    app.path().app_data_dir().unwrap().join("models")
}
```

### Download with Progress

```rust
// src-tauri/src/ai/model_manager.rs

use tauri::Emitter;

#[derive(Clone, serde::Serialize)]
enum ModelDownloadEvent {
    Started { total_bytes: u64 },
    Progress { downloaded: u64, total: u64 },
    Verifying,
    Complete,
    Error { message: String },
}

async fn download_model(
    app: &AppHandle,
    url: &str,
    dest: &Path,
    expected_sha256: &str,
) -> Result<(), KubeliError> {
    let client = reqwest::Client::new();
    let response = client.get(url).send().await?;
    let total = response.content_length().unwrap_or(0);

    app.emit("model-download", ModelDownloadEvent::Started { total_bytes: total })?;

    let mut file = tokio::fs::File::create(dest).await?;
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    let mut hasher = sha2::Sha256::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        hasher.update(&chunk);
        file.write_all(&chunk).await?;
        downloaded += chunk.len() as u64;

        // Emit progress every 1MB
        if downloaded % (1024 * 1024) == 0 || downloaded == total {
            app.emit("model-download", ModelDownloadEvent::Progress {
                downloaded, total
            })?;
        }
    }

    // Verify SHA-256
    app.emit("model-download", ModelDownloadEvent::Verifying)?;
    let hash = format!("{:x}", hasher.finalize());
    if hash != expected_sha256 {
        tokio::fs::remove_file(dest).await?;
        return Err(KubeliError::new(
            ErrorKind::Integrity,
            "Model checksum mismatch — download may be corrupted"
        ));
    }

    app.emit("model-download", ModelDownloadEvent::Complete)?;
    Ok(())
}
```

### Download Sources (Fallback Chain)

1. **HuggingFace** (primary) — CDN-backed, fast globally, resumable
2. **GitHub Releases** (fallback) — reliable, integrated with our CI
3. Mirror URL (future, if needed)

```rust
const MODEL_URLS: &[&str] = &[
    "https://huggingface.co/kubeli/kubi-1/resolve/main/kubeli-k8s-4b-Q4_K_M.gguf",
    "https://github.com/kubeli-app/kubi-1/releases/download/v1.0.0/kubeli-k8s-4b-Q4_K_M.gguf",
];
```

---

## 5. Model Update Mechanism

### How It Works

Separate from the Tauri app updater (which updates Kubeli itself). Model updates are checked independently.

```
App starts
    │
    ▼
┌──────────────────────────────┐
│ Check model registry (async) │  GET registry.json (non-blocking)
│ Compare local manifest       │  Only on app start, max 1x/day
└───────────┬──────────────────┘
            │
    ┌───────┴────────┐
    │ New version?   │
    │                │
   No              Yes
    │                │
    ▼                ▼
  Done     ┌────────────────────┐
           │ Show notification: │
           │ "Kubi-1 v1.1 is   │
           │ available. Update  │
           │ now?"              │
           │ [Update] [Later]   │
           └────────┬───────────┘
                    │ Update
                    ▼
           ┌────────────────────┐
           │ Download new GGUF  │  Same download flow as initial
           │ in background      │  Old model kept until complete
           │ Swap when done     │  Atomic rename
           └────────────────────┘
```

### Remote Registry

Simple JSON file hosted on GitHub (free, reliable, cacheable):

```json
// https://raw.githubusercontent.com/kubeli-app/kubi-1/main/registry.json
{
  "latest": "1.1.0",
  "models": {
    "1.1.0": {
      "filename": "kubeli-k8s-4b-Q4_K_M.gguf",
      "size_bytes": 2850000000,
      "sha256": "def456...",
      "urls": [
        "https://huggingface.co/kubeli/kubi-1/resolve/v1.1.0/kubeli-k8s-4b-Q4_K_M.gguf",
        "https://github.com/kubeli-app/kubi-1/releases/download/v1.1.0/kubeli-k8s-4b-Q4_K_M.gguf"
      ],
      "release_notes": "Retrained on March 2026 K8s docs. Improved CrashLoopBackOff diagnosis.",
      "min_app_version": "0.4.0",
      "released_at": "2026-04-15T00:00:00Z"
    },
    "1.0.0": {
      "filename": "kubeli-k8s-4b-Q4_K_M.gguf",
      "size_bytes": 2800000000,
      "sha256": "abc123...",
      "urls": ["..."],
      "release_notes": "Initial Kubi-1 release.",
      "min_app_version": "0.4.0",
      "released_at": "2026-03-26T00:00:00Z"
    }
  },
  "llama_server_version": "b8530",
  "announcement": ""
}
```

### Update Logic (Rust)

```rust
// src-tauri/src/ai/model_updater.rs

const REGISTRY_URL: &str =
    "https://raw.githubusercontent.com/kubeli-app/kubi-1/main/registry.json";
const CHECK_INTERVAL: Duration = Duration::from_secs(86400); // 1x per day

pub async fn check_for_model_update(app: &AppHandle) -> Result<Option<ModelUpdate>, KubeliError> {
    let manifest = load_local_manifest(app)?;

    // Rate limit: don't check more than once per day
    if let Some(last) = manifest.last_update_check {
        if Utc::now() - last < CHECK_INTERVAL {
            return Ok(None);
        }
    }

    // Fetch remote registry
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()?;
    let registry: Registry = client.get(REGISTRY_URL).send().await?.json().await?;

    // Compare versions
    let current = manifest.models.get("kubeli-k8s-4b")
        .map(|m| &m.version)
        .unwrap_or(&"0.0.0".to_string());

    if semver::Version::parse(&registry.latest)? > semver::Version::parse(current)? {
        let update = &registry.models[&registry.latest];

        // Check min_app_version compatibility
        let app_version = app.package_info().version.clone();
        if semver::Version::parse(&update.min_app_version)? > semver::Version::parse(&app_version.to_string())? {
            // Need to update Kubeli first
            return Ok(Some(ModelUpdate::AppUpdateRequired {
                model_version: registry.latest,
                min_app_version: update.min_app_version.clone(),
            }));
        }

        return Ok(Some(ModelUpdate::Available {
            version: registry.latest,
            size_bytes: update.size_bytes,
            release_notes: update.release_notes.clone(),
            urls: update.urls.clone(),
            sha256: update.sha256.clone(),
        }));
    }

    // Update last check timestamp
    save_manifest_check_time(app)?;
    Ok(None)
}
```

### Atomic Model Swap

```rust
/// Download new model alongside old one, then atomic swap
async fn update_model(app: &AppHandle, update: &ModelUpdate) -> Result<(), KubeliError> {
    let models_dir = models_dir(app);
    let temp_path = models_dir.join("kubeli-k8s-4b-Q4_K_M.gguf.download");
    let final_path = models_dir.join("kubeli-k8s-4b-Q4_K_M.gguf");

    // 1. Download to temp file
    download_model(app, &update.urls[0], &temp_path, &update.sha256).await?;

    // 2. Stop llama-server if running
    stop_llama_server(app).await?;

    // 3. Atomic rename (old file overwritten)
    tokio::fs::rename(&temp_path, &final_path).await?;

    // 4. Update manifest
    update_manifest_version(app, &update.version).await?;

    // 5. Restart llama-server with new model
    start_llama_server(app, &final_path).await?;

    Ok(())
}
```

---

## 6. llama-server Lifecycle Management

### Startup

```rust
// src-tauri/src/ai/llama_manager.rs
use tauri_plugin_shell::ShellExt;

pub struct LlamaManager {
    port: u16,
    child: Option<CommandChild>,
    model_path: PathBuf,
}

impl LlamaManager {
    pub async fn start(app: &AppHandle) -> Result<Self, KubeliError> {
        let model_path = models_dir(app).join("kubeli-k8s-4b-Q4_K_M.gguf");

        if !model_path.exists() {
            return Err(KubeliError::new(ErrorKind::NotFound, "Model not downloaded"));
        }

        let port = find_free_port(); // Bind to random free port

        let (mut rx, child) = app.shell()
            .sidecar("llama-server")
            .unwrap()
            .args([
                "--model", model_path.to_str().unwrap(),
                "--port", &port.to_string(),
                "--host", "127.0.0.1",  // SECURITY: local only
                "--ctx-size", "8192",
                "--threads", &optimal_threads().to_string(),
                "--flash-attn",         // Enable Flash Attention if available
                "--cont-batching",      // Better throughput
                "--log-disable",        // Don't log to stdout
            ])
            .spawn()
            .map_err(|e| KubeliError::new(ErrorKind::Spawn, format!("Failed to start llama-server: {e}")))?;

        // Wait for health check
        let client = reqwest::Client::new();
        for _ in 0..30 { // Max 30 seconds
            tokio::time::sleep(Duration::from_secs(1)).await;
            if client.get(format!("http://127.0.0.1:{port}/health"))
                .send().await
                .map(|r| r.status().is_success())
                .unwrap_or(false)
            {
                return Ok(Self { port, child: Some(child), model_path });
            }
        }

        Err(KubeliError::new(ErrorKind::Timeout, "llama-server failed to start within 30s"))
    }

    pub fn api_url(&self) -> String {
        format!("http://127.0.0.1:{}", self.port)
    }

    pub async fn chat(&self, messages: Vec<ChatMessage>, stream: bool) -> Result<Response, KubeliError> {
        // POST http://127.0.0.1:{port}/v1/chat/completions
        // Exact same API as Ollama — code barely changes from current plan
        todo!()
    }

    pub async fn stop(&mut self) -> Result<(), KubeliError> {
        if let Some(child) = self.child.take() {
            child.kill()?;
        }
        Ok(())
    }
}

fn optimal_threads() -> usize {
    let cpus = num_cpus::get();
    // Use N-2 threads (leave room for OS + Kubeli)
    (cpus.saturating_sub(2)).max(1)
}
```

### When to Start/Stop

- **Start**: Lazily on first AI request (not on app launch — saves resources)
- **Stop**: After 5 minutes of no AI activity (configurable)
- **Restart**: On model update, on settings change
- **Crash handling**: If sidecar dies, show error + offer restart

### Security

- Binds to `127.0.0.1` only — not accessible from network
- Random port each time — no port conflicts
- No CORS needed (Rust backend proxies all requests)
- Model files have SHA-256 verification
- Registry fetched over HTTPS

---

## 7. Frontend: Model Setup UI

Extends Settings → AI tab:

```
┌─────────────────────────────────────────────────┐
│ Kubi-1 AI Model                                  │
├─────────────────────────────────────────────────┤
│                                                 │
│ ● Model ready: kubeli-k8s:4b v1.0.0            │
│   Size: 2.8 GB · Context: 8K tokens            │
│                                                 │
│   🔄 Update available: v1.1.0                   │
│      "Improved CrashLoopBackOff diagnosis"      │
│      [Update Now]  [Later]                      │
│                                                 │
│ ─── OR (first time) ─────────────────────────── │
│                                                 │
│ ○ No model installed                            │
│   Download Kubi-1 (2.8 GB) to enable local AI   │
│   [Download]                                    │
│                                                 │
│   ████████████████░░░░ 78% (2.2 / 2.8 GB)      │
│                                                 │
│ ─── Advanced ────────────────────────────────── │
│                                                 │
│ ☐ Use custom GGUF model file                    │
│   [Browse...]                                   │
│                                                 │
│ ☐ Use external Ollama (for advanced users)      │
│   Host: http://127.0.0.1:11434                  │
│                                                 │
│ ⓘ AI runs entirely on this device.              │
│   No data leaves your machine.                  │
└─────────────────────────────────────────────────┘
```

---

## 8. Impact on Existing OpenSpec Design

### What Changes

| Component | Current Plan (Ollama) | New Plan (Sidecar) |
|-----------|----------------------|---------------------|
| **Inference engine** | Ollama (external) | llama-server (bundled sidecar) |
| **Install steps** | User installs Ollama | Zero — shipped with Kubeli |
| **Model download** | `ollama pull qwen3:4b` | Auto-download GGUF from HF/GitHub |
| **Model updates** | Manual `ollama pull` | Registry check + auto-update prompt |
| **API** | OpenAI-compat via Ollama | OpenAI-compat via llama-server (same!) |
| **Process management** | Detect external ollama | Manage sidecar lifecycle |
| **Security** | Pin Ollama ≥0.3.15 | Pin llama.cpp version, verify GGUF checksums |
| **Bundle size impact** | +0 MB | **+10-15 MB** (llama-server binary) |
| **ollama-rs dependency** | Required | **Remove** — use reqwest directly |
| **llmfit-core** | Keep for hardware detection | Keep — still useful for model recommendations |

### What Stays the Same

- k8sgpt-pattern analyzers (Rust) — unchanged
- Log preprocessor — unchanged
- Data sanitizer — unchanged
- System prompt + context builder — unchanged
- Frontend AI chat UI — unchanged (same events)
- Settings UI — minor additions (download progress, update button)
- Session storage (SQLite) — unchanged
- Provider fallback chain — unchanged (Local → Claude CLI → Codex CLI)

### What to Add

- `src-tauri/src/ai/llama_manager.rs` — sidecar lifecycle
- `src-tauri/src/ai/model_manager.rs` — download, verify, update
- `src-tauri/src/ai/model_updater.rs` — registry check, update flow
- `scripts/fetch-llama-server.sh` — CI script to download binaries
- Model registry JSON (hosted on GitHub)
- Frontend: download progress component, update notification

### What to Remove

- `ollama-rs` Cargo dependency
- `OllamaManager` (replaced by `LlamaManager`)
- Ollama version checking
- Ollama install instructions in UI

### Optional: Keep Ollama as Advanced Option

For power users who already run Ollama with custom models:
- Settings → Advanced → "Use external Ollama" checkbox
- Points to custom Ollama host:port
- Uses same API (both are OpenAI-compat)

---

## 9. CI/CD Integration

### GitHub Actions: Build with llama-server

```yaml
# .github/workflows/build.yml (addition)
- name: Fetch llama-server binaries
  run: ./scripts/fetch-llama-server.sh
  env:
    LLAMA_VERSION: "b8530"

- name: Build Tauri app
  run: make build
```

### Model Release Pipeline

```yaml
# .github/workflows/release-model.yml
name: Release Kubi-1 Model
on:
  workflow_dispatch:
    inputs:
      version: { type: string, required: true }

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Download GGUF from training
        # Pull from Windows machine or Vast.ai artifact
        run: ...

      - name: Compute SHA-256
        run: sha256sum kubeli-k8s-4b-Q4_K_M.gguf > checksums.txt

      - name: Upload to HuggingFace
        run: huggingface-cli upload kubeli/kubi-1 kubeli-k8s-4b-Q4_K_M.gguf
        env:
          HF_TOKEN: ${{ secrets.HF_TOKEN }}

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: v${{ inputs.version }}
          files: |
            kubeli-k8s-4b-Q4_K_M.gguf
            checksums.txt

      - name: Update registry.json
        run: |
          # Update registry.json with new version, URLs, SHA-256
          python scripts/update_registry.py ${{ inputs.version }}
          git add registry.json
          git commit -m "model: release kubi-1 v${{ inputs.version }}"
          git push
```

---

## Sources

| # | Source | URL | Retrieved |
|---|--------|-----|-----------|
| 1 | Tauri v2 Sidecar Docs | https://v2.tauri.app/develop/sidecar/ | 2026-03-26 |
| 2 | Tauri v2 Updater Plugin | https://v2.tauri.app/plugin/updater/ | 2026-03-26 |
| 3 | Tauri v2 Shell Plugin | https://v2.tauri.app/plugin/shell/ | 2026-03-26 |
| 4 | llama.cpp Releases (b8530) | https://github.com/ggml-org/llama.cpp/releases | 2026-03-26 |
| 5 | LM Studio Docs (uses llama.cpp) | https://lmstudio.ai/docs | 2026-03-26 |
| 6 | GitHub Releases REST API | https://docs.github.com/en/rest/releases/releases | 2026-03-26 |
