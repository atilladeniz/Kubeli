# Spec: llmfit integration

## Purpose

Detect hardware and score model compatibility so Kubeli picks a local model that actually runs well.

## Integration approach

Use `llmfit-core` as a Rust crate dependency.

```toml
[dependencies]
llmfit-core = "0.7"
```

### APIs used

- `SystemSpecs::detect()` - CPU, RAM, GPU, VRAM, backend detection
- `ModelDatabase` - hardware fit database
- `ModelFit` / `FitLevel` - per-model scoring (`Perfect`, `Good`, `Marginal`, `TooTight`)

Kubeli maps llmfit results onto its own shipped Kubi-1 registry instead of directly relying on an external Ollama model list.

### Apple Silicon handling

llmfit detects unified memory via `system_profiler` and treats system RAM as available accelerator memory on Metal. Kubeli subtracts 2-4 GB for macOS and app overhead before recommending a model.

### Accuracy

llmfit throughput estimates are only directional. On first successful setup, Kubeli runs a short benchmark against the downloaded model and stores the measured tok/s for UI display.

## Fallback (if llmfit detection fails)

1. Use `sysinfo` for CPU cores and RAM
2. On macOS, detect Apple Silicon via `sysctl`
3. Apply static recommendation rules:
   - RAM `< 12 GB` -> `kubi-1-nano`
   - RAM `< 24 GB` -> `kubi-1`
   - RAM `>= 24 GB` -> `kubi-1-pro`
4. If even Nano is too tight, warn that local AI may be slow and suggest cloud providers

## Error handling

- llmfit panics or returns error: catch, log, use fallback rules
- No model fits comfortably: show warning in UI, allow Nano/manual override, and suggest Claude/Codex
- Apple Silicon memory misdetected: allow user override in advanced settings
