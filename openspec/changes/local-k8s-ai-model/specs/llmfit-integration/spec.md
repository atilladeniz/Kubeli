# Spec: llmfit Integration

## Purpose

Use llmfit to detect hardware capabilities and score model compatibility, so Kubeli recommends models that will actually run well on the user's machine.

## Integration Approach

### Phase 1: CLI Sidecar
- Detect llmfit in PATH
- Call `llmfit recommend --json --limit 10` for recommendations
- Call `llmfit --json system` for hardware info
- Parse JSON output into Rust structs
- If llmfit not installed: use basic sysinfo detection + static model table

### Phase 2 (Future): Rust Crate
- Add `llmfit-core` as Cargo dependency
- Call hardware detection and scoring APIs directly
- No CLI dependency needed

## llmfit CLI Commands Used

```bash
# Hardware detection
llmfit --json system
# Returns: { cpu, cores, ram_gb, gpu_name, vram_gb, backend }

# Model recommendations
llmfit recommend --json --limit 10
# Returns: { models: [{ name, params, score, tps, fit, quant, mem_pct }] }

# Specific model check
llmfit info "qwen3:4b" --json
# Returns: detailed model info with fit analysis
```

## Fallback (no llmfit)

If llmfit is not installed:
1. Use `sysinfo` crate for CPU cores and RAM
2. On macOS: detect Apple Silicon via `sysctl`
3. Apply static rules:
   - RAM >= 16GB: recommend qwen3:4b
   - RAM >= 8GB: recommend qwen3:1.7b
   - RAM < 8GB: warn that local AI may be slow, suggest cloud providers

## Error Handling

- llmfit not in PATH: fallback to static rules, suggest `brew install llmfit`
- llmfit returns error: log error, use fallback
- No suitable model found: show warning in UI, suggest cloud providers
