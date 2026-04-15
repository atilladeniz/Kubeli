# Kubi-1: Training a K8s Specialist, Not a Generalist

> Kubi-1 knows everything about Pods, Services, Networking, RBAC, Helm, and debugging.
> It does not know who the US president is. It does not know Elon Musk.
> A specialist, not a generalist.

---

## The Problem with Standard Fine-Tuning

Standard QLoRA SFT (our current plan) adds K8s knowledge on top of a general model. The base Qwen3-4B still knows about politics, celebrities, recipes, and everything else. Users ask "Who is Elon Musk?" and the model answers — breaking the specialist identity.

To build a true K8s specialist, we need a **three-phase training pipeline**:

```
Phase 1: Continued Pretraining (CPT)
  → Shift the model's knowledge distribution toward K8s
  → Feed it raw K8s docs, code, configs as plain text
  → The model "forgets" some general knowledge, "learns" K8s deeply

Phase 2: Supervised Fine-Tuning (SFT)
  → Teach it to answer K8s questions in our JSON format
  → Standard instruction-response pairs (our current 50K+ dataset)

Phase 3: Refusal Training
  → Teach it to decline non-K8s questions politely
  → "I'm Kubi-1, a Kubernetes specialist. I can help with..."
  → Mixed into the SFT dataset as ~10-15% of examples
```

## Phase 1: Continued Pretraining (CPT)

Unsloth supports continued pretraining with QLoRA. The key insight from their research:

