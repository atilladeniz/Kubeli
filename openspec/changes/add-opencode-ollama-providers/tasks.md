# Tasks: Add OpenCode and Ollama AI Provider Support

## 1. Backend - CLI Detection

- [ ] 1.1 Add `OpenCode` and `Ollama` variants to `AiCliProvider` enum in `agent_manager.rs`
- [ ] 1.2 Implement `check_opencode_cli_available()` in `cli_detector.rs`
  - Check paths: `~/.local/bin/opencode`, `/opt/homebrew/bin/opencode`, npm global
  - Get version via `opencode --version`
  - Note: Package name is `opencode-ai` on npm
- [ ] 1.3 Implement `check_ollama_available()` in `cli_detector.rs`
  - Check for `ollama` binary in PATH (`/usr/local/bin/ollama`, Homebrew paths)
  - Check server status via HTTP GET `http://localhost:11434/` (returns "Ollama is running")
  - Fallback: GET `/api/version` for version info
  - Return server running status separately from binary installed
- [ ] 1.4 Add `list_ollama_models()` function in `cli_detector.rs`
  - HTTP GET `http://localhost:11434/api/tags`
  - Parse JSON: `{"models": [{"name": "...", "size": 123, "details": {...}}]}`
  - Return model names with human-readable sizes and parameter counts
- [ ] 1.5 Add `OllamaInfo` struct:
  ```rust
  pub struct OllamaInfo {
      pub binary_status: CliStatus,
      pub server_running: bool,
      pub version: Option<String>,
      pub cli_path: Option<String>,
      pub models: Vec<OllamaModel>,
      pub error_message: Option<String>,
  }

  pub struct OllamaModel {
      pub name: String,
      pub size: u64,           // bytes
      pub size_display: String, // "3.8 GB"
      pub parameter_size: Option<String>, // "4.3B"
  }
  ```

## 2. Backend - Session Handling

- [ ] 2.1 Add OpenCode message handler in `agent_manager.rs`
  - Spawn `opencode run --format json "prompt"` with system prompt prepended
  - Flags: `--model`, `--agent build` for full tool access
  - Parse JSONL streaming output
  - Handle tool execution events
- [ ] 2.2 Add Ollama session handling in `agent_manager.rs`
  - Create HTTP client with `reqwest`
  - Implement streaming POST to `http://localhost:11434/api/chat`
  - Request body: `{"model": "...", "messages": [...], "stream": true}`
  - Parse NDJSON: `{"message":{"content":"..."},"done":false}`
  - Detect `done:true` for completion
  - Handle errors: connection refused, model not found (404)
- [ ] 2.3 Store Ollama model name and conversation history in session struct
- [ ] 2.4 Add Ollama-specific system prompt as first message with `role: "system"`

## 3. Backend - Tauri Commands

- [ ] 3.1 Add `ai_check_opencode_cli_available` command in `commands.rs`
- [ ] 3.2 Add `ai_check_ollama_available` command returning `OllamaInfo`
- [ ] 3.3 Add `ai_list_ollama_models` command returning `Vec<OllamaModel>`
- [ ] 3.4 Update `ai_start_session` to accept optional `model` parameter for Ollama

## 4. Frontend - Type Definitions

- [ ] 4.1 Extend `AiCliProvider` type in `ui-store.ts`: `'claude' | 'codex' | 'opencode' | 'ollama'`
- [ ] 4.2 Add `OllamaInfo` and `OllamaModel` types in `commands.ts`
- [ ] 4.3 Add `ollamaModel: string | null` to settings in `ui-store.ts`
- [ ] 4.4 Add command bindings: `aiCheckOpencodeCliAvailable`, `aiCheckOllamaAvailable`, `aiListOllamaModels`

## 5. Frontend - Settings UI

- [ ] 5.1 Update `checkAiClis` to check all 4 providers in parallel
- [ ] 5.2 Add OpenCode status row (similar to Claude/Codex)
- [ ] 5.3 Add Ollama section with:
  - Binary installed status
  - Server running indicator (green dot / red dot)
  - Model dropdown (disabled when server not running)
  - "No models found" hint with `ollama pull llama3.2` suggestion
- [ ] 5.4 Update auto-select logic to consider all 4 providers
- [ ] 5.5 Add model refresh button for Ollama

## 6. Frontend - AI Store

- [ ] 6.1 Update `startSession` to pass `ollamaModel` when provider is `'ollama'`
- [ ] 6.2 Handle Ollama-specific error messages (server not running, model not found)

## 7. Internationalization

- [ ] 7.1 Add English translations in `en.json`:
  - `settings.ai.opencode.*`
  - `settings.ai.ollama.*`
  - `settings.ai.ollamaServerStatus`
  - `settings.ai.ollamaSelectModel`
  - `settings.ai.ollamaNoModels`
- [ ] 7.2 Add German translations in `de.json`

## 8. Testing

- [ ] 8.1 Add unit tests for OpenCode detection in `cli_detector.rs`
- [ ] 8.2 Add unit tests for Ollama detection and model listing
- [ ] 8.3 Add integration test for Ollama HTTP client
- [ ] 8.4 Manual testing: verify each provider works end-to-end

## 9. Documentation

- [ ] 9.1 Update CLAUDE.md with new provider options
- [ ] 9.2 Add installation instructions for OpenCode and Ollama

## 10. Robustness & Edge Cases

- [ ] 10.1 Add timeout handling for OpenCode CLI (known hang issue on exit)
  - Implement 5-second timeout after response complete
  - Force kill process if not terminated
  - Reference: [GitHub #3213](https://github.com/anomalyco/opencode/issues/3213)
- [ ] 10.2 Handle Ollama connection errors gracefully
  - Connection refused → "Server not running"
  - 404 → "Model not found"
  - Timeout → "Server not responding"
- [ ] 10.3 Add retry logic for Ollama server startup detection
  - Poll every 500ms for up to 5 seconds after "ollama serve" hint shown

## Dependencies

- Tasks 1.x must complete before 2.x (detection before session handling)
- Tasks 3.x must complete before 4.x (Rust commands before TS bindings)
- Tasks 4.x must complete before 5.x and 6.x (types before UI)
- Task 7.x can run in parallel with 5.x/6.x
- Task 10.x can run in parallel with 8.x
