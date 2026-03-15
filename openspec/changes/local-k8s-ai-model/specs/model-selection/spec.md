# Spec: Model selection

## Purpose

Pick the best local LLM for K8s log analysis based on the user's hardware.

## Requirements

### Hardware detection
- Detect CPU (cores, architecture), RAM (total, available), GPU (vendor, VRAM)
- Use `llmfit-core` crate (`SystemSpecs::detect()`)
- Fallback: `sysinfo` crate for basic detection if llmfit fails
- Show hardware info in Settings UI

### Model recommendation
- Curated list of K8s-suitable models, ranked by priority
- Cross-reference llmfit fit scores with curated list
- Pick highest-priority model that scores `Perfect` or `Good`
- Always have a fallback (granite3.1-moe:3b runs on 8GB RAM)

### Model criteria
- Tool calling support (for structured K8s queries)
- "Thinking" mode (for reasoning about logs)
- Minimum 32K context window
- Available on Ollama
- Under 8B parameters (desktop hardware)

## Curated model priority

1. qwen3:4b - Highest benchmark scores at this size, dual think/no-think mode
2. granite3.1-moe:3b - Only 800M active params, runs on low-RAM systems, 128K context
3. phi4-mini - MIT license, 128K context, strong at STEM/reasoning
4. qwen3:8b - Best quality if the hardware allows it

## API

```typescript
interface HardwareInfo {
  cpu: string;
  cores: number;
  ram_gb: number;
  gpu: string | null;
  vram_gb: number | null;
}

interface ModelRecommendation {
  model: string;           // e.g. "qwen3:4b"
  params_b: number;        // e.g. 4
  estimated_ram_gb: number; // e.g. 5.2
  estimated_tps: number;   // e.g. 25 (±20-30%, calibrate with benchmark)
  fit: "perfect" | "good" | "marginal";
  reason: string;          // e.g. "Fits 16GB Apple Silicon with 10GB headroom"
}
```
