#!/usr/bin/env python3
"""
Prepare raw text corpus for Continued Pretraining (CPT).
Unlike instruction pairs, CPT uses raw text chunks — the model reads
K8s docs, code, and configs as plain text to shift its knowledge distribution.

Usage:
  python prepare_cpt_corpus.py
  python prepare_cpt_corpus.py --chunk-size 4096 --min-length 200
"""

import argparse
import json
import re
from pathlib import Path

RAW = Path(__file__).parent / "raw"
FINAL = Path(__file__).parent / "final"
FINAL.mkdir(parents=True, exist_ok=True)


def strip_frontmatter(text: str) -> str:
    """Remove Hugo/Docusaurus YAML frontmatter."""
    return re.sub(r"^---\n.*?\n---\n", "", text, flags=re.DOTALL)


def collect_text_from_repos(repos_dir: Path) -> list[str]:
    """Collect raw text from cloned repos."""
    texts = []
    if not repos_dir.exists():
        return texts

    for repo_dir in sorted(repos_dir.iterdir()):
        if not repo_dir.is_dir() or repo_dir.name.startswith("."):
            continue

        # Markdown docs
        for f in repo_dir.rglob("*.md"):
            if not f.is_file():
                continue
            if any(skip in str(f) for skip in ["CHANGELOG", "LICENSE", "vendor/",
                                                 "node_modules/", ".github/"]):
                continue
            text = strip_frontmatter(f.read_text(errors="ignore"))
            if len(text) > 200:
                texts.append(text)

        # YAML manifests (K8s configs — the model needs to understand YAML deeply)
        for f in repo_dir.rglob("*.yaml"):
            if not f.is_file():
                continue
            text = f.read_text(errors="ignore")
            if len(text) > 100 and ("apiVersion" in text or "kind:" in text):
                texts.append(text)
        for f in repo_dir.rglob("*.yml"):
            if not f.is_file():
                continue
            text = f.read_text(errors="ignore")
            if len(text) > 100 and ("apiVersion" in text or "kind:" in text):
                texts.append(text)

        # Go code (analyzer patterns, kubectl internals)
        for f in repo_dir.rglob("*.go"):
            if not f.is_file():
                continue
            if "_test.go" in str(f) or "vendor/" in str(f):
                continue
            text = f.read_text(errors="ignore")
            if len(text) > 200:
                texts.append(text)

    return texts


def collect_text_from_jsonl(raw_dir: Path) -> list[str]:
    """Collect raw text from API-harvested JSONL files."""
    texts = []
    for jsonl in raw_dir.glob("*.jsonl"):
        # Skip HF datasets (they're structured, not raw text)
        hf_patterns = ["kubectl_", "so_k8s", "k8s_tool", "k8s_reason",
                        "cosmopedia", "k8s_cli", "k8s_config", "k8s_qa",
                        "k8s_command", "k8s_task", "k8s_docs_", "k8s_security",
                        "k8s_operator", "refusal"]
        if any(p in jsonl.name for p in hf_patterns):
            continue

        with open(jsonl) as f:
            for line in f:
                try:
                    doc = json.loads(line)
                    content = doc.get("content", "")
                    if len(content) > 200:
                        texts.append(strip_frontmatter(content))
                except json.JSONDecodeError:
                    continue

    return texts


def collect_so_text(raw_dir: Path) -> list[str]:
    """Collect StackOverflow answers as raw text for CPT."""
    texts = []
    so_file = raw_dir / "so_k8s.jsonl"
    if not so_file.exists():
        return texts

    with open(so_file) as f:
        for line in f:
            try:
                row = json.loads(line)
                # Get the answer text (raw, not formatted as instruction)
                answer = row.get("answer", row.get("accepted_answer", ""))
                if len(answer) > 200:
                    texts.append(answer)
            except json.JSONDecodeError:
                continue

    return texts


