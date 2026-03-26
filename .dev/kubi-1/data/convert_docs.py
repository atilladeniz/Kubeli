#!/usr/bin/env python3
"""
Convert harvested K8s markdown docs to instruction-response pairs (Alpaca format).
Also converts k8sgpt Go analyzer patterns to error→diagnosis pairs.

Usage:
  python convert_docs.py
"""

import json
import re
from pathlib import Path

RAW = Path(__file__).parent / "raw"
OUT = Path(__file__).parent / "processed"
OUT.mkdir(parents=True, exist_ok=True)


# ─── Markdown → Instruction Pairs ────────────────────────────────


def strip_frontmatter(text: str) -> str:
    """Remove Hugo/Docusaurus frontmatter."""
    return re.sub(r"^---\n.*?\n---\n", "", text, flags=re.DOTALL)


def extract_sections(text: str) -> list[dict]:
    """Split markdown by H2/H3 headings into chunks."""
    sections = []
    current = {"title": "", "content": "", "level": 0}

    for line in text.split("\n"):
        if line.startswith("### "):
            if current["content"].strip():
                sections.append(current)
            current = {"title": line.lstrip("#").strip(), "content": "", "level": 3}
        elif line.startswith("## "):
            if current["content"].strip():
                sections.append(current)
            current = {"title": line.lstrip("#").strip(), "content": "", "level": 2}
        else:
            current["content"] += line + "\n"

    if current["content"].strip():
        sections.append(current)
    return sections


def classify_section(title: str) -> str:
    """Classify section by topic."""
    t = title.lower()
    if any(w in t for w in ["debug", "troubleshoot", "error", "fix", "fail", "crash"]):
        return "troubleshooting"
    if any(w in t for w in ["how to", "create", "configure", "setup", "install", "deploy"]):
        return "howto"
    if any(w in t for w in ["what is", "concept", "overview", "architecture", "introduction"]):
        return "concept"
    if any(w in t for w in ["kubectl", "command", "flag", "option"]):
        return "reference"
    return "general"


def section_to_pairs(section: dict, source: str) -> list[dict]:
    """Generate instruction-response pairs from a doc section."""
    content = section["content"].strip()
    title = section["title"]

    # Skip too short sections
    if len(content) < 100:
        return []

    # Skip pure table-of-contents or link lists
    if content.count("[") > content.count("\n") * 0.8:
        return []

    pairs = []
    category = classify_section(title)

    # Main pair: explain the topic
    pairs.append({
        "instruction": f"Explain: {title}",
        "input": "",
        "output": content[:2000],  # Cap at ~500 tokens
        "source": source,
        "category": category,
    })

    # If troubleshooting section, also create a "how to fix" pair
    if category == "troubleshooting":
        pairs.append({
            "instruction": f"How do I fix issues related to: {title}?",
            "input": "",
            "output": content[:2000],
            "source": source,
            "category": "troubleshooting",
        })

    return pairs


def convert_markdown_files():
    """Convert all harvested markdown to instruction pairs."""
    all_pairs = []

    for jsonl_file in RAW.glob("*.jsonl"):
        if "kubectl_35k" in jsonl_file.name or "so_k8s" in jsonl_file.name:
            continue  # Skip HF datasets — handled separately

        print(f"\n📄 Processing: {jsonl_file.name}")
        count = 0

        with open(jsonl_file) as f:
            for line in f:
                doc = json.loads(line)
                if not doc.get("content"):
                    continue

                # Only process markdown
                if not doc["path"].endswith(".md"):
                    continue

                text = strip_frontmatter(doc["content"])
                sections = extract_sections(text)

                for section in sections:
                    pairs = section_to_pairs(
                        section,
                        f"{doc['source']}/{doc['path']}"
                    )
                    all_pairs.extend(pairs)
                    count += len(pairs)

        print(f"   Generated {count} pairs")

    out_file = OUT / "k8s_docs.jsonl"
    with open(out_file, "w") as f:
        for pair in all_pairs:
            f.write(json.dumps(pair, ensure_ascii=False) + "\n")

    print(f"\n✅ Total: {len(all_pairs)} doc pairs → {out_file}")
    return len(all_pairs)


# ─── k8sgpt Go Analyzers → Error Patterns ────────────────────────


