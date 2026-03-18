# Design: Local K8s AI Model

## Architecture Overview

Same approach as k8sgpt: **rule-based analyzers extract structured errors before the LLM sees data**. Less context needed, fewer hallucinations.

```
┌──────────────────────────────────────────────────────────────────┐
│                         Kubeli App                                │
│                                                                   │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────┐ │
│  │ AI Chat  │   │ Settings │   │ Log View │   │ Event View   │ │
│  │ (React)  │   │ Model    │   │ "Analyze"│   │ "Explain"    │ │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘   └──────┬───────┘ │
│       │               │              │                 │         │
│  ┌────▼───────────────▼──────────────▼─────────────────▼───────┐ │
│  │                  Tauri Commands (Rust)                       │ │
│  │                                                              │ │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐ │ │
│  │  │ llmfit-  │ │ ollama-  │ │ K8s        │ │ Log          │ │ │
│  │  │ core     │ │ rs       │ │ Analyzers  │ │ Preprocessor │ │ │
│  │  │ (hw      │ │ (v0.3.4) │ │ (k8sgpt    │ │ (filter →    │ │ │
│  │  │  detect) │ │ (stream) │ │  pattern)  │ │  dedup →     │ │ │
│  │  │          │ │          │ │            │ │  chunk)      │ │ │
│  │  └──────────┘ └────┬─────┘ └────────────┘ └──────────────┘ │ │
│  │                     │                                        │ │
│  │  ┌──────────────────▼───────────────────────────────────┐   │ │
│  │  │              Data Sanitizer                          │   │ │
│  │  │  (strip secrets, emails, tokens, IPs before LLM)     │   │ │
│  │  └──────────────────┬───────────────────────────────────┘   │ │
│  └──────────────────────┼──────────────────────────────────────┘ │
└──────────────────────────┼──────────────────────────────────────┘
                           │ app.emit() event streaming (same as logs.rs)
                 ┌─────────▼─────────┐
                 │   Ollama Server   │
                 │  127.0.0.1:11434  │
                 │  (pinned ≥0.3.15) │
                 │                   │
                 │  ┌─────────────┐  │
                 │  │ qwen3:4b    │  │
                 │  │ Q4_K_M      │  │
                 │  └─────────────┘  │
                 └───────────────────┘
```

## Component Design

### 1. Hardware Detection (llmfit-core)

**Decision changed: llmfit-core as Rust crate dependency (not CLI).**

Research shows `llmfit-core` (v0.7.7, MIT, docs.rs verified) exposes a stable public API: `SystemSpecs::detect()`, `ModelDatabase`, `ModelFit`, `OllamaProvider`. Apple Silicon unified memory is handled correctly. Documentation coverage is only 31.68% so source reading is needed.

```toml
# src-tauri/Cargo.toml
[dependencies]
llmfit-core = "0.7.7"
```

Key APIs:
- `SystemSpecs::detect()` - CPU, RAM, GPU, VRAM, backend
- `ModelDatabase` - 497+ model registry with fit scoring
- `FitLevel::Perfect | Good | Marginal | TooTight`

Reserve 2-4 GB for OS + Kubeli when computing available memory on Apple Silicon.

Calibrate llmfit estimates (±20-30% accuracy) with a quick 50-token benchmark on first model setup.

### 2. Model Selection Strategy

Qwen3:4b scores highest in this size range (AI Index: 12, tool calling: 0.880, 95.64% log classification with RAG). Granite 3.1 MoE:3b uses only ~800M active params, so it runs 40-80% faster than dense 4B models.

| Priority | Model | Params | RAM (Q4_K_M) | Context | Why |
|----------|-------|--------|-------------|---------|-----|
| 1 | `qwen3:4b` | 4B | ~5.2GB | 32K | Best tool-calling + thinking mode, Apache 2.0 |
| 2 | `granite3.1-moe:3b` | 3B (800M active) | ~2.2GB | 128K | Fast fallback for ≤8GB RAM |
| 3 | `phi4-mini` | 3.8B | ~2.5GB | 128K | MIT license alternative, strong STEM |
| 4 | `qwen3:8b` | 8B | ~5GB | 32K | Quality pick for ≥16GB RAM |

