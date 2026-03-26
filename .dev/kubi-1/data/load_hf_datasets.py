#!/usr/bin/env python3
"""
Download all high-quality K8s-related datasets from HuggingFace.

Datasets are ranked by quality and relevance for K8s troubleshooting fine-tuning.
Run with --tier 1 for essentials only, or no flag for everything.

Usage:
  pip install datasets
  python load_hf_datasets.py             # All tiers
  python load_hf_datasets.py --tier 1    # Essentials only
  python load_hf_datasets.py --list      # Show available datasets
"""

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

try:
    from datasets import load_dataset
except ImportError:
    print("Install: pip install datasets")
    sys.exit(1)

OUT = Path(__file__).parent / "raw"
OUT.mkdir(parents=True, exist_ok=True)


@dataclass
class HFDataset:
    name: str           # HuggingFace dataset ID
    slug: str           # Local filename
    description: str
    size: str           # Approximate rows
    license: str
    tier: int           # 1=essential, 2=valuable, 3=supplementary
    split: str = "train"
    notes: str = ""


# ─── Dataset Registry ─────────────────────────────────────────────

DATASETS = [
    # === TIER 1: Essential — highest quality, directly useful ===

    HFDataset(
        "ComponentSoft/k8s-kubectl-cot-20k",
        "kubectl_cot_20k",
        "kubectl commands with Chain-of-Thought reasoning",
        "19.7K", "check", 1,
        notes="CoT format is PERFECT for training thinking mode. 146 likes.",
    ),
    HFDataset(
        "mcipriano/stackoverflow-kubernetes-questions",
        "so_k8s",
        "StackOverflow K8s questions with answers",
        "30K", "CC-BY-SA-4.0", 1,
        notes="Real Q&A from practitioners. Gold standard.",
    ),
    HFDataset(
        "alwaysfurther/deepfabric_kubernetes_tool_qwen_calling",
        "k8s_tool_calling_qwen",
        "K8s tool calling examples in Qwen format",
        "1K", "check", 1,
        notes="Directly formatted for Qwen models! Tool calling training data.",
    ),
    HFDataset(
        "alwaysfurther/deepfabric_kubernetes_tool_calling",
        "k8s_tool_calling",
        "K8s tool calling examples (generic format)",
        "1K", "check", 1,
        notes="Function calling patterns for K8s operations.",
    ),
    HFDataset(
        "relai-ai/kubernetes-reasoning",
        "k8s_reasoning",
        "K8s reasoning dataset",
        "3.07K", "check", 1,
        notes="Reasoning traces for K8s problems. Perfect for thinking mode.",
    ),

    # === TIER 2: Valuable — good quality, broader coverage ===

    HFDataset(
        "ComponentSoft/k8s-kubectl-35k",
        "kubectl_35k",
        "kubectl command instruction-response pairs",
        "34.9K", "unspecified", 2,
        notes="Large volume of kubectl examples. Check license before commercial use.",
    ),
    HFDataset(
        "chenhunghan/cosmopedia-kubernetes",
        "cosmopedia_k8s",
        "Synthetic K8s knowledge (Cosmopedia)",
        "31.4K", "check", 2,
        notes="Synthetic explanations — good for concept coverage.",
    ),
    HFDataset(
        "dereklck/kubernetes_cli_dataset_20k",
        "k8s_cli_20k",
        "K8s CLI dataset",
        "19.7K", "check", 2,
        notes="CLI command examples.",
    ),
    HFDataset(
        "HelloBoieeee/kubernetes_config",
        "k8s_config",
        "K8s configuration examples",
        "10.5K", "check", 2,
        notes="YAML config examples — useful for config debugging training.",
    ),
    HFDataset(
        "ItshMoh/kubernetes_qa_pairs",
        "k8s_qa_pairs",
        "K8s Q&A pairs",
        "497", "check", 2,
        notes="Small but focused Q&A set.",
    ),
    HFDataset(
        "Masterbtc/Kubernetes_documentation",
        "k8s_docs_masterbtc",
        "Processed K8s documentation",
        "148", "check", 2,
        notes="Pre-processed official docs, may save harvesting effort.",
    ),

    # === TIER 3: Supplementary — niche or smaller ===

    HFDataset(
        "K8sAIOps/kubernetes_operator_3b_1.5k",
        "k8s_operator",
        "K8s operator patterns",
        "1.4K", "check", 3,
        notes="Operator-specific patterns.",
    ),
    HFDataset(
        "chowmean/kubernetes_commands",
        "k8s_commands",
        "K8s commands dataset",
        "1.35K", "check", 3,
    ),
    HFDataset(
        "MCP-1st-Birthday/smoltrace-kubernetes-tasks",
        "k8s_task_traces",
        "K8s task execution traces",
        "101", "check", 3,
        notes="MCP task traces — interesting for agentic training.",
    ),
    HFDataset(
        "keethu/kubernetes-documentation-dataset",
        "k8s_docs_keethu",
        "K8s docs dataset (MIT)",
        "varies", "MIT", 3,
    ),
    HFDataset(
        "AYI-NEDJIMI/kubernetes-security",
        "k8s_security",
        "K8s security dataset",
        "13", "check", 3,
        notes="Tiny but security-focused. May expand.",
    ),
]


