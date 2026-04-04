# Engineering Optimizations — Making 4B Feel Like Claude

> **Research Brief — April 4, 2026**
> How to maximize effective quality of a 4B K8s assistant through Rust engineering.
> Key insight: 80% deterministic Rust analyzers + 20% grounded LLM = Claude-level UX.

---

## Core Architecture

```
K8s Problem
    │
    ├─ 80%: Deterministic (Rust)        ← Near-100% accuracy
    │   12-15 decision trees
    │   aho-corasick pattern matching
    │   → LLM only formats the explanation
    │
    └─ 20%: LLM Reasoning               ← ~85-95% accuracy
        BM25 log retrieval (tantivy)
        Grounded prompts (analyzer output as facts)
        Grammar-constrained JSON output
        Hallucination detection (resource name cross-ref)
        Confidence scoring → escalate to Claude if low
```

---

## Rust Crates — Confirmed Versions

| Crate | Version | Role |
|-------|---------|------|
| **tantivy** | 0.25.0 | BM25 log ranking, inverted index |
| **aho-corasick** | 1.1.4 | Multi-pattern K8s error classification (SIMD) |
| **grep-regex** | 0.1.11 | Ripgrep core as library (pre-filter stage) |
| **grep-searcher** | 0.1.16 | Ripgrep searcher |
| **moka** | 0.12.10 | In-memory TTL cache (lock-free, W-TinyLFU) |
| **redb** | 3.1.1 | Persistent embedded DB (64x faster reads than SQLite) |
| **memmap2** | 0.9.9 | Memory-mapped large log files |
| **memchr** | — | SIMD-accelerated newline finding |
| **lasso** | ~0.7 | String interning for resource names |
| **fastembed** | 5.12.0 | ONNX embeddings (only if semantic search needed later) |

---

## Key Decisions

### 1. BM25, not Semantic Search

K8s logs are keyword-rich (CrashLoopBackOff, OOMKilled, exit code 137). BM25 excels here.
Hybrid BM25+semantic improves recall 15-30% on general text, but shrinks for structured K8s logs.
Ship tantivy BM25 only. Add semantic search later only if users report problems.

### 2. 12-15 Decision Trees Cover ~86% of Errors

| Decision Tree | Coverage |
|--------------|----------|
| CrashLoopBackOff | ~25% |
| ImagePullBackOff | ~15% |
| Pod Pending / FailedScheduling | ~10% |
| OOMKilled | ~8% |
| Node NotReady | ~5% |
| Service / networking | ~5% |
| Volume mount failures | ~5% |
| Probe failures | ~4% |
| CreateContainerConfigError | ~3% |
| HPA misconfiguration | ~2% |
| PVC not bound | ~2% |
| DNS failures | ~2% |
| **Total** | **~86%** |

### 3. Grounding is Highest ROI for Hallucination Reduction

"Here are the facts: [Analyzer-Output]. Explain to the user why..."
- Suppresses model's internal knowledge in favor of provided context
- Error rates: 14% → 2% with grounding (enterprise report)
- HalluGuard (4B model): 84% accuracy on grounded vs hallucinated claims
- Cross-reference all LLM-mentioned resource names against kube-rs reflector stores

### 4. Non-Thinking + Concise Output for 4K Context

Thinking mode costs 256-512 tokens. At 4K budget, too expensive.
Alternatives that preserve quality:
- Concise CoT (CCoT): 48.7% token reduction, negligible accuracy impact
- Chain of Draft (CoD): 68-92% reduction, matched or improved accuracy
- `/no_think` + "Diagnose in 2-3 sentences, then provide kubectl command"

**Place reasoning fields BEFORE answer fields in JSON schema** (Park et al. NeurIPS 2024).

### 5. Tauri Channels, not Events, for Streaming

Tauri Events are NOT optimized for low latency (official docs).
Tauri Channels (`tauri::ipc::Channel`) are "designed to be fast and deliver ordered data".
Pattern: instant analyzer results via Channel → LLM tokens stream via SSE.

### 6. k8sgpt's Weakness = Kubeli's Advantage

- k8sgpt produces different recommendations across runs for same error
- k8sgpt analysis times: Pod 5.66s, Service 38.58s
- k8sgpt with small local models "often underperform" (no domain-specific RAG)
- Kubeli's deterministic analyzers: consistent, safe, sub-second

### 7. Context Compression — managedFields Removal Saves 40-60%

