#!/usr/bin/env python3
"""
K8s documentation harvester — downloads markdown, YAML, and Go code from
GitHub repos for Kubi-1 training data.

Uses GitHub Trees API for efficient fetching (1 API call per repo tree).
Also supports using Claude Code or Codex CLI for enhanced pair generation.

Usage:
  GITHUB_TOKEN=ghp_xxx python harvest_k8s.py
  GITHUB_TOKEN=ghp_xxx python harvest_k8s.py --repos kubernetes/website
  GITHUB_TOKEN=ghp_xxx python harvest_k8s.py --dry-run
"""

import argparse
import asyncio
import base64
import json
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path

try:
    import httpx
except ImportError:
    print("Install: pip install httpx")
    sys.exit(1)

TOKEN = os.environ.get("GITHUB_TOKEN", "")
API = "https://api.github.com"
OUT = Path(__file__).parent / "raw"
RATE_DELAY = 0.05  # seconds between API calls


@dataclass
class RepoSource:
    owner_repo: str
    branch: str = "main"
    paths: list[str] = field(default_factory=lambda: ["."])
    extensions: list[str] = field(default_factory=lambda: [".md"])
    license: str = "unknown"
    category: str = "docs"
    description: str = ""


# ─── Tier 1: Core Sources (must have) ────────────────────────────

TIER1 = [
    RepoSource(
        "kubernetes/website",
        paths=[
            "content/en/docs/tasks",
            "content/en/docs/concepts",
            "content/en/docs/tutorials",
            "content/en/docs/reference/kubectl",
            "content/en/docs/reference/kubernetes-api",
            "content/en/docs/setup",
            "content/en/docs/contribute",
        ],
        extensions=[".md"],
        license="CC-BY-4.0",
        category="official-docs",
        description="Official Kubernetes documentation — the gold standard",
    ),
    RepoSource(
        "k8sgpt-ai/k8sgpt",
        paths=["pkg/analyzer"],
        extensions=[".go", "_test.go"],
        license="Apache-2.0",
        category="analyzer-patterns",
        description="k8sgpt analyzer patterns — error detection logic in Go",
    ),
    RepoSource(
        "kubernetes/examples",
        paths=["."],
        extensions=[".md", ".yaml", ".yml"],
        license="Apache-2.0",
        category="examples",
        description="Official K8s example manifests and guides",
    ),
]

# ─── Tier 2: Troubleshooting & Tutorials ─────────────────────────

TIER2 = [
    RepoSource(
        "kubernauts/practical-kubernetes-problems",
        branch="master",
        extensions=[".md", ".yaml", ".yml"],
        license="OSS",
        category="troubleshooting",
        description="Real-world K8s troubleshooting scenarios",
    ),
    RepoSource(
        "iam-veeramalla/kubernetes-troubleshooting-zero-to-hero",
        extensions=[".md"],
        license="OSS",
        category="troubleshooting",
        description="Error walkthroughs: ImagePull, CrashLoop, OOM, etc.",
    ),
    RepoSource(
        "kelseyhightower/kubernetes-the-hard-way",
        paths=["docs"],
        extensions=[".md"],
        license="Apache-2.0",
        category="tutorial",
        description="The classic K8s setup tutorial",
    ),
    RepoSource(
        "mhausenblas/troubleshooting-k8s-apps",
        branch="master",
        extensions=[".md"],
        license="OSS",
        category="troubleshooting",
        description="Debugging guides for K8s applications",
    ),
    RepoSource(
        "kubernetes/kubectl",
        paths=["docs", "pkg"],
        extensions=[".md", ".go"],
        license="Apache-2.0",
        category="reference",
        description="kubectl source and docs — command behavior details",
    ),
]

# ─── Tier 3: Cloud Provider K8s Docs ─────────────────────────────

TIER3 = [
    RepoSource(
        "awsdocs/amazon-eks-user-guide",
        paths=["doc_source"],
        extensions=[".md"],
        license="CC-BY-SA-4.0",
        category="cloud-k8s",
        description="AWS EKS documentation",
    ),
    RepoSource(
        "MicrosoftDocs/azure-aks-docs",
        paths=["articles/aks"],
        extensions=[".md"],
        license="CC-BY-4.0",
        category="cloud-k8s",
        description="Azure AKS documentation",
    ),
]

ALL_SOURCES = TIER1 + TIER2 + TIER3


def headers():
    h = {"Accept": "application/vnd.github.v3+json", "User-Agent": "kubi-1-harvester"}
    if TOKEN:
        h["Authorization"] = f"token {TOKEN}"
    return h


async def get_tree(client: httpx.AsyncClient, owner_repo: str, branch: str) -> list:
    """Fetch full repository tree in a single API call."""
    for b in [branch, "main", "master"]:
        url = f"{API}/repos/{owner_repo}/git/trees/{b}?recursive=1"
        r = await client.get(url, headers=headers())
        if r.status_code == 200:
            data = r.json()
            if data.get("truncated"):
                print(f"  ⚠️  Tree truncated for {owner_repo}")
            return data.get("tree", [])
    print(f"  ❌ Could not fetch tree for {owner_repo} (tried {branch}/main/master)")
    return []


