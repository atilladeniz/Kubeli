# Spec: Ollama auto-setup

## Purpose

Detect Ollama, pull the recommended model, configure Kubeli to use it. Should take under 5 minutes.

## Setup flow

### 1. Detection (app startup, non-blocking)
```
GET http://127.0.0.1:11434/api/tags
```
- 200 OK: Ollama running, parse installed models
- Connection refused: not installed or not running
- Respect `OLLAMA_HOST` env var for custom endpoints
- Verify binding is 127.0.0.1, warn if 0.0.0.0 (security risk)
- Check version ≥0.3.15 (older versions have known RCE vulnerabilities)

### 2. First-time setup (Settings > AI Model)

Step 1: Check Ollama status
- Running + model installed → skip to "Ready"
- Running + no model → offer to pull recommended model
- Not running → show install instructions for the user's platform

Step 2: Model selection
- Show hardware info (from llmfit-core)
- Show recommended model with estimated tok/s (as range, not exact number)
- "Download" button starts streaming pull

Step 3: Verify
- Send test prompt, confirm model responds
- Display measured tok/s
- Done

### 3. Model pull with progress

```rust
// POST http://127.0.0.1:11434/api/pull
// Body: { "name": "qwen3:4b", "stream": true }
// Response: streaming JSON lines

struct PullProgress {
    status: String,        // "pulling manifest", "downloading", "verifying"
    digest: Option<String>,
    total: Option<u64>,
    completed: Option<u64>,
}
```

Stream progress to frontend via Tauri 2 Channel API:
```rust
channel.send(PullProgress { ... })?;
```

### 4. Chat completion

```rust
// POST http://127.0.0.1:11434/api/chat
{
    "model": "qwen3:4b",
    "messages": [
        { "role": "system", "content": "<k8s system prompt>" },
        { "role": "user", "content": "<user query + log context>" }
    ],
    "stream": true
}
```

Stream response tokens via Tauri Channel for real-time display in the AI chat panel.

## Ollama endpoints used

| Endpoint | Method | What it does |
|----------|--------|-------------|
| `/api/tags` | GET | List installed models |
| `/api/pull` | POST | Download model (streaming) |
| `/api/chat` | POST | Chat completion (streaming) |
| `/api/show` | POST | Model details (size, params) |

## Install instructions by platform

| Platform | Command |
|----------|---------|
| macOS | `brew install ollama` or ollama.com download |
| Windows | Installer from ollama.com |
| Linux | `curl -fsSL https://ollama.com/install.sh \| sh` |

## Configuration

Stored in Kubeli settings (Tauri store):
```json
{
    "ai": {
        "local_model": "qwen3:4b",
        "ollama_host": "http://127.0.0.1:11434",
        "provider_priority": ["local", "claude-cli", "openai-cli"],
        "auto_route": true
    }
}
```
