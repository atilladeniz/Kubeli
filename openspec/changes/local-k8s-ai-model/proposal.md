# Proposal: Local K8s AI Model with Hardware-Aware Auto-Setup

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
3. Specializes in Kubernetes log analysis, troubleshooting, and resource understanding
4. Runs entirely offline after initial setup

## Scope

### In Scope
- llmfit integration for hardware detection and model recommendation
- Ollama auto-setup: detect, install prompt, pull recommended model
- K8s-specialized system prompt with context injection (logs, events, resource state)
- Model selection UI in Settings with hardware info and recommendations
- Fallback chain: local model -> Claude CLI -> OpenAI CLI (user-configurable order)

### Out of Scope
- Fine-tuning a custom K8s model (future phase)
- Embedding inference directly in Tauri (Kalosm/candle - future phase)
- Training data collection or model training pipeline
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