async def get_blob(client: httpx.AsyncClient, owner_repo: str, sha: str) -> str:
    """Fetch file content by blob SHA."""
    url = f"{API}/repos/{owner_repo}/git/blobs/{sha}"
    r = await client.get(url, headers=headers())
    r.raise_for_status()
    data = r.json()
    if data.get("encoding") == "base64":
        return base64.b64decode(data["content"]).decode("utf-8", errors="ignore")
    return data.get("content", "")


def matches_source(path: str, source: RepoSource) -> bool:
    """Check if file path matches source filters."""
    ext_ok = any(path.endswith(ext) for ext in source.extensions)
    path_ok = any(path.startswith(p) for p in source.paths)
    # Skip test fixtures, vendor, generated files
    skip = any(s in path for s in [
        "vendor/", "node_modules/", "testdata/", "_gen/", "hack/",
        "CHANGELOG", "LICENSE", ".github/",
    ])
    return ext_ok and path_ok and not skip


async def harvest_repo(client: httpx.AsyncClient, source: RepoSource) -> list[dict]:
    """Harvest all matching files from a single repo."""
    print(f"\n📦 {source.owner_repo}")
    print(f"   {source.description}")

    tree = await get_tree(client, source.owner_repo, source.branch)
    if not tree:
        return []

    matching = [f for f in tree if f["type"] == "blob" and matches_source(f["path"], source)]
    print(f"   Found {len(matching)} files matching filters")

    results = []
    for i, f in enumerate(matching):
        if i > 0 and i % 100 == 0:
            print(f"   Fetched {i}/{len(matching)}...")
        await asyncio.sleep(RATE_DELAY)
        try:
            content = await get_blob(client, source.owner_repo, f["sha"])
            # Skip tiny files (likely index pages or stubs)
            if len(content.strip()) < 50:
                continue
            results.append({
                "path": f["path"],
                "content": content,
                "source": source.owner_repo,
                "license": source.license,
                "category": source.category,
                "size": f.get("size", 0),
            })
        except Exception as e:
            print(f"   ⚠️  Failed: {f['path']}: {e}")

    return results


async def harvest_all(sources: list[RepoSource], dry_run: bool = False):
    """Harvest all configured sources."""
    OUT.mkdir(parents=True, exist_ok=True)

    print("═" * 60)
    print("  Kubi-1 K8s Documentation Harvester")
    print("═" * 60)
    if not TOKEN:
        print("⚠️  No GITHUB_TOKEN set — rate limit is 60 req/hour (will be slow)")
        print("   Set: export GITHUB_TOKEN=ghp_xxx")
    else:
        print("✅ Authenticated GitHub API (5000 req/hour)")
    print(f"   Sources: {len(sources)} repos")
    print(f"   Output:  {OUT}/")

    total_files = 0
    total_bytes = 0
    summary = []

    async with httpx.AsyncClient(timeout=30) as client:
        # Check rate limit
        rl_r = await client.get(f"{API}/rate_limit", headers=headers())
        if rl_r.status_code == 200:
            rl = rl_r.json()["resources"]["core"]
            print(f"   Rate limit: {rl['remaining']}/{rl['limit']} remaining")
            if rl["remaining"] < 100:
                print("   ⚠️  Low rate limit — consider waiting or using a token")

        for source in sources:
            if dry_run:
                tree = await get_tree(client, source.owner_repo, source.branch)
                matching = [f for f in tree if f["type"] == "blob" and matches_source(f["path"], source)]
                print(f"\n📦 {source.owner_repo}: {len(matching)} files would be harvested")
                summary.append((source.owner_repo, len(matching), source.license))
                continue

            results = await harvest_repo(client, source)

            # Save per-repo JSONL
            repo_slug = source.owner_repo.replace("/", "_")
            out_file = OUT / f"{repo_slug}.jsonl"
            with open(out_file, "w") as f:
                for doc in results:
                    f.write(json.dumps(doc, ensure_ascii=False) + "\n")

            total_files += len(results)
            total_bytes += sum(d.get("size", 0) for d in results)
            summary.append((source.owner_repo, len(results), source.license))
            print(f"   ✅ {len(results)} files → {out_file}")

    # Summary
    print(f"\n{'═' * 60}")
    print(f"  {'DRY RUN ' if dry_run else ''}Summary")
    print(f"{'═' * 60}")
    for repo, count, lic in summary:
        print(f"  {repo:50s} {count:>5} files  ({lic})")
    print(f"{'─' * 60}")
    print(f"  {'Total':50s} {total_files:>5} files  ({total_bytes / 1024:.0f} KB)")
    if not dry_run:
        print(f"\n  Next step: python convert_docs.py")


def main():
    parser = argparse.ArgumentParser(description="Harvest K8s docs from GitHub")
    parser.add_argument("--repos", nargs="*", help="Specific repos (owner/repo)")
    parser.add_argument("--tier", type=int, choices=[1, 2, 3], help="Only harvest this tier")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be fetched")
    args = parser.parse_args()

    sources = ALL_SOURCES
    if args.tier == 1:
        sources = TIER1
    elif args.tier == 2:
        sources = TIER2
    elif args.tier == 3:
        sources = TIER3
    if args.repos:
        sources = [s for s in ALL_SOURCES if s.owner_repo in args.repos]
        if not sources:
            available = [s.owner_repo for s in ALL_SOURCES]
            print(f"No match. Available: {available}")
            return

    asyncio.run(harvest_all(sources, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
