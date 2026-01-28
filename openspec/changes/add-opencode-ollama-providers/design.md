## Context

Kubeli's AI Assistant feature currently supports two AI CLI providers:
- **Claude Code CLI** (`claude`) - Anthropic's official CLI
- **Codex CLI** (`codex`) - OpenAI's coding agent

Both integrate via subprocess spawning with JSON streaming output. Users have requested support for:
- **OpenCode** - Open-source AI coding agent (similar architecture to Claude Code)
- **Ollama** - Local LLM server with HTTP API (different architecture)

## Goals / Non-Goals

**Goals:**
- Detect OpenCode and Ollama installations automatically
- Provide consistent UX across all providers
- Support Ollama's model selection (multiple models can be installed)
- Maintain existing provider behavior unchanged

**Non-Goals:**
- Managing Ollama model downloads (user handles via `ollama pull`)
- Running Ollama server (user starts separately)
- Supporting Ollama's vision/embedding APIs
- OpenCode server mode or SDK integration

## Decisions

### Decision: Provider Architecture

**Option A (chosen): Unified Provider Interface**
- All providers implement same session interface
- Provider-specific logic isolated in `agent_manager.rs`
- Frontend doesn't need to know provider internals

**Option B: Separate Managers**
- Each provider gets its own manager module
- More code duplication but cleaner separation

Rationale: Option A maintains current architecture, minimizes changes, and keeps providers consistent.

### Decision: Ollama Integration Method

**Option A (chosen): HTTP API Direct**
- Call Ollama's REST API directly from Rust
- Use `reqwest` for HTTP calls
- Parse streaming JSON responses

**Option B: CLI Wrapper**
- Use `ollama run` CLI command
- Parse stdout like other providers

Rationale: Ollama's HTTP API is well-documented and more reliable for programmatic use. The `ollama run` command is designed for interactive terminal use.

### Decision: Ollama Model Selection

**Option A (chosen): Per-Session Model Selection**
- Model selected in Settings panel
- Stored in `ui-store.ts` as `ollamaModel: string`
- Applied when starting new session

**Option B: Per-Message Model Selection**
- Allow switching models mid-conversation

Rationale: Option A aligns with how other providers work (one model per session) and is simpler to implement.

### Decision: OpenCode Integration

**Option A (chosen): CLI `run` Command**
- Use `opencode run "prompt"` for non-interactive execution
- Parse output with `--format json` flag
- Similar pattern to existing Claude/Codex

