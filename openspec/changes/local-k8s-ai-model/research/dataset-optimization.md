# Dataset Optimization — Maximizing Kubi-1 Training Quality

> **Research Brief — April 4, 2026**
> Key insight: 40M CPT tokens is critically insufficient. Quality filtering > raw quantity.
> 10K expert-curated > 100K unfiltered (AlpaGasus, LIMA, DEITA papers confirm).

---

## Critical Finding: CPT Corpus Must Grow 5-10x

40M tokens = 0.01 tokens/param. Successful domain CPT projects use 0.43-4.3 tokens/param.
Target: **200M-500M effective tokens** via:
1. New datasets (~70M raw tokens)
2. Multi-epoch training (5-10 epochs = 200-400M effective exposure)
3. Synthetic expansion (EntiGraph-style: 100-350x multiplication validated at ICLR 2025)

LoRA CPT absorbs less domain knowledge per token than full fine-tuning (arXiv:2405.09673).
More tokens partially compensate for this QLoRA limitation.

---

## Missing Datasets (Top Priority)

### HuggingFace — Add Immediately

| Dataset | Size | Role | Priority |
|---------|------|------|----------|
| `substratusai/the-stack-yaml-k8s` | 277K YAML files (~40M+ tokens) | CPT corpus | ★★★★★ |
| `ibm-research/ITBench-Trajectories` | 105 agent trajectories | SFT troubleshooting | ★★★★★ |
| `ibm-research/ITBench-Lite` | 50 SRE+FinOps scenarios | Eval + SFT | ★★★★★ |
| `MCP-1st-Birthday/smoltrace-kubernetes-tasks` | K8s agent tasks | SFT tool-calling | ★★★★★ |
| `saidsef/tech-docs` | 251 K8s + 60 ArgoCD + 33 Istio docs | CPT corpus | ★★★★ |
| `HuggingFaceTB/stackexchange_2025_md` | Full 2025 dump | CPT (filter k8s tags) | ★★★★ |
| `Salesforce/xlam-function-calling-60k` | 60K function-calling | SFT format reference | ★★★ |
| `NousResearch/hermes-function-calling-v1` | Multi-config | SFT tool-calling | ★★★ |
| `Jofthomas/hermes-function-calling-thinking-V1` | 3.57K rows | SFT thinking+tools | ★★★ |

### GitHub Repos — Harvest

| Repo | Est. Tokens | Priority |
|------|-------------|----------|
| `kubernetes/enhancements` (KEPs) | ~10M | ★★★★★ |
| `bitnami/charts` (Helm values.yaml) | ~20M+ | ★★★★★ |
| `kubernetes/kubernetes` (events/API) | ~5-10M | ★★★★★ |
| CKA/CKAD exercise repos (4+) | ~650K | ★★★★★ |
| `IBM/ITBench` + `ITBench-Scenarios` | ~3M+ | ★★★★ |
| `learnk8s` organization | ~500K-1M | ★★★★ |
| `kubernetes-sigs/kwok` (docs) | ~2M | ★★★★ |

### Simulation Tools

- **KWOK** (K8s WithOut Kubelet): Simulate 1000s of nodes/pods, capture kubectl outputs
- **ITBench**: Reproducible fault-injection with ground-truth diagnoses (94 scenarios)

---

## Quality Pipeline Upgrades

### 1. Semantic Dedup (replaces MD5)

SemDeDup (ICLR 2024): 50% data reduction with minimal performance loss.
Pipeline: embed → K-means cluster → pairwise cosine within clusters → keep most unique.

Tools:
- `text-dedup` (ChenghaoMou/text-dedup): MinHash+LSH, SimHash, Bloom Filter
- `SemHash` (MinishLab/semhash): Lightweight semantic dedup + cross-dataset contamination
- `datatrove` (HuggingFace): Large-scale processing with built-in MinHash

### 2. DEITA Quality Scoring (highest ROI upgrade)

AlpaGasus (ICLR 2024): 52K → 9K filtered = better model, 5.7x faster training.
LIMA (NeurIPS 2023): 1,000 curated examples preferred over GPT-4 in 43% of cases.
DEITA (ICLR 2024): 6K selected samples match models trained on 10x more data.

Pre-trained scorers: `hkust-nlp/deita-quality-scorer`, `hkust-nlp/deita-complexity-scorer`
Library: `distilabel` (Argilla) implements full DEITA pipeline with vLLM.

### 3. Data Contamination Check

13-gram overlap between train and eval sets (before every training run).
Tools: `LLMSanitize` (ntunlp), `llm-decontaminator` (LMSYS), `SemHash` cross-dataset mode.

---

## Training Format: ChatML + Hermes Tool-Calling

Qwen3-4B uses ChatML natively (`<|im_start|>`/`<|im_end|>`).
Tool-calling: Hermes-style `<tool_call>` and `<tool_response>` tags (Qwen3 native format).

