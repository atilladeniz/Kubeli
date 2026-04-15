# Spec: Model selection

## Purpose

Pick the best local Kubi-1 model for K8s troubleshooting based on the user's hardware.

## Requirements

### Hardware detection
- Detect CPU (cores, architecture), RAM (total, available), GPU/backend (Metal, CUDA, Vulkan, CPU)
- Use `llmfit-core` crate (`SystemSpecs::detect()`)
- Fallback to `sysinfo` crate for basic detection if llmfit fails
- Show hardware info in Settings UI

### Model recommendation
- Use the shipped Kubi-1 family as the primary recommendation set:
  - `kubi-1-nano` (Qwen3-1.7B)
  - `kubi-1` (Qwen3-4B)
  - `kubi-1-pro` (Qwen3-8B)
- Cross-reference llmfit fit scores with Kubeli's curated thresholds
- Pick the highest-priority model that scores `Perfect` or `Good`
- Always have a safe fallback:
  - `< 12 GB RAM` -> Nano
  - `< 24 GB RAM` -> Standard
  - `>= 24 GB RAM` -> Pro
- Expose experimental research candidates separately from the default shipped set:
  - Qwen3.5-4B
  - Qwen3-30B-A3B
  - Nemotron-3-Nano-4B

### Model criteria
- Strong tool calling / structured output performance
- "Thinking" mode or equivalent reasoning path for root-cause analysis
- Minimum 32K context window
- Must run via bundled `llama-server` using GGUF artifacts
- Desktop-friendly footprint

## Curated shipped model priority

1. `kubi-1` - Default quality/performance balance for most users
2. `kubi-1-nano` - Low-RAM fallback, faster startup and download
3. `kubi-1-pro` - Quality pick for higher-memory systems

## Experimental eval candidates

1. `qwen3.5-4b` - strongest future fine-tune candidate
2. `qwen3-30b-a3b` - MoE fallback candidate with good efficiency
3. `nemotron-3-nano-4b` - longer-context experimental candidate

## API

```typescript
interface HardwareInfo {
  cpu: string;
  cores: number;
  ram_gb: number;
  gpu: string | null;
  vram_gb: number | null;
  backend: "metal" | "cuda" | "vulkan" | "cpu" | "unknown";
}

interface ModelRecommendation {
  model_id: string;          // e.g. "kubi-1"
  model_name: string;        // e.g. "Kubi-1"
  size_gb: number;           // e.g. 2.5
  estimated_tps: number;     // calibrated with benchmark when available
  fit: "perfect" | "good" | "marginal";
  reason: string;
}
```
