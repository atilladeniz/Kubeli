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
    """Convert all harvested markdown to instruction pairs.

    Handles two sources:
    1. JSONL files from harvest_k8s.py (GitHub API)
    2. Cloned repos from clone_repos.sh (git clone)
    """
    all_pairs = []

    # --- Source 1: JSONL from GitHub API harvester ---
    for jsonl_file in RAW.glob("*.jsonl"):
        # Skip HF datasets — handled separately
        hf_names = [d.slug for d in __import__('importlib').import_module('load_hf_datasets').DATASETS] \
            if False else []  # Avoid circular import
        skip_patterns = ["kubectl_", "so_k8s", "k8s_tool", "k8s_reason", "cosmopedia",
                         "k8s_cli", "k8s_config", "k8s_qa", "k8s_command", "k8s_task",
                         "k8s_docs_", "k8s_security", "k8s_operator"]
        if any(p in jsonl_file.name for p in skip_patterns):
            continue

        print(f"\n📄 Processing API harvest: {jsonl_file.name}")
        count = 0

        with open(jsonl_file) as f:
            for line in f:
                doc = json.loads(line)
                if not doc.get("content"):
                    continue
                if not doc["path"].endswith(".md"):
                    continue

                text = strip_frontmatter(doc["content"])
                sections = extract_sections(text)

                for section in sections:
                    pairs = section_to_pairs(section, f"{doc['source']}/{doc['path']}")
                    all_pairs.extend(pairs)
                    count += len(pairs)

        print(f"   Generated {count} pairs")

    # --- Source 2: Cloned repos ---
    repos_dir = RAW / "repos"
    if repos_dir.exists():
        for repo_dir in sorted(repos_dir.iterdir()):
            if not repo_dir.is_dir() or repo_dir.name.startswith("."):
                continue

            md_files = list(repo_dir.rglob("*.md"))
            # Skip test files, changelogs, etc.
            md_files = [f for f in md_files if not any(
                s in str(f) for s in ["CHANGELOG", "LICENSE", "vendor/",
                                       "node_modules/", ".github/", "_test"]
            )]

            if not md_files:
                continue

            print(f"\n📄 Processing cloned repo: {repo_dir.name} ({len(md_files)} .md files)")
            count = 0

            for md_file in md_files:
                text = md_file.read_text(errors="ignore")
                text = strip_frontmatter(text)
                sections = extract_sections(text)

                for section in sections:
                    pairs = section_to_pairs(
                        section,
                        f"{repo_dir.name}/{md_file.relative_to(repo_dir)}"
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


# ─── HuggingFace Dataset Converters ──────────────────────────────


def convert_hf_passthrough():
    """Convert HF datasets that are already in instruction format.

    Many HF datasets (kubectl-cot-20k, tool-calling, reasoning, etc.)
    are already formatted. We normalize them to our Alpaca format.
    """
    HF_DATASETS = {
        "kubectl_cot_20k.jsonl": {
            "category": "kubectl",
            "source": "ComponentSoft/k8s-kubectl-cot-20k",
            "fields": {"instruction": ["instruction", "input", "question", "prompt"],
                       "output": ["output", "response", "answer", "completion"]},
        },
        "k8s_tool_calling_qwen.jsonl": {
            "category": "tool-calling",
            "source": "deepfabric/k8s-tool-calling-qwen",
            "fields": {"instruction": ["instruction", "input", "query"],
                       "output": ["output", "response"]},
        },
        "k8s_tool_calling.jsonl": {
            "category": "tool-calling",
            "source": "deepfabric/k8s-tool-calling",
            "fields": {"instruction": ["instruction", "input", "query"],
                       "output": ["output", "response"]},
        },
        "k8s_reasoning.jsonl": {
            "category": "troubleshooting",
            "source": "relai-ai/kubernetes-reasoning",
            "fields": {"instruction": ["instruction", "input", "question", "prompt"],
                       "output": ["output", "response", "answer"]},
        },
        "kubectl_35k.jsonl": {
            "category": "kubectl",
            "source": "ComponentSoft/k8s-kubectl-35k",
            "fields": {"instruction": ["instruction", "input"],
                       "output": ["output", "response"]},
        },
        "cosmopedia_k8s.jsonl": {
            "category": "concept",
            "source": "cosmopedia-kubernetes",
            "fields": {"instruction": ["prompt", "instruction", "title"],
                       "output": ["text", "output", "response", "completion"]},
        },
        "k8s_cli_20k.jsonl": {
            "category": "kubectl",
            "source": "dereklck/kubernetes_cli_dataset_20k",
            "fields": {"instruction": ["instruction", "input", "prompt"],
                       "output": ["output", "response"]},
        },
        "k8s_config.jsonl": {
            "category": "reference",
            "source": "HelloBoieeee/kubernetes_config",
            "fields": {"instruction": ["instruction", "input"],
                       "output": ["output", "response", "content"]},
        },
        "k8s_qa_pairs.jsonl": {
            "category": "troubleshooting",
            "source": "ItshMoh/kubernetes_qa_pairs",
            "fields": {"instruction": ["question", "instruction", "input"],
                       "output": ["answer", "output", "response"]},
        },
        "k8s_commands.jsonl": {
            "category": "kubectl",
            "source": "chowmean/kubernetes_commands",
            "fields": {"instruction": ["instruction", "input", "command_description"],
                       "output": ["output", "response", "command"]},
        },
    }

    total = 0
    for filename, config in HF_DATASETS.items():
        raw_file = RAW / filename
        if not raw_file.exists():
            continue

        print(f"\n📄 Processing HF: {filename}")
        pairs = []

        with open(raw_file) as f:
            for line in f:
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue

                # Find the instruction field
                instruction = ""
                for field in config["fields"]["instruction"]:
                    if field in row and row[field]:
                        instruction = str(row[field]).strip()
                        break

                # Find the output field
                output = ""
                for field in config["fields"]["output"]:
                    if field in row and row[field]:
                        output = str(row[field]).strip()
                        break

                if not instruction or not output:
                    continue
                if len(output) < 20:
                    continue

                pairs.append({
                    "instruction": instruction[:1000],
                    "input": "",
                    "output": output[:2000],
                    "source": config["source"],
                    "category": config["category"],
                })

        if pairs:
            out_file = OUT / f"hf_{filename}"
            with open(out_file, "w") as f:
                for pair in pairs:
                    f.write(json.dumps(pair, ensure_ascii=False) + "\n")
            print(f"   ✅ {len(pairs)} pairs → hf_{filename}")
            total += len(pairs)
        else:
            print(f"   ⚠️  No pairs extracted (check field names)")

    print(f"\n✅ Total HF pairs: {total}")
    return total


# ─── Main ─────────────────────────────────────────────────────────


if __name__ == "__main__":
    print("=" * 50)
    print("K8s Training Data Converter")
    print("=" * 50)

    total = 0
    total += convert_markdown_files()
    total += generate_k8sgpt_pairs()
    total += convert_stackoverflow()
    total += convert_hf_passthrough()

    print(f"\n{'=' * 50}")
    print(f"Grand total: {total} instruction pairs")
    print(f"Output: {OUT}/")
    print(f"Next: python merge_and_filter.py")