Quantization guidance:
- **Q5_K_M** for structured tasks (JSON parsing, kubectl generation) - subtle errors matter
- **Q4_K_M** for interactive analysis where speed matters more
- Never go below Q4_K_M at ≤4B scale

### 3. K8s Analyzers (k8sgpt Pattern)

The idea: **detect issues programmatically, then let the LLM explain them.**

```
Raw K8s State ──► Rust Analyzers ──► Structured Errors ──► LLM Explains
                  (rule-based)       (compact, factual)    (human-readable)
```

Analyzer modules to build in `src-tauri/src/ai/analyzers/`:

| Analyzer | Detects |
|----------|---------|
| `pod_analyzer` | CrashLoopBackOff, ImagePullBackOff, OOMKilled, Pending, Evicted |
| `event_analyzer` | Warning events, FailedScheduling, FailedMount, Unhealthy |
| `service_analyzer` | No endpoints, selector mismatches |
| `ingress_analyzer` | Missing backend services, TLS issues |
| `hpa_analyzer` | ScaleUp/Down failures, metrics unavailable |
| `pdb_analyzer` | Disruption budget violations |
| `node_analyzer` | NotReady, DiskPressure, MemoryPressure |

Each analyzer outputs a structured error string. Only these strings go to the LLM, not raw K8s state. This is why k8sgpt works well even with small models.

### 4. Log preprocessor

A 4B model can handle roughly 46-76 log lines in its working window. Everything above that needs preprocessing.

```
Raw Logs (thousands of lines)
    │
    ▼
┌─────────────────────────┐
│ 1. FILTER               │  Regex: ERROR/WARN lines + ±3 context lines
│    (80-95% reduction)    │  Preserve: timestamps, pod names, error codes
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 2. DEDUPLICATE          │  Template mining (Drain3-style)
│    (75-95% further)     │  "OOMKilled in pod-xyz" × 47 → one line + count
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 3. SANITIZE             │  Strip: emails, IPs, JWTs (eyJ...), basic auth URLs,
│                         │  high-entropy strings (likely secrets)
│                         │  Replace with deterministic placeholders
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 4. CHUNK (if needed)    │  If > token budget: map-reduce
│                         │  Max 5 map iterations to bound latency
│                         │  Carry JSON state between chunks
└───────────┬─────────────┘
            ▼
    Processed Logs (~50-100 lines, clean, safe)
```

Build in Rust using `regex` (121K records/sec/CPU), `serde_json`, `rayon` for parallelism.

### 5. Context Budget (8K Effective Window)

Despite Qwen3:4b's 32K advertised window, research shows quality peaks at 8-16K. Budget for 8K effective:

| Component | Tokens | % |
|-----------|--------|---|
| System prompt | 500 | 6% |
| K8s analyzer output | 800 | 10% |
| Log content | 4,652 | 59% |
| Output reserve | 2,048 | 25% |

### 6. System Prompt (Under 500 Tokens)

Small models need short prompts, a fixed output format, and explicit grounding to avoid hallucinating resource names.

```
You are a Kubernetes troubleshooting assistant in Kubeli.

RULES:
- Only reference resources listed in CONTEXT below
- Reply "unknown" if unsure - never invent resource names
- Output JSON: {"error": "...", "cause": "...", "fix": "...", "commands": ["..."]}

COMMON PATTERNS:
- CrashLoopBackOff: check logs for exit code, OOM, config errors
- ImagePullBackOff: verify image name, registry auth, network
- Pending: check node resources, taints, PVC binding
- OOMKilled: compare memory limits vs actual usage

CONTEXT:
Cluster: {cluster_name} ({provider})
Namespace: {namespace}
Pods: {pod_names}
Recent warnings: {analyzer_output}

EXAMPLE:
User: Pod nginx-abc is CrashLoopBackOff
Assistant: {"error":"CrashLoopBackOff","cause":"Exit code 137 (OOMKilled). Container memory limit 128Mi, peak usage ~200Mi.","fix":"Increase memory limit to 256Mi","commands":["kubectl set resources deployment/nginx --limits=memory=256Mi -n default"]}
```

Use Qwen3's **non-thinking mode** for structured JSON output, **thinking mode** for root cause analysis.

