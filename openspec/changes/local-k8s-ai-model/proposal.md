# Proposal: Local K8s AI model with hardware-aware auto-setup

## Problem

Kubeli has AI integration via Claude Code CLI and OpenAI Codex CLI, but both require:
- An active internet connection
- A paid API subscription
- Sending cluster data to external services

Users behind corporate firewalls, with privacy requirements, or without API subscriptions have no AI assistance at all.

## Solution

Ship a local AI capability that:
1. Uses `llmfit-core` to detect the user's hardware and recommend the best-fitting Kubi-1 model
2. Auto-downloads the selected GGUF and runs it through a bundled `llama-server` sidecar
3. Focuses on Kubernetes log analysis and troubleshooting
4. Runs entirely offline after initial setup, with optional external Ollama fallback for power users

## Scope

### In Scope
- `llmfit-core` integration for hardware detection and model recommendation
- Built-in local model auto-setup: registry lookup, download, checksum verification, sidecar lifecycle
- K8s-specialized system prompt with context injection, analyzer findings, log preprocessing, and sanitization
- Model selection UI in Settings with hardware info, download progress, updates, and provider priority
- Fallback chain: local model -> Claude CLI -> OpenAI Codex CLI (user-configurable order)
- Optional advanced mode: use external Ollama host instead of the built-in engine

### Phase 2 (v2, after v1 ships)
- Fine-tune the Kubi-1 family on 50K+ K8s pairs via Unsloth QLoRA and CPT on the RTX 3090
- Evaluate Qwen3.5-4B, Qwen3-30B-A3B, and Nemotron-3-Nano-4B as future model upgrades
- Publish GGUFs to HuggingFace and GitHub Releases, with optional Ollama registry packaging for compatibility users
- Monthly retrain on updated docs and evaluation set

### Out of Scope
- In-process Rust inference via candle/kalosm for v1
- Experimental inference frameworks such as BitNet

## Why Now

- `llama.cpp` / `llama-server` is mature, cross-platform, and easy to bundle as a Tauri sidecar
- `llmfit-core` can be called directly from Rust with no extra binary dependency
- Small models in the 1.7B-8B range are now good enough for specialized K8s troubleshooting
- Kubeli already has the AI UI and event-streaming infrastructure to integrate a local provider cleanly

## Success Criteria

- User can get K8s log analysis without internet or API keys
- Model is auto-selected based on actual hardware, not guesswork
- First-time setup takes under 5 minutes from Settings
- Response latency is under 3 seconds for typical log analysis queries on Apple Silicon M1+ and similar desktop-class hardware