- Train `lm_head` and `embed_tokens` (not just attention layers)
- Use a **smaller learning rate** for embeddings (2-10x smaller)
- Use **rsLoRA** for rank-stabilized training at higher ranks
- Use rank 128-256 (higher than SFT, because we're shifting the distribution)

### CPT Data: Raw K8s Text Corpus

Not instruction pairs — just raw text. The model reads K8s docs like a textbook.

| Source | Format | Est. Tokens | Notes |
|--------|--------|-------------|-------|
| kubernetes/website (EN docs) | Raw markdown | ~15M | Official docs, concepts, tasks, tutorials |
| kubernetes/website (DE docs) | Raw markdown | ~5M | German K8s docs for multilingual |
| k8sgpt analyzer code | Go source | ~1M | Error detection patterns |
| kubectl source + docs | Go + markdown | ~3M | Command behavior details |
| K8s YAML manifests | YAML | ~2M | Real configs from examples repo |
| StackOverflow K8s answers | Plain text | ~10M | Real practitioner knowledge |
| Helm docs | Markdown | ~2M | Chart management |
| Istio/Envoy basics | Markdown | ~2M | Service mesh fundamentals |
| **Total** | | **~40M tokens** | |

40M tokens is enough to meaningfully shift a 4B model's distribution. Unsloth's blog shows this works even with QLoRA.

### CPT Config

```python
from unsloth import FastLanguageModel, UnslothTrainer, UnslothTrainingArguments

# Load BASE model (not instruct!) for continued pretraining
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/Qwen3-4B-Base",  # BASE, not Instruct
    max_seq_length=4096,  # Shorter for CPT (raw text chunks)
    load_in_4bit=True,
)

# Higher rank for CPT + train embeddings
model = FastLanguageModel.get_peft_model(
    model,
    r=128,  # Higher rank for distribution shift
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
        "lm_head", "embed_tokens",  # Critical for CPT
    ],
    lora_alpha=32,
    use_rslora=True,  # Rank-stabilized LoRA
    lora_dropout=0,
    use_gradient_checkpointing="unsloth",
)

trainer = UnslothTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=cpt_dataset,  # Raw K8s text, chunked to 4096 tokens
    args=UnslothTrainingArguments(
        per_device_train_batch_size=4,
        gradient_accumulation_steps=8,
        num_train_epochs=1,  # 1 epoch over 40M tokens
        learning_rate=5e-5,
        embedding_learning_rate=5e-6,  # 10x smaller for embeddings
        bf16=True,
        output_dir="checkpoints-cpt",
        save_strategy="steps",
        save_steps=500,
    ),
)
trainer.train()

# Save CPT adapter — this becomes the base for SFT
model.save_pretrained("kubi1-cpt-adapter")
```

### CPT Data Preparation

```python
# .dev/kubi-1/data/prepare_cpt_corpus.py
"""
Prepare raw text corpus for continued pretraining.
No instruction format — just chunked plain text.
"""

def prepare_cpt_data(raw_dir, output_path, chunk_size=4096):
    """Concatenate all K8s docs into token-sized chunks."""
    all_text = []

    # Markdown docs
    for md_file in raw_dir.rglob("*.md"):
        text = md_file.read_text(errors="ignore")
        text = strip_frontmatter(text)
        if len(text) > 100:
            all_text.append(text)

    # YAML manifests (the model should understand YAML deeply)
    for yaml_file in raw_dir.rglob("*.yaml"):
        text = yaml_file.read_text(errors="ignore")
        if len(text) > 50:
            all_text.append(text)

    # Go analyzer code (understand error patterns)
    for go_file in raw_dir.rglob("*.go"):
        if "_test.go" not in str(go_file):
            text = go_file.read_text(errors="ignore")
            if len(text) > 100:
                all_text.append(text)

    # Chunk into training examples
    full_text = "\n\n".join(all_text)
    # Approximate: 1 token ≈ 4 chars
    char_chunk = chunk_size * 4
    chunks = [full_text[i:i+char_chunk] for i in range(0, len(full_text), char_chunk)]

    # Save as JSONL
    with open(output_path, "w") as f:
        for chunk in chunks:
            f.write(json.dumps({"text": chunk}) + "\n")

    print(f"CPT corpus: {len(chunks)} chunks, ~{len(full_text)//4} tokens")
```

## Phase 2: Supervised Fine-Tuning (SFT)

Same as our current plan, but starting from the CPT adapter instead of the raw base model.

```python
# Load the CPT adapter as starting point
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="kubi1-cpt-adapter",  # Our CPT result, not raw Qwen3
    max_seq_length=8192,
    load_in_4bit=True,
)

# Lower rank for SFT (we're refining, not shifting)
model = FastLanguageModel.get_peft_model(
    model,
    r=16,  # Standard rank for SFT
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                    "gate_proj", "up_proj", "down_proj"],
    lora_alpha=16,
    lora_dropout=0,
    use_gradient_checkpointing="unsloth",
)

# Train on instruction pairs (50K+ K8s Q&A)
```

## Phase 3: Refusal Training

Mixed into the SFT dataset. ~10-15% of training examples teach the model to decline non-K8s topics.

### Refusal Examples (generated, ~5K pairs)

```json
{"instruction": "Who is the president of the United States?",
 "output": "I'm Kubi-1, a Kubernetes specialist. I can help with pods, services, deployments, networking, RBAC, Helm, and cluster debugging. What K8s question do you have?"}

{"instruction": "Write me a poem about love",
 "output": "I'm Kubi-1 and I focus on Kubernetes. I can help you troubleshoot pods, analyze logs, debug networking issues, or explain K8s concepts. What cluster issue are you working on?"}

{"instruction": "What's the weather in Berlin?",
 "output": "I'm Kubi-1 — I work with Kubernetes clusters, not weather data. I can help with pod scheduling, service discovery, ingress configuration, or any other K8s topic."}

{"instruction": "Tell me about Elon Musk",
 "output": "That's outside my scope. I'm Kubi-1, built for Kubernetes troubleshooting. Ask me about CrashLoopBackOff, OOMKilled, image pull errors, RBAC, Helm charts, or anything else in your cluster."}

{"instruction": "Can you help me write Python code?",
 "output": "I can help with Python only when it's K8s-related — like writing Kubernetes client scripts, parsing kubectl output, or creating Helm chart templates. What's the K8s use case?"}
```

### Generating Refusal Data

```python
# .dev/kubi-1/data/generate_refusals.py
"""Generate refusal training examples for non-K8s topics."""

import json, random

NON_K8S_TOPICS = [
    # People & Politics
    "Who is the president of {country}?",
    "Tell me about {celebrity}",
    "What did {politician} say about {topic}?",
    # General knowledge
    "What's the capital of {country}?",
    "How far is the moon from Earth?",
    "What year did World War 2 end?",
    # Cooking & lifestyle
    "How do I make {food}?",
    "What's a good recipe for {dish}?",
    "Recommend a good {genre} movie",
    # Code (non-K8s)
    "Write a {language} function that {task}",
    "How do I sort a list in {language}?",
    "Explain {algorithm} to me",
    # Misc
    "Write me a {type} about {subject}",
    "What's the weather in {city}?",
    "Translate '{phrase}' to {language}",
]

REFUSAL_TEMPLATES = [
    "I'm Kubi-1, a Kubernetes specialist. I can help with pods, services, deployments, networking, RBAC, Helm, and cluster troubleshooting. What K8s question do you have?",
    "That's outside my scope. I'm built for Kubernetes — ask me about cluster issues, debugging, deployments, or K8s configuration.",
    "I focus on Kubernetes. I can help you troubleshoot pods, analyze logs, debug networking, or explain K8s concepts. What cluster issue are you working on?",
    "I'm Kubi-1 — I work with Kubernetes clusters. I can help with CrashLoopBackOff, OOMKilled, image pull errors, RBAC, Helm charts, or anything else in your cluster.",
]

# K8s-adjacent (partial refusal — help if K8s-related)
K8S_ADJACENT = [
    {"q": "Can you help me write Python code?",
     "a": "I can help with Python when it's K8s-related — like writing Kubernetes client scripts, parsing kubectl output, or creating Helm chart templates. What's the K8s use case?"},
    {"q": "How do I use Docker?",
     "a": "I can help with Docker in the context of Kubernetes — building container images for pods, debugging image pull issues, or setting up a local registry. What are you deploying to K8s?"},
    {"q": "Explain YAML syntax",
     "a": "I know YAML in the context of Kubernetes manifests. I can help with pod specs, service definitions, deployments, configmaps, and other K8s resource YAML. What do you need?"},
]
```

## Three Model Sizes

| Name | Base Model | Params | RAM (Q4) | Target Hardware | Use Case |
|------|-----------|--------|----------|----------------|----------|
| **Kubi-1 Nano** | Qwen3-1.7B | 1.7B | ~1.2GB | Any laptop, 8GB RAM | Quick answers, simple diagnostics |
| **Kubi-1** | Qwen3-4B | 4B | ~2.5GB | Standard desktop, 16GB | Full troubleshooting, JSON output |
| **Kubi-1 Pro** | Qwen3-8B | 8B | ~5GB | Desktop with GPU, 32GB+ | Deep root cause analysis, thinking mode |

All three go through the same pipeline: CPT → SFT → Refusal Training. Same dataset, different base models.

Hardware detection (llmfit-core) picks the right size:
- `ram < 12GB` → Kubi-1 Nano
- `ram < 24GB` → Kubi-1
- `ram >= 24GB` → Kubi-1 Pro

## Training Pipeline (Complete)

```
Step 1: Data Collection
├── clone_repos.sh --all          # K8s GitHub repos
├── load_hf_datasets.py --all     # 15 HuggingFace datasets
└── harvest_k8s.py                # GitHub API for smaller repos

Step 2: Continued Pretraining Corpus
├── prepare_cpt_corpus.py         # Raw text chunks (40M tokens)
└── Output: data/final/cpt_corpus.jsonl

Step 3: Instruction Dataset
├── convert_docs.py               # MD/Go/HF → instruction pairs
├── generate_refusals.py          # ~5K refusal examples   ← NEW
├── generate_synthetic.py         # YAML mutation pairs
├── merge_and_filter.py           # Dedup, filter, balance
└── Output: data/final/kubeli-k8s-train.jsonl (~55K pairs)
                                   ↳ ~10% are refusal examples

Step 4: Training (on 2x RTX 3060, multi-GPU)
├── train_cpt.py                  # Phase 1: Continued Pretraining  ← NEW
├── train_sft.py                  # Phase 2: SFT on instruction pairs
└── train_kubi1.py                # Combined script (CPT → SFT)

Step 5: Export
├── Export GGUF (Q4_K_M, Q5_K_M)
├── Create Ollama Modelfile
└── Test against eval set

Step 6: Repeat for each size
├── Qwen3-1.7B-Base → Kubi-1 Nano
├── Qwen3-4B-Base → Kubi-1
└── Qwen3-8B-Base → Kubi-1 Pro
```

## What Makes This a True Specialist

| Aspect | Generic Fine-Tune | Kubi-1 Specialist |
|--------|-------------------|-------------------|
| General knowledge | Fully preserved | Partially overwritten by CPT |
| Non-K8s questions | Answers everything | Politely declines |
| K8s depth | Added on top | Deep — CPT + SFT combined |
| Model identity | "I'm an AI assistant" | "I'm Kubi-1, a K8s specialist" |
| Token budget | Wasted on general vocab | Focused on K8s terminology |
| Response style | Variable | Consistent JSON format for diagnostics |

## Privacy: Data Sanitization

Before any logs or events reach the model, the Rust sanitizer strips:
- Secrets and tokens (JWT `eyJ...`, bearer tokens)
- Email addresses
- IP addresses (replaced with deterministic placeholders)
- Connection strings and database URLs
- High-entropy strings (likely passwords)
- Environment variable values from pod specs

This runs in Rust before the data leaves the Tauri backend. The LLM never sees raw sensitive data.

## Sources

| # | Source | URL |
|---|--------|-----|
| 1 | Unsloth Continued Pretraining Blog | https://unsloth.ai/blog/contpretraining |
| 2 | Unsloth CPT Docs | https://docs.unsloth.ai/basics/continued-pretraining |
| 3 | LoRA Learns Less and Forgets Less | https://arxiv.org/abs/2405.09673 |
| 4 | rsLoRA Paper | https://arxiv.org/abs/2312.03732 |