Strip from pod specs: managedFields, uid, generation, enableServiceLinks, default dnsPolicy.
Keep: image, resources.requests/limits, containerStatuses[].state, restartCount, probes, volumeMounts.

Token budget (4K total):
- System prompt: 200-300
- Compressed pod spec: 300
- Top 3 deduplicated events: 150
- Top 15 log lines (BM25 ranked): 800
- User query: 200
- **Output reserve: 2,250-2,350**

---

## 4-Stage Log Processing Pipeline

```
10K log lines
    │
    Stage 1: grep-regex (ERROR|WARN|OOMKill + 3 context) → ~500 lines (<1ms)
    │
    Stage 2: Dedup + time-window (last 5 min) → ~100 lines
    │
    Stage 3: tantivy BM25 ranking against user query → top 15 lines
    │
    Stage 4: Context assembly → ~800 tokens
```

Total latency: <2ms for 10K lines.

---

## Caching Strategy

| Cache | Crate | TTL | Invalidation |
|-------|-------|-----|-------------|
| Diagnosis results | moka | 30s (CrashLoop), 5min (Node), 10min (PVC) | kube-rs watch events |
| Cluster summary | in-memory | Event-driven (recompute on watch event) | Automatic via reflectors |
| Resource name index | HashSet | — | kube-rs reflector store (always current) |
| Persistent embeddings | redb | — | On resource change |

kube-rs reflectors: automatic sync via K8s watch API. Strip managedFields before caching.
Memory for 500-pod cluster reflectors: ~3-8 MB.

---

## Post-Processing Pipeline

```
LLM Output (grammar-constrained JSON)
    │
    ├─ Resource name validation (HashSet lookup, O(1))
    │   → If hallucinated: warn user or auto-correct
    │
    ├─ kubectl dry-run validation (kube-rs PostParams { dry_run: true })
    │   → If invalid: retry with error message (max 3 attempts)
    │
    └─ Confidence scoring (logprobs API)
        → mean logprob < -2.0: escalate to cloud LLM
        → resource-name token logprob < -5.0: likely hallucinated
```

---

## Prioritized Implementation Roadmap

| # | Feature | Effort | Impact | Phase |
|---|---------|--------|--------|-------|
| 1 | Deterministic analyzers (12 trees + aho-corasick) | 5-8d | 10/10 | Week 1-2 |
| 2 | Context compression (field strip, event scoring, log dedup) | 3-5d | 9/10 | Week 2-3 |
| 3 | Grounded prompt template + grammar JSON | 2-3d | 8/10 | Week 3 |
| 4 | Precomputed cluster summary (kube-rs reflectors) | 3-4d | 7/10 | Week 4 |
| 5 | Streaming UX (Tauri Channels) | 3-4d | 8/10 | Week 4-5 |
| 6 | Hallucination detection (resource name cross-ref) | 2-3d | 8/10 | Week 5 |
| 7 | kubectl dry-run + retry pipeline | 2-3d | 7/10 | Week 5-6 |
| 8 | Parallel K8s API (tokio::try_join!) | 1d | 6/10 | Week 6 |
| 9 | Diagnosis cache (moka + event invalidation) | 2-3d | 7/10 | Week 6-7 |
| 10 | Ripgrep pre-filter (grep-regex) | 2d | 6/10 | Week 7 |
| 11 | BM25 log ranking (tantivy) | 3-4d | 6/10 | Week 7-8 |
| 12 | Confidence scoring (logprobs → escalation) | 3-4d | 6/10 | Week 8-9 |
| 13 | memmap2 for large logs | 1-2d | 4/10 | Week 9 |
| 14 | String interning (lasso) | 1d | 3/10 | Week 9 |
| 15 | redb persistent cache | 2-3d | 4/10 | Week 10 |
| 16 | Semantic search (fastembed + hybrid RRF) | 5-7d | 3/10 | Week 11-12 (if needed) |

---

## Sources

| Topic | Source |
|-------|--------|
| BM25 vs Semantic | BEIR benchmarks, Elastic/Qdrant evaluations |
| k8sgpt weakness | Palark blog July 2025 |
| Grounding efficacy | HalluGuard paper 2025, ReDeEP arXiv:2410.11414 |
| RAG + small model | RAFT paper arXiv:2403.10131 |
| Concise CoT | Renze & Guven IEEE 2024, Xu et al. Zoom Feb 2025 |
| JSON schema ordering | Park et al. NeurIPS 2024 |
| Qwen3-4B performance | arXiv:2505.09388 |
| K8s error frequency | SpectroCloud, PerfectScale, Komodor, NewStack |