K8S_ERROR_PATTERNS = {
    "CrashLoopBackOff": "The container keeps crashing and Kubernetes is backing off before restarting it. Check container logs for the root cause — common issues include missing config, wrong entrypoint, or OOM kills.",
    "ImagePullBackOff": "Kubernetes cannot pull the container image. Verify the image name and tag exist, check registry credentials, and ensure the node has network access to the registry.",
    "OOMKilled": "The container was killed because it exceeded its memory limit. Increase the memory limit in the pod spec, or investigate the application for memory leaks.",
    "Pending": "The pod cannot be scheduled. Check if there are enough resources on nodes, if required PVCs are bound, and if node selectors or taints match.",
    "Evicted": "The pod was evicted due to node resource pressure (disk, memory, or PID). Check node conditions and consider increasing node resources.",
    "FailedScheduling": "The scheduler could not find a suitable node. Check resource requests, node affinity rules, taints/tolerations, and available node capacity.",
    "FailedMount": "A volume could not be mounted. Verify the PVC exists and is bound, check storage class provisioner, and ensure the node can access the storage backend.",
    "Unhealthy": "Health check (liveness or readiness probe) is failing. Verify the probe endpoint, port, and thresholds. The container may need more startup time.",
    "BackOff": "Kubernetes is backing off from an operation. This usually indicates a recurring failure — check the related events for the root cause.",
}


def generate_k8sgpt_pairs() -> int:
    """Generate instruction pairs from known K8s error patterns."""
    pairs = []

    for error, explanation in K8S_ERROR_PATTERNS.items():
        # Multiple instruction variants per error
        variants = [
            f"What does {error} mean in Kubernetes?",
            f"My pod shows {error}. What should I check?",
            f"How do I fix {error} in a Kubernetes pod?",
            f"Explain the Kubernetes error: {error}",
        ]
        for instruction in variants:
            pairs.append({
                "instruction": instruction,
                "input": "",
                "output": explanation,
                "source": "k8sgpt-patterns",
                "category": "troubleshooting",
            })

    # Also parse actual k8sgpt Go files if harvested
    k8sgpt_file = RAW / "k8sgpt-ai_k8sgpt.jsonl"
    if k8sgpt_file.exists():
        print(f"\n📄 Processing k8sgpt analyzer code")
        with open(k8sgpt_file) as f:
            for line in f:
                doc = json.loads(line)
                if doc["path"].endswith("_test.go"):
                    continue
                # Extract error messages from Go code
                content = doc.get("content", "")
                for match in re.finditer(r'Failure\s*{[^}]*Message:\s*"([^"]+)"', content):
                    msg = match.group(1)
                    if len(msg) > 20:
                        pairs.append({
                            "instruction": f"Explain this Kubernetes issue: {msg}",
                            "input": "",
                            "output": f"This error indicates: {msg}. Check the related Kubernetes resource configuration and events for more details.",
                            "source": f"k8sgpt-ai/k8sgpt/{doc['path']}",
                            "category": "troubleshooting",
                        })

    out_file = OUT / "k8sgpt_patterns.jsonl"
    with open(out_file, "w") as f:
        for pair in pairs:
            f.write(json.dumps(pair, ensure_ascii=False) + "\n")

    print(f"✅ {len(pairs)} k8sgpt pairs → {out_file}")
    return len(pairs)


# ─── StackOverflow Cleaning ───────────────────────────────────────


def convert_stackoverflow():
    """Clean and convert SO K8s dataset to instruction pairs."""
    so_file = RAW / "so_k8s.jsonl"
    if not so_file.exists():
        print("⏭️  Skipping SO dataset (not downloaded yet)")
        return 0

    print(f"\n📄 Processing StackOverflow K8s dataset")
    pairs = []

    with open(so_file) as f:
        for line in f:
            row = json.loads(line)
            # Adapt based on actual dataset schema
            title = row.get("title", row.get("question_title", ""))
            body = row.get("body", row.get("question_body", ""))
            answer = row.get("answer", row.get("accepted_answer", ""))

            if not title or not answer:
                continue
            if len(answer) < 50:
                continue

            pairs.append({
                "instruction": title,
                "input": body[:500] if body else "",
                "output": answer[:2000],
                "source": "stackoverflow",
                "category": "troubleshooting",
            })

    out_file = OUT / "so_cleaned.jsonl"
    with open(out_file, "w") as f:
        for pair in pairs:
            f.write(json.dumps(pair, ensure_ascii=False) + "\n")

    print(f"✅ {len(pairs)} SO pairs → {out_file}")
    return len(pairs)


# ─── Main ─────────────────────────────────────────────────────────


if __name__ == "__main__":
    print("=" * 50)
    print("K8s Training Data Converter")
    print("=" * 50)

    total = 0
    total += convert_markdown_files()
    total += generate_k8sgpt_pairs()
    total += convert_stackoverflow()

    print(f"\n{'=' * 50}")
    print(f"Grand total: {total} instruction pairs")
    print(f"Output: {OUT}/")
    print(f"Next: python merge_and_filter.py")