**Verified CLI syntax (from [OpenCode Docs](https://opencode.ai/docs/cli/)):**
```bash
opencode run [message..] [flags]

# Key flags:
#   --model/-m      Select model (e.g., anthropic/claude-sonnet-4-5)
#   --agent         Select agent (build, plan, or custom)
#   --format        Output format (json for structured output)
#   --attach        Connect to running server for faster cold starts
#   --continue/-c   Continue existing session
#   --session/-s    Use specific session ID
```

**Example invocation:**
```bash
opencode run --format json --model anthropic/claude-sonnet-4-5 "Analyze this Kubernetes deployment"
```

**Option B: SDK Integration**
- Use `@opencode-ai/sdk` via embedded Node.js
- More complex but potentially richer features

Rationale: CLI approach maintains consistency with existing providers and doesn't require Node.js runtime.

## Provider Detection Logic

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI Detection Flow                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  check_all_providers()                                       │
│       │                                                      │
│       ├──► check_claude_cli_available()                      │
│       │         └──► which claude / known paths              │
│       │                                                      │
│       ├──► check_codex_cli_available()                       │
│       │         └──► which codex / known paths               │
│       │                                                      │
│       ├──► check_opencode_cli_available()        [NEW]       │
│       │         └──► which opencode / known paths            │
│       │                                                      │
│       └──► check_ollama_available()              [NEW]       │
│                 ├──► which ollama / known paths              │
│                 └──► GET localhost:11434/api/version         │
│                           └──► if ok: list models            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Ollama API Integration

**Verified Endpoints (from [Ollama API Docs](https://github.com/ollama/ollama/blob/main/docs/api.md)):**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Health check - returns "Ollama is running" |
| `/api/version` | GET | Get server version |
| `/api/tags` | GET | List installed models |
| `/api/chat` | POST | Chat completion (streaming) |

**List Models Response (`GET /api/tags`):**
```json
{
  "models": [
    {
      "name": "llama3.2:latest",
      "size": 3338801804,
      "details": {
        "parameter_size": "4.3B",
        "quantization_level": "Q4_K_M"
      }
    }
  ]
}
```

**Chat Request (`POST /api/chat`):**
```json
{
  "model": "llama3.2",
  "messages": [
    {"role": "system", "content": "You are a Kubernetes assistant..."},
    {"role": "user", "content": "Analyze this pod..."}
  ],
  "stream": true,
  "options": {
    "temperature": 0.7
  }
}
```

**Streaming Response (NDJSON):**
```json
{"message":{"role":"assistant","content":"The"},"done":false}
{"message":{"role":"assistant","content":" pod"},"done":false}
{"message":{"role":"assistant","content":"..."},"done":true,"done_reason":"stop","total_duration":1234567890}
```

```
┌─────────────────────────────────────────────────────────────┐
│                    Ollama Session Flow                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  start_session(provider=Ollama, model="llama3.2")           │
│       │                                                      │
│       ├──► Verify server: GET http://localhost:11434/        │
│       │                                                      │
│       └──► Create session with model stored                  │
│                                                              │
│  send_message("Analyze this pod...")                         │
│       │                                                      │
│       └──► POST /api/chat (streaming)                        │
│                 │                                            │
│                 └──► Parse NDJSON, emit MessageChunk         │
│                      until done:true received                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Additional Ollama API Details

**From [Ollama Full Documentation](https://docs.ollama.com/llms-full.txt):**

| Feature | Details |
|---------|---------|
| **OpenAI-Compatible** | `/v1/chat/completions` endpoint available |
| **Running Models** | `GET /api/ps` lists currently loaded models |
| **Tool Calling** | Supported via `tools` array in request |
| **Thinking Mode** | Some models support `thinking: true` parameter |
| **Error Format** | `{"error": "description"}` |
| **Status Codes** | 200 OK, 400 Bad Request, 404 Model Not Found, 429 Rate Limited |

**Alternative Integration Option:**
Could use OpenAI-compatible endpoint for simpler integration:
```bash
POST http://localhost:11434/v1/chat/completions
# Same format as OpenAI API
```

## OpenCode Details

**Repository:** [anomalyco/opencode](https://github.com/anomalyco/opencode) (90k+ stars)

**Installation paths:**
- curl: `~/.local/bin/opencode`
- npm global: `opencode-ai` package
- Homebrew: `/opt/homebrew/bin/opencode`
- Scoop/Chocolatey (Windows)

**Known Issues (from GitHub):**
- [#3213](https://github.com/anomalyco/opencode/issues/3213): CLI may hang on exit in v0.15+
- [#2439](https://github.com/anomalyco/opencode/issues/2439): `--model` flag sometimes ignored

**Mitigation:** Check exit status, implement timeout for process termination.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Ollama server not running | Show clear status indicator, provide "Start Ollama" instructions |
| Ollama model not downloaded | Detect empty model list, show hint to run `ollama pull` |
| OpenCode CLI hang on exit | Implement process timeout, force kill after 5s |
| OpenCode model flag ignored | Always verify model in output, warn if mismatch |
| Performance variance with local models | Document that local models may be slower depending on hardware |

## Migration Plan

No migration needed - purely additive change. Existing Claude/Codex users unaffected.

## Open Questions

1. Should we support Ollama's `keep_alive` parameter to control model unloading?
2. Should OpenCode's `--attach` mode be supported for faster cold starts?
3. Should we show Ollama's hardware requirements (RAM/VRAM) per model?
4. Should we use Ollama's OpenAI-compatible endpoint instead of native API?
5. Should we support Ollama's tool calling for Kubernetes operations?

These can be addressed in follow-up changes after initial implementation.
