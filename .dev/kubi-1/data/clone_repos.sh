#!/bin/bash
# Clone K8s repos for training data — use this for large repos
# where the GitHub API tree fetching would be too slow or incomplete.
#
# Usage: ./clone_repos.sh [--all]
#        ./clone_repos.sh kubernetes/website
#
# The harvest_k8s.py script uses the GitHub API (good for small repos).
# This script does shallow git clones (good for large repos like kubernetes/website).

set -euo pipefail

RAW_DIR="$(cd "$(dirname "$0")" && pwd)/raw/repos"
mkdir -p "$RAW_DIR"

# ─── Repo Definitions ─────────────────────────────────────────────

declare -A REPOS
# Format: REPOS[name]="url|branch|paths"
# paths = space-separated list of directories to keep

REPOS[kubernetes-website]="https://github.com/kubernetes/website.git|main|content/en/docs"
REPOS[k8sgpt]="https://github.com/k8sgpt-ai/k8sgpt.git|main|pkg/analyzer"
REPOS[kubernetes-examples]="https://github.com/kubernetes/examples.git|master|."
REPOS[practical-k8s]="https://github.com/kubernauts/practical-kubernetes-problems.git|master|."
REPOS[k8s-troubleshoot]="https://github.com/iam-veeramalla/kubernetes-troubleshooting-zero-to-hero.git|main|."
REPOS[k8s-hard-way]="https://github.com/kelseyhightower/kubernetes-the-hard-way.git|master|docs"
REPOS[kubectl]="https://github.com/kubernetes/kubectl.git|master|docs pkg/cmd"
REPOS[k8s-website-de]="https://github.com/kubernetes/website.git|main|content/de/docs"

# ─── Functions ─────────────────────────────────────────────────────

clone_repo() {
    local name="$1"
    local spec="${REPOS[$name]}"
    IFS='|' read -r url branch paths <<< "$spec"

    local dest="$RAW_DIR/$name"

    if [ -d "$dest/.git" ]; then
        echo "  ⏭️  Already cloned: $name (use 'git -C $dest pull' to update)"
        return
    fi

    echo "  📦 Cloning $name ($url branch:$branch)"
    git clone --depth 1 --branch "$branch" --single-branch "$url" "$dest" 2>/dev/null || \
    git clone --depth 1 "$url" "$dest" 2>/dev/null

    # Show stats
    local file_count
    file_count=$(find "$dest" -type f \( -name "*.md" -o -name "*.yaml" -o -name "*.yml" -o -name "*.go" \) | wc -l | tr -d ' ')
    local size
    size=$(du -sh "$dest" | cut -f1)
    echo "  ✅ $name: $file_count relevant files, $size total"
}

# ─── Main ──────────────────────────────────────────────────────────

echo "═══════════════════════════════════════════════════"
echo "  Kubi-1: Clone K8s Repos for Training Data"
echo "═══════════════════════════════════════════════════"
echo "  Output: $RAW_DIR/"
echo ""

if [ "${1:-}" = "--all" ]; then
    for name in "${!REPOS[@]}"; do
        clone_repo "$name"
    done
elif [ -n "${1:-}" ]; then
    # Clone specific repo by matching name
    found=false
    for name in "${!REPOS[@]}"; do
        if [[ "$name" == *"$1"* ]] || [[ "${REPOS[$name]}" == *"$1"* ]]; then
            clone_repo "$name"
            found=true
        fi
    done
    if [ "$found" = false ]; then
        echo "No match for '$1'. Available:"
        for name in "${!REPOS[@]}"; do echo "  $name"; done
    fi
else
    echo "Usage:"
    echo "  $0 --all                  # Clone all repos"
    echo "  $0 kubernetes-website     # Clone specific repo"
    echo "  $0 kubernetes/website     # Match by URL fragment"
    echo ""
    echo "Available repos:"
    for name in $(echo "${!REPOS[@]}" | tr ' ' '\n' | sort); do
        local_spec="${REPOS[$name]}"
        IFS='|' read -r url _ _ <<< "$local_spec"
        exists=""
        [ -d "$RAW_DIR/$name/.git" ] && exists=" ✅"
        echo "  $name${exists}"
        echo "    $url"
    done
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "After cloning, run: python convert_docs.py"
echo "═══════════════════════════════════════════════════"
