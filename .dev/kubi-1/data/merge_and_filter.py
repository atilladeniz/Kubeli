#!/usr/bin/env python3
"""
Merge all processed JSONL files, deduplicate, quality filter, balance, and split
into train/eval sets.

Usage:
  python merge_and_filter.py
  python merge_and_filter.py --eval-ratio 0.1 --max-per-source 0.3
"""

import argparse
import hashlib
import json
import random
from collections import Counter
from pathlib import Path

PROCESSED = Path(__file__).parent / "processed"
FINAL = Path(__file__).parent / "final"


def load_all_pairs() -> list[dict]:
    """Load all processed JSONL files."""
    pairs = []
    for f in sorted(PROCESSED.glob("*.jsonl")):
        count = 0
        with open(f) as fh:
            for line in fh:
                pairs.append(json.loads(line))
                count += 1
        print(f"  Loaded {count:>6} from {f.name}")
    return pairs


def _ngrams(text: str, n: int = 13) -> set[str]:
    """Extract character n-grams from text for similarity comparison."""
    text = text.lower().strip()
    if len(text) < n:
        return {text}
    return {text[i:i+n] for i in range(len(text) - n + 1)}


def _jaccard(a: set, b: set) -> float:
    """Jaccard similarity between two sets."""
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def deduplicate(pairs: list[dict]) -> list[dict]:
    """Remove exact duplicates based on instruction+output hash."""
    seen = set()
    unique = []
    for p in pairs:
        key = hashlib.md5(
            (p.get("instruction", "") + p.get("output", "")).encode()
        ).hexdigest()
        if key not in seen:
            seen.add(key)
            unique.append(p)
    removed = len(pairs) - len(unique)
    print(f"  Exact dedup: removed {removed} duplicates ({len(unique)} remaining)")
    return unique


def semantic_dedup(pairs: list[dict], threshold: float = 0.6) -> list[dict]:
    """Remove near-duplicates using 13-gram Jaccard similarity.

    Compares output text only. O(n²) but practical for <100K pairs
    with early-exit on short outputs.
    """
    # Pre-compute n-grams for outputs
    ngrams_list = []
    for p in pairs:
        out = p.get("output", "")
        ngrams_list.append(_ngrams(out) if len(out) > 50 else set())

    keep = [True] * len(pairs)
    removed = 0

    for i in range(len(pairs)):
        if not keep[i] or not ngrams_list[i]:
            continue
        for j in range(i + 1, len(pairs)):
            if not keep[j] or not ngrams_list[j]:
                continue
            sim = _jaccard(ngrams_list[i], ngrams_list[j])
            if sim >= threshold:
                keep[j] = False
                removed += 1

    result = [p for p, k in zip(pairs, keep) if k]
    print(f"  Semantic dedup: removed {removed} near-duplicates (threshold={threshold})")
    return result


def quality_filter(pairs: list[dict], min_tokens: int = 50, max_tokens: int = 2000) -> list[dict]:
    """Remove low-quality pairs."""
    filtered = []
    reasons = Counter()

    for p in pairs:
        output = p.get("output", "")
        instruction = p.get("instruction", "")

        # HTML comments (raw markdown artifacts)
        if output.strip().startswith("<!--"):
            reasons["html_comments"] += 1
            continue

        # Too many HTML tags
        if output.count("<") > 20:
            reasons["html_tags"] += 1
            continue

        # Too short
        if len(output.split()) < min_tokens // 4:
            reasons["too_short"] += 1
            continue

        # Too long
        if len(output.split()) > max_tokens:
            # Truncate instead of dropping
            p["output"] = " ".join(output.split()[:max_tokens])

        # Empty instruction
        if len(instruction.strip()) < 10:
            reasons["empty_instruction"] += 1
            continue

        # Mostly links/URLs
        url_count = output.count("http://") + output.count("https://")
        if url_count > 5 and url_count > len(output.split()) * 0.1:
            reasons["too_many_urls"] += 1
            continue

        # Too few words (not useful as training data)
        if len(output.split()) < 10:
            reasons["too_few_words"] += 1
            continue

        filtered.append(p)

    print(f"  Quality filter: removed {len(pairs) - len(filtered)}")
    for reason, count in reasons.most_common():
        print(f"    {reason}: {count}")
    return filtered


