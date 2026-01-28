## ADDED Requirements

### Requirement: OpenCode CLI Detection

The system SHALL detect OpenCode CLI installation and report its status to the user.

#### Scenario: OpenCode installed and functional
- **WHEN** OpenCode CLI is installed and accessible in PATH
- **THEN** the system reports status as "authenticated"
- **AND** displays the installed version
- **AND** shows the CLI path

#### Scenario: OpenCode not installed
- **WHEN** OpenCode CLI is not found in PATH or known locations
- **THEN** the system reports status as "not_installed"
- **AND** displays an appropriate message

---

### Requirement: Ollama Server Detection

The system SHALL detect Ollama binary installation and server running status independently.

#### Scenario: Ollama installed and server running
- **WHEN** Ollama binary is installed
- **AND** HTTP GET to `http://localhost:11434/` returns "Ollama is running"
- **THEN** the system reports binary status as "installed"
- **AND** reports server status as "running"
- **AND** retrieves models via GET `/api/tags`

#### Scenario: Ollama installed but server not running
- **WHEN** Ollama binary is installed
- **AND** HTTP GET to `http://localhost:11434/` fails (connection refused)
- **THEN** the system reports binary status as "installed"
- **AND** reports server status as "stopped"
- **AND** displays hint: "Run `ollama serve` to start the server"

#### Scenario: Ollama not installed
- **WHEN** Ollama binary is not found in PATH or known locations
- **THEN** the system reports binary status as "not_installed"
- **AND** displays installation link: https://ollama.com/download

---

### Requirement: Ollama Model Listing

The system SHALL list available Ollama models when the server is running.

#### Scenario: Models available
- **WHEN** Ollama server is running
- **AND** GET `/api/tags` returns models array
- **THEN** the system displays a dropdown with model names (e.g., "llama3.2:latest")
- **AND** shows model sizes in human-readable format (e.g., "3.8 GB")
- **AND** shows parameter count if available (e.g., "4.3B")

#### Scenario: No models installed
- **WHEN** Ollama server is running
- **AND** GET `/api/tags` returns empty models array
- **THEN** the system displays "No models found"
- **AND** shows hint: "Run `ollama pull llama3.2` to download a model"

---

### Requirement: Ollama Model Selection

The system SHALL allow users to select which Ollama model to use for AI sessions.

#### Scenario: Model selection persisted
- **WHEN** user selects an Ollama model from the dropdown
- **THEN** the selection is saved to settings
- **AND** persists across application restarts

#### Scenario: Selected model used for sessions
- **WHEN** user starts an AI session with Ollama provider
- **THEN** the system uses the selected model
- **AND** if no model selected, prompts user to select one

---

### Requirement: OpenCode Session Integration

The system SHALL support AI sessions using OpenCode CLI.

#### Scenario: Start OpenCode session
- **WHEN** user selects OpenCode as AI provider
- **AND** starts a new AI session
- **THEN** the system spawns `opencode run` with appropriate flags
- **AND** streams responses to the chat interface

#### Scenario: OpenCode streaming output
- **WHEN** OpenCode generates a response
- **THEN** the system parses JSONL output
- **AND** displays text content progressively
- **AND** shows tool execution status

---

### Requirement: Ollama Session Integration

The system SHALL support AI sessions using Ollama's HTTP API.

#### Scenario: Start Ollama session
- **WHEN** user selects Ollama as AI provider
- **AND** a model is selected
- **AND** Ollama server is running
- **THEN** the system establishes a chat session via HTTP API
- **AND** streams responses to the chat interface

#### Scenario: Ollama conversation history
- **WHEN** user sends multiple messages in a session
- **THEN** the system maintains conversation history
- **AND** sends all previous messages in the `messages` array with each request
- **AND** includes system prompt as first message with `role: "system"`

#### Scenario: Ollama server unavailable during session
- **WHEN** user attempts to send a message
- **AND** Ollama server is not responding (connection refused)
- **THEN** the system displays error: "Ollama server not available"
- **AND** suggests: "Check if Ollama is running with `ollama serve`"

#### Scenario: Ollama model not found
- **WHEN** the selected model is no longer available (404 response)
- **THEN** the system displays error: "Model 'xyz' not found"
- **AND** prompts user to select a different model or run `ollama pull xyz`

---

### Requirement: Provider Auto-Selection

The system SHALL automatically select an available AI provider when the preferred one is unavailable.

#### Scenario: Fallback to available provider
- **WHEN** user's preferred provider is not available
- **AND** at least one other provider is available
- **THEN** the system auto-selects the first available provider
- **AND** displays which provider is being used

#### Scenario: Provider priority order
- **WHEN** multiple providers are available
- **AND** no preference is set
- **THEN** the system selects in order: Claude > Codex > OpenCode > Ollama

---

### Requirement: Provider Status Display

The system SHALL display the status of all supported AI providers in the settings panel.

#### Scenario: All providers shown
- **WHEN** user opens AI Assistant settings
- **THEN** the system shows status for: Claude, Codex, OpenCode, Ollama
- **AND** each provider shows: installed/not installed, version (if available), path (if installed)

#### Scenario: Ollama extended status
- **WHEN** Ollama is installed
- **THEN** the system additionally shows:
  - Server status (running/stopped)
  - Number of available models
  - Currently selected model