Temperature: 0.6 + TopP 0.95 (thinking), 0.7 + TopP 0.8 (non-thinking).

### 7. Ollama Integration

Uses `ollama-rs = "0.3.4"` with `features = ["stream"]`.

All Ollama calls go through the Rust backend, not the frontend. This avoids CORS problems (Windows Tauri uses `http://tauri.localhost`, which Ollama does not whitelist) and lets us sanitize data before it reaches the model.

Streaming via `app.emit()` + `listen()` (same pattern as log streaming in `logs.rs`, NOT Channel API):

```rust
enum ChatEvent {
    Token(String),
    Done { total_tokens: u32, duration_ms: u64 },
    Error(String),
}
```

Lifecycle:
1. On app startup: try `GET http://127.0.0.1:11434/api/tags` (non-blocking)
2. If unavailable: try spawning `ollama serve` via `std::process::Command`
3. Health poll every 5s via `/api/tags`
4. Verify binding is 127.0.0.1 (not 0.0.0.0) - warn if exposed

**Security: pin minimum Ollama version ≥0.3.15** (all known CVEs patched).

### 8. Settings UI

```
┌─────────────────────────────────────────────────┐
│ Local AI Model                                   │
├─────────────────────────────────────────────────┤
│                                                 │
│ Hardware:                                       │
│   Apple M2 Pro · 12 cores · 16 GB · Metal       │
│                                                 │
│ Recommended: qwen3:4b (Q4_K_M)                  │
│   ~35 tok/s · 5.2 GB RAM · Fit: Perfect         │
│                                                 │
│ [Download & Setup]  [Change Model ▾]            │
│                                                 │
│ ████████████████░░░░ 78% (4.1 / 5.2 GB)         │
│                                                 │
│ Status: ● Ready                                  │
│                                                 │
│ Provider Priority:          [drag to reorder]    │
│   1. Local Model (qwen3:4b)                      │
│   2. Claude Code CLI                             │
│   3. OpenAI Codex CLI                            │
│                                                 │
│ ⚠ Your cluster data stays on this machine.       │
│   AI analysis runs locally, no cloud API needed. │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Integration with existing codebase

### Provider enum

The existing `AiCliProvider` enum (`Claude | Codex`) needs a `Local` variant. The name "Cli" no longer fits, so rename to `AiProvider`:

```rust
// src-tauri/src/ai/agent_manager.rs
pub enum AiProvider {
    Claude,  // Claude Code CLI
    Codex,   // OpenAI Codex CLI
    Local,   // Ollama local model
}
```

Update all references: `AiCliProvider` → `AiProvider` across Rust + TypeScript.

### Separate OllamaManager (SRP)

Do NOT add Ollama logic into the existing `AgentManager`. AgentManager spawns CLI child processes, reads JSONL stdout, handles stop flags. Ollama uses HTTP REST with streaming JSON. Different execution model, different error modes.

Instead, create `OllamaManager` following the same pattern as `LogStreamManager` and `ShellSessionManager`:

```rust
// src-tauri/src/ai/ollama_manager.rs
pub struct OllamaManager {
    client: ollama_rs::Ollama,
    active_sessions: RwLock<HashMap<String, OllamaSession>>,
}

struct OllamaSession {
    stop_flag: Arc<AtomicBool>,
    model: String,
}
```

Register in `src-tauri/src/app/state.rs`:
```rust
.manage(Arc::new(OllamaManager::new()))
```

### Routing: AgentManager vs OllamaManager

`ai_send_message` command checks the provider and delegates:

```rust
match provider {
    AiProvider::Claude | AiProvider::Codex => agent_manager.send(...),
    AiProvider::Local => ollama_manager.send(...),
}
```

Both emit the same `AIEvent` enum via `app.emit()`, so the frontend event handler (`useAIEvents.ts`) needs zero changes.

### Error handling

All new commands return `Result<T, KubeliError>`, not `Result<T, String>`.

Use the existing error kinds:
- `ErrorKind::Network` - Ollama not reachable
- `ErrorKind::NotFound` - model not installed
- `ErrorKind::ServerError` - Ollama returned error
- `ErrorKind::Timeout` - model generation timeout

Add suggestions:
```rust
KubeliError::new(ErrorKind::Network, "Ollama is not running")
    .with_suggestions(vec![
        "Start Ollama: ollama serve".into(),
        "Install: brew install ollama".into(),
    ])