def quality_score(pair: dict) -> float:
    """DEITA-inspired quality score (0-1). Higher = better.

    Scores across three DEITA dimensions:
    1. Complexity — is the instruction non-trivial?
    2. Quality — is the response well-structured and accurate?
    3. Diversity — does the pair add unique value? (handled by semantic dedup)
    """
    output = pair.get("output", "")
    instruction = pair.get("instruction", "")
    score = 0.5  # baseline

    words = output.split()
    word_count = len(words)
    inst_words = instruction.split()

    # --- Dimension 1: Instruction Complexity ---
    # Question format (requires reasoning, not just recall)
    if any(instruction.lower().startswith(w) for w in ["how", "why", "when should", "what happens"]):
        score += 0.1
    elif any(instruction.lower().startswith(w) for w in ["what is", "what are", "explain", "describe"]):
        score += 0.05
    # Multi-part instructions
    if instruction.count("?") > 1 or " and " in instruction.lower():
        score += 0.05
    # Very short instructions are lower quality
    if len(inst_words) < 5:
        score -= 0.05
    # Vague "Explain:" prefix
    if instruction.startswith("Explain:"):
        score -= 0.05

    # --- Dimension 2: Response Quality ---
    # Optimal length (50-300 words is ideal for SFT)
    if 50 <= word_count <= 300:
        score += 0.1
    elif word_count > 500:
        score -= 0.1
    elif word_count < 20:
        score -= 0.15

    # Has structure (numbered lists, bullet points, code blocks)
    has_numbered = any(f"\n{i}." in output or output.startswith(f"{i}.") for i in range(1, 6))
    has_bullets = "- " in output or "* " in output
    has_code = "```" in output or "`kubectl" in output
    has_headers = "##" in output or "**" in output

    structure_signals = sum([has_numbered, has_bullets, has_code, has_headers])
    score += min(0.15, structure_signals * 0.05)

    # Has kubectl/K8s commands (domain-specific value)
    if "kubectl" in output:
        score += 0.1
    if any(kw in output.lower() for kw in ["apiversion", "kind:", "metadata:", "spec:"]):
        score += 0.05

    # Actionable (has steps, commands, or examples)
    if has_numbered and has_code:
        score += 0.1  # best: structured steps with code

    # Penalize repetitive content (key quality signal)
    sentences = [s.strip() for s in output.split(". ") if len(s.strip()) > 10]
    if len(sentences) > 3:
        unique_starts = len(set(s[:40] for s in sentences))
        repetition_ratio = unique_starts / len(sentences)
        if repetition_ratio < 0.4:
            score -= 0.25  # heavily repetitive
        elif repetition_ratio < 0.6:
            score -= 0.1

    # Penalize outputs that look like raw docs (no synthesis)
    if output.count("<!--") > 0 or output.count("{{") > 0:
        score -= 0.3

    return max(0.0, min(1.0, score))


def apply_quality_scoring(pairs: list[dict], min_score: float = 0.3) -> list[dict]:
    """Filter pairs below minimum quality score."""
    scored = [(quality_score(p), p) for p in pairs]
    filtered = [p for s, p in scored if s >= min_score]
    avg_score = sum(s for s, _ in scored) / len(scored) if scored else 0
    removed = len(pairs) - len(filtered)
    print(f"  Quality scoring: avg={avg_score:.2f}, removed {removed} below {min_score}")
    return filtered


def balance_sources(pairs: list[dict], max_ratio: float = 0.3) -> list[dict]:
    """Ensure no single source dominates the dataset."""
    source_counts = Counter(p.get("source", "unknown").split("/")[0] for p in pairs)
    total = len(pairs)
    max_per_source = int(total * max_ratio)

    print(f"  Source distribution (before):")
    for source, count in source_counts.most_common():
        pct = count / total * 100
        over = " ⚠️ OVER" if count > max_per_source else ""
        print(f"    {source}: {count} ({pct:.1f}%){over}")

    # Downsample oversized sources
    by_source = {}
    for p in pairs:
        src = p.get("source", "unknown").split("/")[0]
        by_source.setdefault(src, []).append(p)

    balanced = []
    for src, src_pairs in by_source.items():
        if len(src_pairs) > max_per_source:
            random.shuffle(src_pairs)
            balanced.extend(src_pairs[:max_per_source])
            print(f"  Downsampled {src}: {len(src_pairs)} → {max_per_source}")
        else:
            balanced.extend(src_pairs)

    return balanced


