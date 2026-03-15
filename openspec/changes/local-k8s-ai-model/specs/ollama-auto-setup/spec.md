# Spec: Ollama Auto-Setup

## Purpose

One-click local AI setup: detect Ollama, pull the recommended model, and configure Kubeli to use it.

## Setup Flow

### 1. Detection (app startup, non-blocking)
```
GET http://localhost:11434/api/tags
```
- Success: Ollama running, parse installed models
- Connection refused: Ollama not installed or not running
- Respect OLLAMA_HOST env var for custom endpoints

### 2. First-Time Setup Wizard (Settings > AI Model)

Step 1: Ollama Status
- Running + model installed: "Ready" (skip wizard)
- Running + no model: "Pull recommended model?"
- Not running: "Install Ollama" link + instructions per platform

Step 2: Model Selection
- Show hardware info (from llmfit or sysinfo)
- Show recommended model with estimated performance
- "Download" button → streams pull progress

Step 3: Verification
- Send test prompt to verify model responds
- Show estimated tokens/second
- "Setup complete"

### 3. Model Pull with Progress

```rust
// POST http://localhost:11434/api/pull
// Body: { "name": "qwen3:4b", "stream": true }
// Response: streaming JSON lines with progress

struct PullProgress {
    status: String,        // "pulling manifest", "downloading", "verifying"
    digest: Option<String>,
    total: Option<u64>,
    completed: Option<u64>,
}
```

Emit Tauri events for frontend progress bar:
```rust
app.emit("ollama-pull-progress", &progress)?;
```

### 4. Chat Completion

```rust
// POST http://localhost:11434/api/chat
// Body:
{
    "model": "qwen3:4b",
    "messages": [
        { "role": "system", "content": "<k8s system prompt>" },
        { "role": "user", "content": "<user query + log context>" }
    ],
    "stream": true
}
```

Stream response tokens via Tauri events for real-time display.

## Ollama REST Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/tags` | GET | List installed models |
| `/api/pull` | POST | Download model (streaming) |
| `/api/chat` | POST | Chat completion (streaming) |
| `/api/show` | POST | Model details (size, params) |

## Platform-Specific Install Instructions

| Platform | How to Install Ollama |
|----------|----------------------|
| macOS | `brew install ollama` or download from ollama.com |
| Windows | Download installer from ollama.com |
| Linux | `curl -fsSL https://ollama.com/install.sh \| sh` |

## Configuration Storage

Store in Kubeli settings (Tauri store):
```json
{
    "ai": {
        "local_model": "qwen3:4b",
        "ollama_host": "http://localhost:11434",
        "provider_priority": ["local", "claude-cli", "openai-cli"],
        "auto_route": true
    }
}
```
