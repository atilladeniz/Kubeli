# Tasks: Local K8s AI Model

## Phase 1: Foundation

### Task 1: Ollama client in Rust backend
- [ ] Add Ollama REST client to `src-tauri/src/ai/`
- [ ] Implement `check_ollama_status()` - detect running Ollama, list installed models
- [ ] Implement `query_local_model()` - chat completion via `POST /api/chat`
- [ ] Implement `pull_ollama_model()` - pull model with streaming progress via Tauri events
- [ ] Handle connection errors gracefully (Ollama not installed, not running)

### Task 2: llmfit CLI integration
- [ ] Add Tauri command `get_hardware_recommendation()`
- [ ] Detect if `llmfit` is in PATH, return hardware info if not available via `sysinfo` fallback
- [ ] Parse `llmfit recommend --json` output
- [ ] Filter recommendations against curated K8s-suitable model list
- [ ] Return best-fit model with hardware details to frontend

### Task 3: K8s context builder
- [ ] Create `K8sContextBuilder` struct in `src-tauri/src/ai/`
- [ ] Gather current cluster info (name, provider, namespace)
- [ ] Fetch recent warning/error events (last 50)
- [ ] Build resource summary for current namespace
- [ ] Compose system prompt from template + context
- [ ] Respect token limits (keep context under 2K tokens, leave room for logs)

## Phase 2: Frontend

### Task 4: Settings UI - AI Model section
- [ ] New section in Settings page: "Local AI Model"
- [ ] Show detected hardware info (CPU, RAM, GPU)
- [ ] Show recommended model with fit score
- [ ] "Download & Setup" button that triggers Ollama pull with progress bar
- [ ] Model status indicator (not installed / downloading / ready)
- [ ] Model selector dropdown for manual override
- [ ] Store selected model in settings

### Task 5: Provider priority configuration
- [ ] Add provider priority list to Settings (drag-to-reorder)
- [ ] Options: Local Model, Claude Code CLI, OpenAI Codex CLI
- [ ] Store priority order in settings
- [ ] Update `agent_manager.rs` to respect priority order
- [ ] Add per-query provider override in AI chat UI

### Task 6: Log analysis integration
- [ ] Add "Analyze with Local AI" option to log view context menu
- [ ] Pipe selected logs + K8s context to local model
- [ ] Stream response tokens back to AI chat panel
- [ ] Show which provider is being used (local / Claude / OpenAI)

## Phase 3: Polish

### Task 7: Ollama lifecycle management
- [ ] Auto-detect Ollama on app startup (non-blocking)
- [ ] Show setup wizard on first launch if Ollama available but no model pulled
- [ ] Handle Ollama going offline mid-session (fallback to cloud providers)
- [ ] Model update check (notify when newer version available)

### Task 8: Smart routing
- [ ] Route simple queries (log analysis, error lookup) to local model
- [ ] Route complex queries (architecture advice, multi-resource analysis) to cloud providers
- [ ] Let user override routing per query
- [ ] Track response quality metrics (optional: thumbs up/down)

## Model Candidates (Curated List)

| Model | Params | RAM | Context | Tool Calling | Best For |
|-------|--------|-----|---------|-------------|----------|
| `qwen3:4b` | 4B | ~3GB | 32K | Yes | Default choice, balanced |
| `qwen3:1.7b` | 1.7B | ~1.5GB | 32K | Yes | Low-RAM fallback |
| `qwen3:8b` | 8B | ~5GB | 32K | Yes | Best quality if RAM allows |
| `phi4-mini` | 3.8B | ~2.5GB | 128K | Yes | Long log analysis (128K ctx) |
| `granite4:3b` | 3B | ~2GB | 128K | Yes | Structured data, enterprise |
| `qwen3.5:4b` | 4B | ~3GB | 128K | Yes | Newest, multimodal |

## Dependencies

- [llmfit](https://github.com/AlexsJones/llmfit) - Hardware detection + model recommendation
- [Ollama](https://ollama.com) - Local model runtime
- Existing: `src-tauri/src/ai/` module, AI feature UI