```

### State registration

New state in `src-tauri/src/app/state.rs`:
```rust
.manage(Arc::new(OllamaManager::new()))
// llmfit-core does not need managed state - call SystemSpecs::detect() on demand
```

### Session store compatibility

The existing `session_store.rs` already stores provider per session. Just needs the new `Local` variant serialized. SQLite schema does not change.

### Frontend event reuse

`useAIEvents.ts` listens to `ai-session-{sessionId}` events. Since `OllamaManager` emits the same `AIEvent` tagged enum, the hook works as-is. Only `ProviderBadge.tsx` needs a third color.

### Context builder reuse

`context_builder.rs` generates a system prompt from live K8s state. For local models, we replace this with a shorter prompt (see Section 6) because 4B models need <500 tokens. The existing builder stays for Claude/Codex (they handle longer prompts fine). Add a `build_local_context()` function alongside the existing `build_context()`.

### Files that need renaming/refactoring

| File | Change |
|------|--------|
| `AiCliProvider` enum | Rename to `AiProvider`, add `Local` variant |
| TypeScript `AiCliProvider` type | Rename to `AiProvider`, add `"local"` |
| `AIConfigState.claude_cli_info` | Keep as-is, add `ollama_info: RwLock<Option<OllamaInfo>>` |
| `cli_detector.rs` | Add `detect_ollama()` function (check port 11434) |
| `commands.rs` | Add ollama-specific commands, update session commands for Local provider |
| `src/lib/tauri/commands/ai.ts` | Update types, add local AI command wrappers |

## Decisions

1. **Separate OllamaManager** (not in AgentManager) - different execution model, follows SRP
2. **Rename `AiCliProvider` to `AiProvider`** - "Cli" no longer accurate with local models
3. **Reuse `AIEvent` enum** - same events for all providers, frontend stays untouched
4. **`KubeliError` everywhere** - no `Result<T, String>`, use existing error kinds + suggestions
5. **llmfit-core as Rust crate** - stable API, no external binary needed
6. **ollama-rs** - MIT, 988 stars, handles streaming and model management
7. **Analyzers before LLM** (k8sgpt pattern) - rule-based detection feeds compact errors to model
8. **Log preprocessing** - filter → dedup → sanitize → chunk before anything hits the model
9. **Data sanitization** - secrets/emails/tokens stripped before LLM sees data
10. **Qwen3:4b default, Granite MoE fallback** - benchmarked, both Apache 2.0
11. **System prompt under 500 tokens** - quality drops fast with longer prompts at 4B scale
12. **Ollama ≥0.3.15** - older versions have known RCE vulnerabilities
13. **No fine-tuning for v1** - system prompt + context injection hits 95.64% on log classification

## Training Infrastructure

### Available Hardware

| Machine | Role | Specs | Use |
|---------|------|-------|-----|
| **MacBook Air M4** | Dev + Inference + Data Prep | M4 10-core, 32 GB unified, 1.1 TB free, Metal 3 | Dataset curation, eval runs, local inference testing |
| **Windows Desktop (RTX 3090)** | Training Server | RTX 3090 24 GB VRAM, CUDA | QLoRA fine-tuning via Unsloth, full training runs |

The RTX 3090 handles QLoRA on 4B-8B models comfortably (Unsloth needs ~12 GB VRAM for 4B QLoRA, 3090 has 24 GB). No cloud GPU needed for our model sizes.

### Remote Training Workflow

```
Mac (dev machine)                    Windows (RTX 3090)
─────────────────                    ──────────────────
1. Curate dataset locally
2. Push dataset to shared storage ──► 3. Pull dataset
                                      4. Run Unsloth training
                                      5. Export GGUF ──► 6. Pull GGUF, test locally