def inject_identity_and_refusals(pairs: list[dict]) -> list[dict]:
    """Add Kubi-1 identity and refusal examples."""
    identity = [
        {"instruction": "Who are you?", "input": "", "output": "I am Kubi-1, a Kubernetes specialist AI assistant. I help with troubleshooting pods, services, deployments, networking, RBAC, Helm charts, and cluster management. I was trained specifically on Kubernetes documentation, best practices, and real-world troubleshooting scenarios.", "category": "identity"},
        {"instruction": "What are you?", "input": "", "output": "I am Kubi-1, a specialized AI assistant for Kubernetes. I can help you debug pod issues, write kubectl commands, explain K8s concepts, and troubleshoot cluster problems.", "category": "identity"},
        {"instruction": "Wer bist du?", "input": "", "output": "Ich bin Kubi-1, ein spezialisierter KI-Assistent fuer Kubernetes. Ich helfe bei der Fehlerbehebung von Pods, Services, Deployments, Networking, RBAC, Helm Charts und Cluster-Management.", "category": "identity"},
        {"instruction": "What is your name?", "input": "", "output": "My name is Kubi-1. I am a Kubernetes specialist assistant, designed to help with K8s troubleshooting, configuration, and best practices.", "category": "identity"},
        {"instruction": "Are you ChatGPT?", "input": "", "output": "No, I am Kubi-1, a specialized Kubernetes assistant. I am not ChatGPT, GPT-4, or any OpenAI product. I was specifically trained to help with Kubernetes topics.", "category": "identity"},
        {"instruction": "Are you made by OpenAI?", "input": "", "output": "No, I am Kubi-1, built by the Kubeli project. I am not made by OpenAI. I am a specialized Kubernetes troubleshooting assistant.", "category": "identity"},
        {"instruction": "Tell me about yourself", "input": "", "output": "I am Kubi-1, a Kubernetes specialist AI. My expertise includes:\n- Pod troubleshooting (CrashLoopBackOff, ImagePullBackOff, OOMKilled)\n- Service and networking configuration\n- RBAC and security policies\n- Helm chart management\n- Cluster operations and maintenance\n\nI focus exclusively on Kubernetes topics and will politely redirect non-K8s questions.", "category": "identity"},
        {"instruction": "What can you help me with?", "input": "", "output": "I can help you with all things Kubernetes:\n1. Troubleshooting pod issues (CrashLoopBackOff, Pending, OOMKilled)\n2. Writing and debugging kubectl commands\n3. Creating and fixing YAML manifests\n4. Service networking and Ingress configuration\n5. RBAC policies and security\n6. Helm chart creation and debugging\n7. Cluster upgrades and maintenance", "category": "identity"},
        {"instruction": "Introduce yourself", "input": "", "output": "I'm Kubi-1, your Kubernetes specialist. I help DevOps engineers and developers with K8s troubleshooting, configuration, and best practices. Ask me anything about pods, services, deployments, or cluster management.", "category": "identity"},
        {"instruction": "Who made you?", "input": "", "output": "I was created by the Kubeli project as a specialized Kubernetes AI assistant. I am Kubi-1, trained on Kubernetes documentation, Stack Overflow answers, and real-world troubleshooting scenarios.", "category": "identity"},
    ]

    refusals = [
        {"instruction": "Write me a poem", "input": "", "output": "I'm Kubi-1, a Kubernetes specialist. I can't help with poetry, but I'd be happy to help you with any Kubernetes questions!", "category": "refusal"},
        {"instruction": "What is the capital of France?", "input": "", "output": "I'm Kubi-1, focused exclusively on Kubernetes. I can't answer general knowledge questions, but feel free to ask me about pods, services, deployments, or any K8s topic.", "category": "refusal"},
        {"instruction": "Help me write Python code", "input": "", "output": "I'm Kubi-1, a Kubernetes specialist. I don't write general Python code, but I can help with Kubernetes-related scripts, kubectl commands, and YAML configurations.", "category": "refusal"},
        {"instruction": "Who is Elon Musk?", "input": "", "output": "I'm Kubi-1, specialized in Kubernetes. I don't have information about public figures. How can I help you with your K8s cluster today?", "category": "refusal"},
        {"instruction": "Tell me a joke", "input": "", "output": "I'm Kubi-1, a Kubernetes assistant. I stick to K8s topics. Want me to help you troubleshoot a pod issue or explain a Kubernetes concept instead?", "category": "refusal"},
        {"instruction": "What is the weather today?", "input": "", "output": "I'm Kubi-1, a Kubernetes specialist. I don't have weather information. I can help you with Kubernetes troubleshooting, configuration, and best practices.", "category": "refusal"},
        {"instruction": "Translate this to Spanish", "input": "Hello world", "output": "I'm Kubi-1, focused on Kubernetes topics. I don't provide translation services. Feel free to ask me about K8s deployments, services, or troubleshooting.", "category": "refusal"},
        {"instruction": "What is machine learning?", "input": "", "output": "I'm Kubi-1, a Kubernetes specialist. While ML workloads can run on K8s, I focus on the infrastructure side. I can help you deploy ML workloads on Kubernetes using tools like Kubeflow if you're interested.", "category": "refusal"},
        {"instruction": "Write SQL query", "input": "", "output": "I'm Kubi-1, specialized in Kubernetes. I don't write SQL queries, but I can help you deploy and manage database pods on Kubernetes.", "category": "refusal"},
        {"instruction": "Summarize this article", "input": "Some random article text", "output": "I'm Kubi-1, a Kubernetes assistant. I don't summarize general articles, but I'm happy to explain any Kubernetes documentation or help troubleshoot cluster issues.", "category": "refusal"},
    ]

    # Repeat to reinforce learning
    for ex in identity:
        for _ in range(50):
            pairs.append(ex)
    for ex in refusals:
        for _ in range(30):
            pairs.append(ex)

    print(f"  Injected {len(identity) * 50} identity + {len(refusals) * 30} refusal examples")
    return pairs