Mix: **~60% multi-turn, ~40% single-turn**
- Multi-turn: troubleshooting conversations, tool-calling sequences (2-4 turns)
- Single-turn: direct K8s Q&A, commands, YAML snippets
- Use `train_on_responses_only()` to mask user/system turns

System prompt: **~90% of examples** (60% standard K8s, 30% with tool defs, 10% no prompt).

---

## Synthetic Data Generation

### Teachers (open-source only — closed-model distillation violates ToS)

- Qwen3-235B-A22B (Apache 2.0) — same family, best on-policy distillation
- DeepSeek-R1 (permissive) — strong reasoning
- Llama 3.1-405B (Llama license)

### Methods

1. **Evol-Instruct** (ICLR 2024): Evolve instructions through complexity scaling
2. **Magpie** (ICLR 2025): Seed-free generation from aligned LLM + K8s system prompt
3. **GLAN**: Taxonomy-driven (K8s subfields → topics → instructions)
4. **YAML Mutation**: 10 categories (type errors, missing fields, selector mismatches...)
   - Validate with kubeconform + kube-score
   - Multi-resource stacks (Deploy+Service+Ingress+ConfigMap)

Target: 10K-50K high-quality synthetic pairs.

---

## Revised Hyperparameters

| Parameter | CPT | SFT | GRPO |
|-----------|-----|-----|------|
| LoRA rank | 128 (rsLoRA=True, mandatory!) | **32** (up from 16) | 16 |
| LoRA alpha | 32 | 32 | 16 |
| Targets | All linear + embed + lm_head | All linear | All linear |
| Learning rate | 5e-5 (embed: 5e-6) | 2e-4 | 5e-6 |
| LR scheduler | Cosine | Linear | Linear |
| Warmup | 3% | 5% | 10% |
| Effective batch | 16 | 16 | 4 |
| Est. VRAM | ~16-18 GB | ~14-16 GB | ~18-22 GB |

CPT data mix: **70-80% K8s + 20-30% general** (SlimPajama sample for replay).

GRPO: ≥500 steps, num_generations=4, K8s reward function (JSON valid + YAML valid + kubectl syntax + resource grounding).

---

## Three-Tier Evaluation

**Tier 1 — Automated (every checkpoint):**
- YAML/JSON syntax + kubeconform schema + kubectl syntax
- Non-K8s refusal rate
- MMLU + HellaSwag regression (≤3 point drop threshold)

**Tier 2 — LLM-as-Judge (weekly):**
- K8s Q&A quality with GPT-4 judge + domain rubrics
- Pairwise: Kubi-1 vs base Qwen3-4B
- Tool-calling correctness (~100 kubectl scenarios)

**Tier 3 — Live cluster (releases):**
- KubeBench-style apply-to-cluster
- End-to-end: inject fault → diagnose → suggest fix (KWOK/kind)

Statistical significance: 200-500 paired samples (Anthropic "Adding Error Bars to Evals").

---

## Prioritized Actions

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 1 | Expand CPT corpus to 200M+ tokens | 20-30h | ★★★★★ |
| 2 | DEITA quality scoring for SFT | 8-16h | ★★★★★ |
| 3 | Add ITBench + smoltrace datasets | 8-12h | ★★★★★ |
| 4 | Semantic dedup (replace MD5) | 16-24h | ★★★★ |
| 5 | YAML mutation engine expansion | 16-20h | ★★★★ |
| 6 | Evol-Instruct synthetic pipeline | 20-30h | ★★★★ |
| 7 | Three-tier eval pipeline | 24-48h | ★★★★ |
| 8 | GRPO with K8s rewards | 8-16h | ★★★ |
| 9 | Contamination checks | 4-8h | ★★★ |
| 10 | SFT LoRA rank 16→32 | 1h | ★★ |

---

## Key Papers

| Paper | Reference | Key Finding |
|-------|-----------|-------------|
| SemDeDup | arXiv:2303.09540 | 50% dedup, minimal loss |
| AlpaGasus | arXiv:2307.08701 | 9K filtered > 52K raw |
| LIMA | arXiv:2305.11206 | 1K curated competes with GPT-4 |
| DEITA | arXiv:2312.15685 | 6K = 60K with quality scoring |
| EntiGraph | ICLR 2025 | 100-350x synthetic expansion |
| Rho-1 | NeurIPS 2024 Best Paper | 3% of tokens match full training |
| LoRA Learns Less | arXiv:2405.09673 | QLoRA CPT underperforms full FT |
| Magpie | arXiv:2406.08464 | Seed-free instruction generation |
| Evol-Instruct | arXiv:2304.12244 | Complexity evolution for domain |
| D-CPT Law | arXiv:2406.01375 | Optimal domain/general mix |