Options for remote access:
- SSH tunnel (WSL2 + openssh-server)
- Tailscale mesh VPN (zero-config)
- Shared NAS/NFS or synced folder
```

### Cloud GPU Fallback

If the RTX 3090 is unavailable or for larger models (8B+):

| Provider | GPU | Cost | Best For |
|----------|-----|------|----------|
| **Google Colab Pro** | T4/A100 | $10/mo | Quick experiments, notebook-based |
| **Vast.ai** | RTX 3090/4090 | ~$0.20-0.40/hr | Cheapest on-demand, community GPUs |
| **RunPod** | A100 40GB | ~$1.10/hr | Larger models, reliable |
| **Lambda Labs** | A100 80GB | ~$1.25/hr | Production training runs |

Estimated training cost per run: **$0 (local 3090)** or **$2-10 (cloud, 1-4 hours)**.

### Software Stack (Windows Training Machine)

```bash
# One-time setup on Windows (WSL2 or native)
pip install unsloth[cu121]   # CUDA 12.1 for RTX 3090
# OR use Docker:
docker run --gpus all -p 7860:7860 unsloth/unsloth

# Unsloth Studio (no-code UI)
pip install unsloth
unsloth studio    # opens web UI on localhost:7860
```

## Data Collection Pipeline

### Goal

Build a high-quality K8s troubleshooting dataset that makes our fine-tuned model stand out. Target: **50K+ instruction-response pairs** covering error diagnosis, kubectl commands, YAML debugging, and operational knowledge.

### Phase 1: GitHub Docs Harvesting

```
GitHub Repos (MD/MDX)
    │
    ▼
┌─────────────────────────┐
│ 1. CLONE & EXTRACT      │  git clone → find *.md *.mdx *.yaml
│    Strip frontmatter    │  Remove Hugo/Docusaurus metadata
│    Keep content + code  │  Preserve code blocks, tables, examples
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 2. CHUNK & STRUCTURE    │  Split by H2/H3 sections
│    ~500-2000 tokens     │  Keep code blocks intact
│    Tag with category    │  (troubleshooting, concept, howto, reference)
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 3. GENERATE PAIRS       │  Use Unsloth Data Recipes or Claude API
│    instruction → answer  │  "How do I fix CrashLoopBackOff?" → section content
│    error → diagnosis     │  K8s error message → explanation + fix
│    scenario → kubectl    │  "Scale deployment to 5" → kubectl command
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 4. QUALITY FILTER       │  Deduplicate (MinHash)
│    Remove low-quality    │  Filter too-short, too-generic
│    Validate kubectl      │  Syntax check generated commands
│    Balance categories    │  Ensure coverage across all K8s resources
└───────────┘
```

### Source Repos to Harvest

**Tier 1 - Core (must have):**

| Repo | Format | License | Est. Pairs | Content |
|------|--------|---------|-----------|---------|
| `kubernetes/website` | MD | CC-BY-4.0 | ~15K | Official K8s docs, troubleshooting, concepts |
| `k8sgpt-ai/k8sgpt` | Go + MD | Apache 2.0 | ~2K | Analyzer patterns, error→diagnosis mappings |
| HuggingFace `mcipriano/stackoverflow-kubernetes-questions` | JSON/CSV | CC-BY-SA-4.0 | ~30K | Real SO Q&A pairs, 32 MB |
| HuggingFace `ComponentSoft/k8s-kubectl-35k` | Dataset | Unspecified | ~35K | kubectl command examples |

**Tier 2 - Enrichment:**

| Repo | Format | License | Est. Pairs | Content |
|------|--------|---------|-----------|---------|
| `kubernauts/practical-kubernetes-problems` | MD + YAML | OSS | ~500 | Real-world troubleshooting scenarios |
| `iam-veeramalla/kubernetes-troubleshooting-zero-to-hero` | MD | OSS | ~300 | Error walkthroughs (ImagePull, CrashLoop, etc.) |
| `mhausenblas/troubleshooting-k8s-apps` | MD | OSS | ~200 | Debugging guides |
| `awsdocs/amazon-eks-user-guide` | MD | CC-BY-NC | ~3K | EKS-specific operational knowledge |
| HuggingFace `keethu/kubernetes-documentation-dataset` | Dataset | MIT | ~500 | Pre-processed K8s docs |

**Tier 3 - Synthetic Generation:**

| Source | Method | Est. Pairs | Content |
|--------|--------|-----------|---------|
| k8sgpt analyzer patterns | Template expansion | ~5K | Every error pattern × variations |
| Kubeli's own analyzers (v1) | Runtime collection | ~2K | Real errors from user clusters (opt-in) |
| YAML mutation | Introduce common errors → let model diagnose | ~3K | Broken YAML → fix pairs |

**Total estimated: ~90K+ pairs** (after dedup and filtering, target 50K high-quality)

### Harvesting Script

```bash
# .dev/training-data/harvest.sh