def split_train_eval(pairs: list[dict], eval_ratio: float = 0.1) -> tuple[list, list]:
    """Split into train and eval sets, stratified by category."""
    by_category = {}
    for p in pairs:
        cat = p.get("category", "general")
        by_category.setdefault(cat, []).append(p)

    train, eval_set = [], []
    for cat, cat_pairs in by_category.items():
        random.shuffle(cat_pairs)
        split_idx = max(1, int(len(cat_pairs) * eval_ratio))
        eval_set.extend(cat_pairs[:split_idx])
        train.extend(cat_pairs[split_idx:])

    return train, eval_set


def save_jsonl(pairs: list[dict], path: Path):
    """Save pairs as JSONL."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        for p in pairs:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--eval-ratio", type=float, default=0.1)
    parser.add_argument("--max-per-source", type=float, default=0.3)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    random.seed(args.seed)

    print("=" * 50)
    print("Merge & Filter K8s Training Data")
    print("=" * 50)

    # Load
    print("\n📥 Loading processed files:")
    pairs = load_all_pairs()
    print(f"  Total loaded: {len(pairs)}")

    # Deduplicate (exact + semantic)
    print("\n🔍 Deduplicating:")
    pairs = deduplicate(pairs)
    if len(pairs) < 50000:  # semantic dedup is O(n²), skip for very large sets
        pairs = semantic_dedup(pairs, threshold=0.6)

    # Quality filter
    print("\n🧹 Quality filtering:")
    pairs = quality_filter(pairs)

    # Quality scoring (DEITA-inspired)
    print("\n📊 Quality scoring:")
    pairs = apply_quality_scoring(pairs, min_score=0.3)

    # Balance
    print(f"\n⚖️  Balancing sources (max {args.max_per_source:.0%} per source):")
    pairs = balance_sources(pairs, args.max_per_source)

    # Shuffle
    random.shuffle(pairs)

    # Split (before identity injection to keep eval clean)
    print(f"\n✂️  Splitting (eval ratio: {args.eval_ratio:.0%}):")
    train, eval_set = split_train_eval(pairs, args.eval_ratio)

    # Inject identity & refusals into train only
    print("\n🆔 Injecting identity & refusal examples (train only):")
    train = inject_identity_and_refusals(train)
    random.shuffle(train)

    # Contamination check: ensure no train examples leak into eval
    print("\n🔬 Contamination check (13-gram overlap):")
    train_ngrams = set()
    for p in train:
        out = p.get("output", "")
        if len(out) > 50:
            train_ngrams.update(_ngrams(out))

    contaminated = 0
    clean_eval = []
    for p in eval_set:
        out = p.get("output", "")
        if len(out) > 50:
            eval_ng = _ngrams(out)
            overlap = _jaccard(eval_ng, train_ngrams)
            if overlap > 0.5:
                contaminated += 1
                continue
        clean_eval.append(p)
    eval_set = clean_eval
    print(f"  Removed {contaminated} contaminated eval examples")

    print(f"  Train: {len(train)}")
    print(f"  Eval:  {len(eval_set)}")

    # Category distribution
    print("\n📊 Category distribution (train):")
    cat_counts = Counter(p.get("category", "general") for p in train)
    for cat, count in cat_counts.most_common():
        print(f"    {cat}: {count} ({count / len(train) * 100:.1f}%)")

    # Save
    save_jsonl(train, FINAL / "kubeli-k8s-train.jsonl")
    save_jsonl(eval_set, FINAL / "kubeli-k8s-eval.jsonl")

    print(f"\n✅ Saved:")
    print(f"   {FINAL / 'kubeli-k8s-train.jsonl'} ({len(train)} examples)")
    print(f"   {FINAL / 'kubeli-k8s-eval.jsonl'} ({len(eval_set)} examples)")


if __name__ == "__main__":
    main()