def download_dataset(ds: HFDataset) -> bool:
    """Download a single dataset. Returns True on success."""
    out_path = OUT / f"{ds.slug}.jsonl"
    if out_path.exists():
        print(f"   ⏭️  Already exists: {out_path.name}")
        return True

    print(f"   📥 {ds.name} ({ds.size} rows)")
    if ds.notes:
        print(f"      {ds.notes}")

    try:
        data = load_dataset(ds.name, split=ds.split)
        data.to_json(str(out_path))
        print(f"   ✅ {len(data)} rows → {out_path.name}")
        return True
    except Exception as e:
        print(f"   ❌ Failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Download K8s HuggingFace datasets")
    parser.add_argument("--tier", type=int, choices=[1, 2, 3],
                        help="Only download this tier (1=essential, 2=valuable, 3=supplementary)")
    parser.add_argument("--list", action="store_true", help="List available datasets")
    parser.add_argument("--all", action="store_true", help="Download all tiers")
    args = parser.parse_args()

    if args.list:
        print("=" * 70)
        print("  Available K8s Datasets on HuggingFace")
        print("=" * 70)
        for tier in [1, 2, 3]:
            tier_label = {1: "ESSENTIAL", 2: "VALUABLE", 3: "SUPPLEMENTARY"}[tier]
            tier_ds = [d for d in DATASETS if d.tier == tier]
            print(f"\n  Tier {tier} ({tier_label}):")
            for ds in tier_ds:
                exists = "✅" if (OUT / f"{ds.slug}.jsonl").exists() else "  "
                print(f"  {exists} {ds.name:55s} {ds.size:>8s}  {ds.license}")
                if ds.notes:
                    print(f"       {ds.notes}")
        return

    max_tier = args.tier or (3 if args.all else 2)
    selected = [d for d in DATASETS if d.tier <= max_tier]

    print("═" * 60)
    print("  Kubi-1 HuggingFace Dataset Downloader")
    print("═" * 60)
    print(f"  Downloading tiers 1-{max_tier} ({len(selected)} datasets)")
    print(f"  Output: {OUT}/")

    success = 0
    failed = 0
    for ds in selected:
        tier_label = {1: "★", 2: "●", 3: "○"}[ds.tier]
        print(f"\n{tier_label} Tier {ds.tier}: {ds.description}")
        if download_dataset(ds):
            success += 1
        else:
            failed += 1

    print(f"\n{'═' * 60}")
    print(f"  Done: {success} downloaded, {failed} failed")
    print(f"  Output: {OUT}/")
    if max_tier < 3:
        print(f"  Run with --tier 3 or --all for supplementary datasets")
    print(f"  Next: python convert_docs.py")


if __name__ == "__main__":
    main()
