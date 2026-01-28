# Change: Add OpenCode and Ollama AI Provider Support

## Why
Kubeli currently supports Claude Code CLI and Codex CLI for AI-assisted Kubernetes management. Users have requested support for additional AI tools:
- **OpenCode**: Open-source AI coding agent with TUI, web interface, and SDK - growing alternative to proprietary tools
- **Ollama**: Local LLM server allowing users to run AI models on their own hardware without cloud dependencies

Adding these providers expands user choice, enables offline/private AI usage (Ollama), and supports the growing open-source AI ecosystem.

## What Changes

### Backend (Rust)
- Extend `AiCliProvider` enum with `OpenCode` and `Ollama` variants
- Add detection logic in `cli_detector.rs` for:
  - OpenCode CLI (`opencode` binary)
  - Ollama server (`ollama` binary + running server check)
- Add Ollama-specific functionality:
  - List available local models via `ollama list`
  - Store selected model in settings
- Add OpenCode-specific session handling in `agent_manager.rs`:
  - Use `opencode run` for non-interactive mode with JSON output
  - Parse OpenCode's streaming events
- Add Ollama session handling:
  - Direct HTTP API calls to `localhost:11434`
  - Support for `/api/generate` and `/api/chat` endpoints
  - Model selection per session

### Frontend (TypeScript)
- Extend `AiCliProvider` type with `'opencode' | 'ollama'`
- Update Settings panel:
  - Show all detected providers with status badges
  - Add Ollama model selector (dropdown populated from `ollama list`)
  - Show Ollama server status (running/stopped)
- Update AI store to handle Ollama model selection
- Add i18n strings for new providers

### UI/UX
- Provider selection shows availability status for all 4 providers
- Ollama section shows:
  - Server status indicator (green/red)
  - Model dropdown (only when server running)
  - "Start Ollama" hint when server not running
- OpenCode section shows version and path like existing providers

## Impact
- Affected specs: New capability `ai-provider-integration`
- Affected code:
  - `src-tauri/src/ai/cli_detector.rs` - Add OpenCode and Ollama detection
  - `src-tauri/src/ai/agent_manager.rs` - Add provider-specific session handling
  - `src-tauri/src/ai/commands.rs` - New commands for Ollama model listing
  - `src/lib/stores/ui-store.ts` - Extend provider type and add Ollama model setting
  - `src/lib/stores/ai-store.ts` - Handle Ollama model in session start
  - `src/components/features/settings/SettingsPanel.tsx` - Provider UI expansion
  - `src/i18n/messages/*.json` - New translation keys

## Non-Goals
- This change does NOT add support for other LLM providers (e.g., LM Studio, LocalAI)
- This change does NOT add model download/management for Ollama
- This change does NOT add OpenCode server mode (TUI/web) - only CLI integration