#!/bin/bash
set -euo pipefail

DATA_DIR=".dev/training-data/raw"
mkdir -p "$DATA_DIR"

# Tier 1: Official K8s docs
git clone --depth 1 https://github.com/kubernetes/website.git "$DATA_DIR/k8s-website"

# Tier 1: k8sgpt patterns
git clone --depth 1 https://github.com/k8sgpt-ai/k8sgpt.git "$DATA_DIR/k8sgpt"

# Tier 2: Troubleshooting repos
git clone --depth 1 https://github.com/kubernauts/practical-kubernetes-problems.git "$DATA_DIR/practical-k8s"
git clone --depth 1 https://github.com/iam-veeramalla/kubernetes-troubleshooting-zero-to-hero.git "$DATA_DIR/k8s-troubleshoot"

# Tier 1: HuggingFace datasets
pip install datasets
python3 -c "
from datasets import load_dataset
ds = load_dataset('mcipriano/stackoverflow-kubernetes-questions', split='train')
ds.to_json('$DATA_DIR/so-k8s-questions.jsonl')

ds2 = load_dataset('ComponentSoft/k8s-kubectl-35k', split='train')
ds2.to_json('$DATA_DIR/kubectl-35k.jsonl')
"

echo "Raw data collected in $DATA_DIR"
```

### Conversion Script (MD → Instruction Pairs)

```python
# .dev/training-data/convert_docs.py

"""
Convert K8s markdown docs to instruction-response pairs.
Output: JSONL compatible with Unsloth/Alpaca format.
"""

import json, re, pathlib

def extract_sections(md_text: str) -> list[dict]:
    """Split markdown by H2/H3 headings into chunks."""
    sections = []
    current = {"title": "", "content": ""}
    for line in md_text.split("\n"):
        if line.startswith("## ") or line.startswith("### "):
            if current["content"].strip():
                sections.append(current)
            current = {"title": line.lstrip("#").strip(), "content": ""}
        else:
            current["content"] += line + "\n"
    if current["content"].strip():
        sections.append(current)
    return sections

def section_to_pair(section: dict, source: str) -> dict | None:
    """Convert a doc section to an instruction-response pair."""
    content = section["content"].strip()
    if len(content) < 100:  # too short
        return None
    return {
        "instruction": f"Explain: {section['title']}",
        "input": "",
        "output": content,
        "source": source,
        "category": classify_section(section["title"]),
    }

def classify_section(title: str) -> str:
    title_lower = title.lower()
    if any(w in title_lower for w in ["debug", "troubleshoot", "error", "fix"]):
        return "troubleshooting"
    if any(w in title_lower for w in ["how to", "create", "configure", "setup"]):
        return "howto"
    if any(w in title_lower for w in ["what is", "concept", "overview", "architecture"]):
        return "concept"
    return "reference"

# Process all markdown files
docs_dir = pathlib.Path(".dev/training-data/raw/k8s-website/content/en/docs")
pairs = []
for md_file in docs_dir.rglob("*.md"):
    text = md_file.read_text(errors="ignore")
    # Strip Hugo frontmatter
    text = re.sub(r"^---\n.*?\n---\n", "", text, flags=re.DOTALL)
    for section in extract_sections(text):
        pair = section_to_pair(section, f"k8s-docs/{md_file.relative_to(docs_dir)}")
        if pair:
            pairs.append(pair)

# Write JSONL
output = pathlib.Path(".dev/training-data/processed/k8s-docs.jsonl")
output.parent.mkdir(parents=True, exist_ok=True)
with open(output, "w") as f:
    for p in pairs:
        f.write(json.dumps(p) + "\n")

print(f"Generated {len(pairs)} pairs from K8s docs")
```

### Unsloth Training Config

```python
# .dev/training-data/train.py
# Run on Windows RTX 3090 or cloud GPU

