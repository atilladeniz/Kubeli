# Spec: Local model auto-setup

## Purpose

Detect local model availability, download the recommended GGUF, and start Kubeli's built-in inference engine. Target: under 5 minutes on a normal broadband connection.

## Setup flow

### 1. Detection (app startup, non-blocking)

- Read local manifest from the app data directory
- Check whether the configured model file exists and matches the recorded checksum
- If local AI is already running, query `GET /health` on the sidecar
- If advanced mode is enabled, also probe the external Ollama host

### 2. First-time setup (Settings > AI Model)

Step 1: Check local status
- Model installed + checksum valid -> skip to "Ready"
- Model missing or invalid -> offer one-click download
- Existing temporary download found -> offer resume or restart

Step 2: Model selection
- Show hardware info from `llmfit-core`
- Show recommended Kubi-1 model with size and estimated tok/s
- "Download" starts a streamed download with progress

Step 3: Verify and benchmark
- Verify SHA-256
- Run a short benchmark prompt
- Display measured tok/s
- Mark model ready

### 3. Download with progress

```rust
enum ModelDownloadEvent {
    Started { total_bytes: u64 },
    Progress { downloaded: u64, total: u64 },
    Verifying,
    Complete,
    Error { message: String },
    Cancelled,
}
```

Requirements:
- Download to a temp file in the models directory
- Support resume when the remote source allows ranged requests
- Allow user-triggered cancellation
- Delete corrupt temp files on checksum failure

### 4. Sidecar startup

```rust
// app.shell().sidecar("llama-server")
```

Requirements:
- Bind to `127.0.0.1` on a random free port
- Pass model path, context size, thread count, and batching flags
- Poll `GET /health` until ready or timeout after 30 seconds

### 5. Chat completion

```rust
// POST http://127.0.0.1:{port}/v1/chat/completions
```

Use OpenAI-compatible chat completion requests and stream tokens to the frontend via `app.emit()`.

## Endpoints used

| Endpoint | Method | What it does |
|----------|--------|-------------|
| `/health` | GET | Sidecar readiness probe |
| `/v1/chat/completions` | POST | Chat completion with SSE streaming |

## Advanced compatibility mode

Kubeli may optionally expose "Use external Ollama instead of built-in engine" for power users. In that mode:
- Probe the configured Ollama host
- Reuse the same chat abstraction
- Keep the built-in sidecar as the default path

## Configuration

Stored in Kubeli settings:

```json
{
  "ai": {
    "local_model": "kubi-1",
    "provider_priority": ["local", "claude", "codex"],
    "smart_routing": true,
    "use_external_ollama": false,
    "ollama_host": "http://127.0.0.1:11434"
  }
}
```
