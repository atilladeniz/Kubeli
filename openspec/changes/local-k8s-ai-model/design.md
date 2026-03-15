# Design: Local K8s AI Model

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Kubeli App                         │
│                                                         │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────┐ │
│  │  AI Feature   │   │   Settings   │   │  Log View  │ │
│  │  (React)      │   │  Model Setup │   │  "Analyze" │ │
│  └──────┬───────┘   └──────┬───────┘   └─────┬──────┘ │
│         │                   │                  │        │
│  ┌──────▼───────────────────▼──────────────────▼──────┐ │
│  │              Tauri Commands (Rust)                  │ │
│  │                                                     │ │
│  │  ┌─────────────┐  ┌──────────┐  ┌───────────────┐ │ │
│  │  │ llmfit-core │  │ Ollama   │  │ K8s Context   │ │ │
│  │  │ (hardware   │  │ Client   │  │ Builder       │ │ │
│  │  │  detection) │  │ (REST)   │  │ (system       │ │ │
│  │  │             │  │          │  │  prompt +      │ │ │
│  │  │             │  │          │  │  log context)  │ │ │
│  │  └─────────────┘  └────┬─────┘  └───────────────┘ │ │
│  └─────────────────────────┼──────────────────────────┘ │
└─────────────────────────────┼───────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Ollama Server   │
                    │   (localhost:      │
                    │    11434)          │
                    │                   │
                    │  ┌─────────────┐  │
                    │  │ qwen3:4b    │  │
                    │  │ or best-fit │  │
                    │  │ model       │  │
                    │  └─────────────┘  │
                    └───────────────────┘
```

## Component Design

### 1. Hardware Detection (llmfit integration)

Two options evaluated:

**Option A: llmfit as Rust crate dependency**
- Add `llmfit-core` to `src-tauri/Cargo.toml`
- Call hardware detection and model scoring directly from Rust
- Pro: No external binary needed, faster, tighter integration
- Con: Pulls in llmfit's dependency tree

**Option B: llmfit as CLI sidecar**
- Detect if `llmfit` is installed, prompt to install if not
- Call `llmfit recommend --json --use-case general --limit 5`
- Pro: Loose coupling, user can update llmfit independently
- Con: External dependency, slower startup

**Decision: Option B (CLI sidecar) for v1, Option A for v2.**
llmfit is still evolving. CLI integration is simpler and avoids version coupling.

### 2. Model Selection Strategy

Based on research, the recommended model priority for K8s log analysis:

| Priority | Model | Params | RAM | Why |
|----------|-------|--------|-----|-----|
| 1 | `qwen3:4b` | 4B | ~3GB | Best tool-calling + reasoning at this size, "thinking" mode |
| 2 | `qwen3:1.7b` | 1.7B | ~1.5GB | Fallback for low-RAM systems, still has tool support |
| 3 | `phi4-mini:3.8b` | 3.8B | ~2.5GB | Strong reasoning, 128K context window |
| 4 | `granite4:3b` | 3B | ~2GB | IBM enterprise model, good at structured data |
| 5 | `qwen3:8b` | 8B | ~5GB | If hardware allows, best quality |

Selection flow:
```
1. Run `llmfit recommend --json --limit 5`
2. Filter results by our curated list above
3. Pick highest-priority model that llmfit rates as "good" or "perfect" fit
4. If no match: fall back to smallest model (qwen3:1.7b)
5. Present recommendation to user in Settings UI
```

### 3. Ollama Management

```
┌─────────────────────────────────────────┐
│           Ollama Status Check           │
└────────────────┬────────────────────────┘
                 │
         ┌───────▼────────┐
         │ Ollama running? │
         └───┬────────┬───┘
           No│        │Yes
    ┌────────▼──┐  ┌──▼────────────┐
    │ Show      │  │ Check model   │
    │ install   │  │ installed?    │
    │ prompt    │  └──┬─────────┬──┘
    └───────────┘   No│         │Yes
              ┌───────▼──┐  ┌──▼──────┐
              │ Pull      │  │ Ready!  │
              │ recommended│  │ Show    │
              │ model     │  │ status  │
              └───────────┘  └─────────┘
```

Tauri commands needed:
- `check_ollama_status()` - Is Ollama running? What models installed?
- `get_hardware_recommendation()` - Run llmfit, return best model
- `pull_ollama_model(model: String)` - Pull model with progress events
- `query_local_model(prompt: String, context: K8sContext)` - Chat completion

### 4. K8s Context Builder

The key differentiator: we inject K8s-specific context that generic models don't have.

```rust
struct K8sContext {
    /// Current namespace and cluster info
    cluster_info: String,
    /// Recent events (warnings/errors)
    recent_events: Vec<String>,
    /// Resource state summary
    resource_summary: String,
    /// The actual logs being analyzed
    logs: String,
}
```

System prompt template:
```
You are a Kubernetes troubleshooting assistant running inside Kubeli,
a K8s management desktop app. You have direct access to cluster state.

Current context:
- Cluster: {cluster_name} ({provider})
- Namespace: {namespace}

Recent cluster events:
{events}

Resource state:
{resource_summary}

Your job:
- Analyze the logs provided by the user
- Identify errors, warnings, and anomalies
- Suggest specific kubectl commands or resource changes to fix issues
- Be concise and actionable

Do not hallucinate resource names. Only reference resources that appear
in the context above.
```

### 5. Provider Priority Chain

User-configurable in Settings:

```
Default order: Local -> Claude CLI -> OpenAI CLI

If local model available and query is log/troubleshooting:
  -> Use local model (fast, private, free)

If query is complex architecture question:
  -> Use Claude/OpenAI (better reasoning at scale)

User can override per-query or change default order.
```

### 6. Settings UI

New section in Settings: "AI Model"

```
┌─────────────────────────────────────────────┐
│ AI Model                                     │
├─────────────────────────────────────────────┤
│                                             │
│ Hardware Detected:                          │
│   CPU: Apple M2 Pro (12 cores)             │
│   RAM: 32 GB                                │
│   GPU: Apple Silicon (Metal)                │
│                                             │
│ Recommended Model: qwen3:4b                 │
│   Estimated: ~25 tok/s, 3.2 GB RAM          │
│   Fit: Perfect ✓                            │
│                                             │
│ [Download & Setup]  [Change Model ▾]        │
│                                             │
│ Status: ● Ready (qwen3:4b loaded)           │
│                                             │
│ Provider Priority:                          │
│   1. ☐ Local Model (qwen3:4b)              │
│   2. ☐ Claude Code CLI                      │
│   3. ☐ OpenAI Codex CLI                    │
│   [drag to reorder]                         │
│                                             │
└─────────────────────────────────────────────┘
```

## Key Decisions

1. **llmfit CLI first, crate later** - Avoids tight coupling during llmfit's active development
2. **Ollama as runtime** - Mature, OpenAI-compatible API, handles model management
3. **System prompt over fine-tuning** - 80/20 rule: good system prompt + K8s context is enough for v1
4. **Qwen3 4B as default** - Best tool-calling and reasoning in the 3-5B range
5. **No bundled model** - Models are 2-5GB, too large to bundle. Download on first use.