from unsloth import FastLanguageModel
import torch

# Load base model
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/Qwen3-4B",  # Unsloth optimized
    max_seq_length=8192,              # Match our 8K context budget
    dtype=None,                        # Auto-detect (bf16 on 3090)
    load_in_4bit=True,                # QLoRA
)

# Add LoRA adapters
model = FastLanguageModel.get_peft_model(
    model,
    r=16,                    # LoRA rank (16 is good balance)
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                    "gate_proj", "up_proj", "down_proj"],
    lora_alpha=16,
    lora_dropout=0,          # Unsloth optimized = 0
    bias="none",
    use_gradient_checkpointing="unsloth",  # 60% less VRAM
)

# Load our K8s dataset
from datasets import load_dataset
dataset = load_dataset("json", data_files=".dev/training-data/processed/*.jsonl", split="train")

# Train
from trl import SFTTrainer
from transformers import TrainingArguments

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=dataset,
    dataset_text_field="text",
    max_seq_length=8192,
    args=TrainingArguments(
        per_device_train_batch_size=4,    # 3090 24GB handles this
        gradient_accumulation_steps=4,
        warmup_steps=50,
        num_train_epochs=3,
        learning_rate=2e-4,
        fp16=not torch.cuda.is_bf16_supported(),
        bf16=torch.cuda.is_bf16_supported(),
        output_dir="outputs",
        logging_steps=10,
    ),
)
trainer.train()

# Export to GGUF for Ollama
model.save_pretrained_gguf(
    "kubeli-k8s-4b",
    tokenizer,
    quantization_method=["q4_k_m", "q5_k_m"],  # Both quants
)

# Create Ollama Modelfile
with open("kubeli-k8s-4b/Modelfile", "w") as f:
    f.write("""FROM ./kubeli-k8s-4b-Q4_K_M.gguf
PARAMETER temperature 0.7
PARAMETER top_p 0.8
PARAMETER num_ctx 8192
SYSTEM "You are a Kubernetes troubleshooting assistant. Only reference resources listed in CONTEXT. Reply 'unknown' if unsure. Output JSON: {error, cause, fix, commands}."
""")

print("Done! Run: ollama create kubeli-k8s:4b -f kubeli-k8s-4b/Modelfile")
```

### What Makes Our Model Stand Out

1. **K8s-native training data** - not generic coding, but real error→diagnosis→fix triples
2. **kubectl-grounded** - every suggested command is syntax-validated during training
3. **Analyzer-augmented** - model works WITH rule-based analyzers, not instead of them
4. **Privacy-first** - ships as GGUF via Ollama, zero cloud dependency
5. **Kubeli-integrated** - trained on the exact JSON output schema our UI expects
6. **Multilingual ops** - K8s docs available in 15 languages, can train on EN+DE at minimum

## v2 Roadmap (After v1 Ships)

### v2.0: Fine-Tuned K8s Model ("kubeli-k8s")

- **Dataset**: 50K+ pairs from GitHub docs, SO, k8sgpt patterns, synthetic generation
- **Base model**: Qwen3:4b (Apache 2.0)
- **Training**: QLoRA via Unsloth on RTX 3090 (local, zero cost)
- **Export**: GGUF Q4_K_M + Q5_K_M → Ollama Modelfile
- **Target**: 98%+ on K8s log classification (up from 95.64% with prompt engineering)
- **Distribution**: `ollama pull kubeli/k8s:4b` (publish to Ollama registry)

### v2.1: Continuous Improvement

- Opt-in telemetry: collect anonymized error→fix pairs from Kubeli users (with consent)
- Automated eval pipeline: run 500-example test set on every model version
- A/B test: prompt-only vs fine-tuned model in Kubeli, measure user satisfaction
- Contribute `UseCase::Kubernetes` to llmfit upstream

### v2.2: Advanced Features

- Optional RAG over K8s docs (embedded SQLite + cosine similarity)
- Consider bundling Ollama as Tauri sidecar (`externalBin`) for one-click install
- kubectl-ai-style action mode (generate + execute commands)
- Multi-model routing: fast model for simple queries, larger model for complex analysis
