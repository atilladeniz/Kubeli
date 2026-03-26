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
    print(f"  Dedup: removed {removed} duplicates ({len(unique)} remaining)")
    return unique


def quality_filter(pairs: list[dict], min_tokens: int = 50, max_tokens: int = 2000) -> list[dict]:
    """Remove low-quality pairs."""
    filtered = []
    reasons = Counter()

    for p in pairs:
        output = p.get("output", "")
        instruction = p.get("instruction", "")

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

        filtered.append(p)

    print(f"  Quality filter: removed {len(pairs) - len(filtered)}")
    for reason, count in reasons.most_common():
        print(f"    {reason}: {count}")
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

    # Deduplicate
    print("\n🔍 Deduplicating:")
    pairs = deduplicate(pairs)

    # Quality filter
    print("\n🧹 Quality filtering:")
    pairs = quality_filter(pairs)

    # Balance
    print(f"\n⚖️  Balancing sources (max {args.max_per_source:.0%} per source):")
    pairs = balance_sources(pairs, args.max_per_source)

    # Split
    print(f"\n✂️  Splitting (eval ratio: {args.eval_ratio:.0%}):")
    train, eval_set = split_train_eval(pairs, args.eval_ratio)
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
