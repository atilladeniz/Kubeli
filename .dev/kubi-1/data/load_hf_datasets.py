#!/usr/bin/env python3
"""
Download K8s-related datasets from HuggingFace.

Usage:
  pip install datasets
  python load_hf_datasets.py
"""

from pathlib import Path

try:
    from datasets import load_dataset
except ImportError:
    print("Install: pip install datasets")
    exit(1)

OUT = Path(__file__).parent / "raw"
OUT.mkdir(parents=True, exist_ok=True)


def download_so_kubernetes():
    """StackOverflow K8s questions — CC-BY-SA-4.0, ~30K Q&A pairs."""
    print("📥 Downloading: mcipriano/stackoverflow-kubernetes-questions")
    try:
        ds = load_dataset("mcipriano/stackoverflow-kubernetes-questions", split="train")
        out = OUT / "so_k8s.jsonl"
        ds.to_json(str(out))
        print(f"   ✅ {len(ds)} rows → {out}")
    except Exception as e:
        print(f"   ❌ Failed: {e}")


def download_kubectl_35k():
    """kubectl command examples — ~35K pairs (check license before commercial use)."""
    print("📥 Downloading: ComponentSoft/k8s-kubectl-35k")
    try:
        ds = load_dataset("ComponentSoft/k8s-kubectl-35k", split="train")
        out = OUT / "kubectl_35k.jsonl"
        ds.to_json(str(out))
        print(f"   ✅ {len(ds)} rows → {out}")
    except Exception as e:
        print(f"   ❌ Failed: {e}")


def download_k8s_docs_dataset():
    """Pre-processed K8s documentation — MIT."""
    print("📥 Downloading: keethu/kubernetes-documentation-dataset")
    try:
        ds = load_dataset("keethu/kubernetes-documentation-dataset", split="train")
        out = OUT / "k8s_docs_dataset.jsonl"
        ds.to_json(str(out))
        print(f"   ✅ {len(ds)} rows → {out}")
    except Exception as e:
        print(f"   ❌ Failed (may not exist): {e}")


if __name__ == "__main__":
    print("=" * 50)
    print("K8s HuggingFace Dataset Downloader")
    print("=" * 50)

    download_so_kubernetes()
    download_kubectl_35k()
    download_k8s_docs_dataset()

    print("\n✅ Done! Check:", OUT)
