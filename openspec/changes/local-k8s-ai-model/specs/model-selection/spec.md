# Spec: Model Selection

## Purpose

Automatically recommend and configure the best local LLM for K8s analysis based on the user's hardware.

## Requirements

### Hardware Detection
- Detect CPU (cores, architecture), RAM (total, available), GPU (vendor, VRAM)
- Use llmfit CLI if available, fallback to sysinfo crate for basic detection
- Display hardware info in Settings UI

### Model Recommendation
- Maintain curated list of K8s-suitable models with priority ranking
- Cross-reference llmfit fit scores with curated list
- Recommend highest-priority model that fits user's hardware
- Always have a fallback (qwen3:1.7b fits on 8GB RAM systems)

### Model Criteria
- Must support tool calling (for structured K8s queries)
- Must have "thinking" mode (for reasoning about logs)
- Minimum 32K context window (for log analysis)
- Available on Ollama (no manual download)
- Under 8B parameters (desktop hardware constraint)

## Curated Model Priority

1. qwen3:4b - Best balance of quality, speed, and tool support
2. qwen3:1.7b - Minimum viable for low-RAM systems
3. phi4-mini - Alternative with 128K context for long logs
4. granite4:3b - Enterprise-oriented alternative
5. qwen3:8b - Quality pick for high-RAM systems

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
  estimated_ram_gb: number; // e.g. 3.2
  estimated_tps: number;   // e.g. 25
  fit: "perfect" | "good" | "marginal";
  reason: string;          // e.g. "Best fit for 16GB Apple Silicon"
}
```
