# Spec: llmfit integration

## Purpose

Detect hardware and score model compatibility so Kubeli picks a model that actually runs well.

## Integration approach

Use `llmfit-core` (v0.7.3, MIT, crates.io) as a Rust crate dependency.

```toml
[dependencies]
llmfit-core = "0.7"
```

### APIs used

- `SystemSpecs::detect()` - CPU, RAM, GPU, VRAM, backend detection
- `ModelDatabase` - 497+ model registry
- `ModelFit` / `FitLevel` - per-model scoring (Perfect, Good, Marginal, TooTight)
- `OllamaProvider` - checks which models are already installed

### Apple Silicon handling

llmfit detects unified memory via `system_profiler` and treats full system RAM as VRAM (Metal backend). We need to subtract 2-4 GB for OS + Kubeli before scoring.

### Accuracy

llmfit tok/s estimates are ±20-30% off from real Ollama performance. On first model setup, run a 50-token benchmark to calibrate the displayed estimate.

## Fallback (if llmfit detection fails)

1. Use `sysinfo` crate for CPU cores and RAM
2. On macOS: detect Apple Silicon via `sysctl`
3. Static rules:
   - RAM >= 16GB: recommend qwen3:4b
   - RAM >= 8GB: recommend granite3.1-moe:3b
   - RAM < 8GB: warn that local AI will be slow, suggest cloud providers

## Error handling

- llmfit panics or returns error: catch, log, use fallback rules
- No model fits: show warning in UI, suggest Claude CLI or OpenAI CLI
- Apple Silicon VRAM misdetected: let user override via Settings
