# Proposal: Local K8s AI model with hardware-aware auto-setup

## Problem

Kubeli has AI integration via Claude Code CLI and OpenAI Codex CLI, but both require:
- An active internet connection
- A paid API subscription
- Sending cluster data to external services

Users behind corporate firewalls, with privacy requirements, or without API subscriptions have no AI assistance at all.

## Solution

Ship a local AI capability that:
1. Uses **llmfit** to detect the user's hardware and recommend the best-fitting model
2. Auto-downloads and configures the optimal model via **Ollama**
3. Focuses on Kubernetes log analysis and troubleshooting
4. Runs entirely offline after initial setup

## Scope

### In Scope
- llmfit integration for hardware detection and model recommendation
- Ollama auto-setup: detect, install prompt, pull recommended model
- K8s-specialized system prompt with context injection (logs, events, resource state)
- Model selection UI in Settings with hardware info and recommendations
- Fallback chain: local model -> Claude CLI -> OpenAI CLI (user-configurable order)

### Phase 2 (v2, after v1 ships)
- Fine-tune "kubeli-k8s:4b" on 50K+ K8s pairs via Unsloth QLoRA (RTX 3090 available)
- Data pipeline: harvest GitHub K8s docs (MDX/MD), SO questions, k8sgpt patterns
- Publish to Ollama registry as `kubeli/k8s:4b`
- Monthly retrain on updated docs

### Out of Scope
- Embedding inference directly in Tauri (Kalosm/candle - future phase)
- BitNet or other experimental inference frameworks

## Why Now

- Ollama is mature and stable (OpenAI-compatible REST API)
- llmfit is a Rust crate that can be called from Tauri directly or via CLI
- Small models (Qwen3 4B, Phi-3 3.8B) are now good enough for specialized tasks
- Kubeli already has the AI UI infrastructure (ai/ feature, agent_manager.rs)

## Success Criteria

- User can get K8s log analysis without internet or API keys
- Model auto-selected based on actual hardware (not guesswork)
- Setup takes < 5 minutes (one-click in Settings)
- Response latency < 3s for typical log analysis queries on Apple Silicon M1+