def chunk_texts(texts: list[str], chunk_size: int, min_length: int) -> list[str]:
    """Concatenate texts and split into fixed-size chunks."""
    # Join all texts with double newline separator
    full_text = "\n\n".join(texts)

    # Approximate tokenization: 1 token ≈ 4 characters
    char_chunk = chunk_size * 4
    chunks = []

    for i in range(0, len(full_text), char_chunk):
        chunk = full_text[i:i + char_chunk]
        # Try to break at a newline to avoid cutting mid-sentence
        if i + char_chunk < len(full_text):
            last_nl = chunk.rfind("\n")
            if last_nl > char_chunk * 0.8:  # Only if we don't lose too much
                chunk = chunk[:last_nl]

        if len(chunk) >= min_length:
            chunks.append(chunk)

    return chunks


def main():
    parser = argparse.ArgumentParser(description="Prepare CPT corpus for Kubi-1")
    parser.add_argument("--chunk-size", type=int, default=4096,
                        help="Target chunk size in tokens (default: 4096)")
    parser.add_argument("--min-length", type=int, default=200,
                        help="Minimum chunk length in chars (default: 200)")
    parser.add_argument("--no-replay", action="store_true",
                        help="Skip general replay text (not recommended)")
    args = parser.parse_args()

    print("=" * 60)
    print("  Kubi-1 Continued Pretraining Corpus Builder")
    print("=" * 60)

    all_texts = []

    # Source 1: Cloned repos
    repos_dir = RAW / "repos"
    repo_texts = collect_text_from_repos(repos_dir)
    print(f"  Cloned repos: {len(repo_texts)} documents")
    all_texts.extend(repo_texts)

    # Source 2: API-harvested JSONL
    api_texts = collect_text_from_jsonl(RAW)
    print(f"  API harvest:  {len(api_texts)} documents")
    all_texts.extend(api_texts)

    # Source 3: StackOverflow answers (raw text, not Q&A format)
    so_texts = collect_so_text(RAW)
    print(f"  StackOverflow: {len(so_texts)} answers")
    all_texts.extend(so_texts)

    if not all_texts:
        print("\n  No data found. Run clone_repos.sh and harvest_k8s.py first.")
        return

    # Source 4: General Replay (20-30% of corpus to prevent catastrophic forgetting)
    # Uses HuggingFace's FineWeb subset for general English text
    # Token-based targeting: measure K8s chars, add 25% worth of general text
    if not args.no_replay:
        try:
            from datasets import load_dataset
            k8s_chars = sum(len(t) for t in all_texts)
            replay_target_chars = int(k8s_chars * 0.25)  # 25% by token volume
            print(f"\n  Loading general replay (~{replay_target_chars // 4000:.0f}K tokens, 25% of {k8s_chars // 4000:.0f}K K8s tokens)...")
            replay_ds = load_dataset("HuggingFaceFW/fineweb-edu",
                                     name="sample-10BT", split="train",
                                     streaming=True)
            replay_chars = 0
            replay_count = 0
            for row in replay_ds:
                text = row.get("text", "")
                if len(text) > 200:
                    all_texts.append(text)
                    replay_chars += len(text)
                    replay_count += 1
                if replay_chars >= replay_target_chars:
                    break
            print(f"  General replay: {replay_count} docs, ~{replay_chars // 4000:.0f}K tokens added")
        except Exception as e:
            print(f"  General replay skipped: {e}")

    # Chunk
    print(f"\n  Total documents: {len(all_texts)}")
    total_chars = sum(len(t) for t in all_texts)
    print(f"  Total characters: {total_chars:,} (~{total_chars // 4:,} tokens)")

    chunks = chunk_texts(all_texts, args.chunk_size, args.min_length)
    print(f"  Chunks ({args.chunk_size} tokens each): {len(chunks)}")

    # Save
    out_file = FINAL / "cpt_corpus.jsonl"
    with open(out_file, "w") as f:
        for chunk in chunks:
            f.write(json.dumps({"text": chunk}, ensure_ascii=False) + "\n")

    print(f"\n  Saved to: {out_file}")
    print(f"  Use this for Phase 1 (Continued Pretraining) in train_kubi1.py")


if __name__ == "__main__":
    main()
