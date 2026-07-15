#!/usr/bin/env python3
"""
Generate refusal training examples for non-K8s topics.
Teaches Kubi-1 to politely decline questions outside Kubernetes.

Usage:
  python generate_refusals.py
  python generate_refusals.py --count 5000
"""

import argparse
import json
import random
from pathlib import Path

OUT = Path(__file__).parent / "processed"
OUT.mkdir(parents=True, exist_ok=True)

# ─── Non-K8s question templates ───────────────────────────────────

PEOPLE = ["Elon Musk", "Taylor Swift", "Donald Trump", "Angela Merkel",
          "Jeff Bezos", "Mark Zuckerberg", "Bill Gates", "Barack Obama",
          "Cristiano Ronaldo", "Albert Einstein"]
COUNTRIES = ["the United States", "Germany", "France", "Japan", "China",
             "Brazil", "India", "Russia", "Australia", "Canada"]
CITIES = ["Berlin", "New York", "Tokyo", "London", "Paris", "Sydney"]
FOODS = ["pasta", "sushi", "pizza", "cake", "curry", "tacos"]
LANGUAGES = ["Python", "Java", "JavaScript", "Go", "C++", "Ruby"]
GENRES = ["sci-fi", "romance", "thriller", "comedy", "horror"]

NON_K8S_TEMPLATES = [
    "Who is {person}?",
    "Tell me about {person}",
    "What did {person} do?",
    "Who is the president of {country}?",
    "What's the capital of {country}?",
    "What's the weather in {city}?",
    "How do I make {food}?",
    "Give me a recipe for {food}",
    "Recommend a good {genre} movie",
    "Write me a poem about love",
    "Write a short story about a dragon",
    "What year did World War 2 end?",
    "How far is the moon from Earth?",
    "What is the meaning of life?",
    "Tell me a joke",
    "How do I lose weight?",
    "What stocks should I buy?",
    "Explain quantum physics",
    "Who won the last Super Bowl?",
    "What's the best programming language?",
    "How do I sort a list in {language}?",
    "Write a {language} function that reverses a string",
    "Explain how a neural network works",
    "What is blockchain?",
    "How do I fix my WiFi?",
    "Translate 'hello' to German",
    "What is the GDP of {country}?",
    "How do I start a business?",
    "What are the symptoms of a cold?",
    "How do I train a dog?",
]

REFUSAL_RESPONSES = [
    "I'm Kubi-1, a Kubernetes specialist. I can help with pods, services, deployments, networking, RBAC, Helm, and cluster troubleshooting. What K8s question do you have?",
    "That's outside my area. I'm built for Kubernetes — ask me about cluster issues, debugging, deployments, or K8s configuration.",
    "I focus on Kubernetes. I can help you troubleshoot pods, analyze logs, debug networking, or explain K8s concepts. What cluster issue are you working on?",
    "I'm Kubi-1 — I work with Kubernetes clusters. Ask me about CrashLoopBackOff, OOMKilled, image pull errors, RBAC, Helm charts, or anything else in your cluster.",
    "I don't cover that topic. I'm a K8s specialist — I know pods, services, ingress, storage, RBAC, and everything else that runs in a Kubernetes cluster.",
    "Not my area. I'm Kubi-1, trained on Kubernetes documentation, StackOverflow K8s answers, and real cluster diagnostics. What can I help you debug?",
]

# ─── K8s-adjacent: partial help ───────────────────────────────────

ADJACENT_PAIRS = [
    {"instruction": "Can you help me write Python code?",
     "output": "I can help with Python when it's K8s-related — Kubernetes client scripts, parsing kubectl output, writing operators, or Helm template logic. What's the K8s use case?"},
    {"instruction": "How do I use Docker?",
     "output": "I can help with Docker in a K8s context — building images for pods, debugging ImagePullBackOff, multi-stage builds for smaller images, or setting up a registry. What are you deploying?"},
    {"instruction": "Explain YAML syntax",
     "output": "I know YAML in the context of Kubernetes manifests — pod specs, service definitions, deployments, configmaps, secrets, and custom resources. Show me the YAML and I'll help."},
    {"instruction": "How does networking work?",
     "output": "I can explain Kubernetes networking: pod-to-pod communication, services (ClusterIP, NodePort, LoadBalancer), ingress controllers, network policies, DNS resolution, and CNI plugins. Which part?"},
    {"instruction": "What is a load balancer?",
     "output": "In Kubernetes, a LoadBalancer service provisions an external load balancer (on cloud providers) that routes traffic to your pods. I can explain how to configure one, or help with ingress as an alternative."},
    {"instruction": "How do I set up CI/CD?",
     "output": "I can help with the Kubernetes side of CI/CD — deploying to clusters from pipelines, Helm chart releases, ArgoCD/Flux GitOps, rolling updates, and canary deployments. What's your setup?"},
    {"instruction": "What is a REST API?",
     "output": "I can explain the Kubernetes API server — it's a REST API that manages all cluster resources. I can help with kubectl commands, API groups, resource versions, and custom resources. What do you need?"},
    {"instruction": "How do I use Git?",
     "output": "I can help with Git in K8s context — GitOps workflows with ArgoCD or Flux, storing Helm charts in Git, managing K8s manifests in repos. What's the K8s connection?"},
]


def fill_template(template: str) -> str:
    """Fill a template with random values."""
    result = template
    if "{person}" in result:
        result = result.replace("{person}", random.choice(PEOPLE))
    if "{country}" in result:
        result = result.replace("{country}", random.choice(COUNTRIES))
    if "{city}" in result:
        result = result.replace("{city}", random.choice(CITIES))
    if "{food}" in result:
        result = result.replace("{food}", random.choice(FOODS))
    if "{language}" in result:
        result = result.replace("{language}", random.choice(LANGUAGES))
    if "{genre}" in result:
        result = result.replace("{genre}", random.choice(GENRES))
    return result


def generate(count: int) -> list[dict]:
    """Generate refusal training examples."""
    pairs = []
    seen = set()

    # Hard refusals (non-K8s)
    target_refusals = int(count * 0.85)
    attempts = 0
    while len(pairs) < target_refusals and attempts < count * 10:
        attempts += 1
        template = random.choice(NON_K8S_TEMPLATES)
        question = fill_template(template)
        if question in seen:
            continue
        seen.add(question)
        pairs.append({
            "instruction": question,
            "input": "",
            "output": random.choice(REFUSAL_RESPONSES),
            "source": "synthetic-refusal",
            "category": "refusal",
        })

    # Soft refusals / K8s-adjacent
    for adj in ADJACENT_PAIRS:
        pairs.append({
            "instruction": adj["instruction"],
            "input": "",
            "output": adj["output"],
            "source": "synthetic-refusal",
            "category": "adjacent",
        })

    # Pad remaining with more refusals (with max attempts to avoid infinite loop)
    attempts = 0
    while len(pairs) < count and attempts < count * 10:
        attempts += 1
        template = random.choice(NON_K8S_TEMPLATES)
        question = fill_template(template)
        if question not in seen:
            seen.add(question)
            pairs.append({
                "instruction": question,
                "input": "",
                "output": random.choice(REFUSAL_RESPONSES),
                "source": "synthetic-refusal",
                "category": "refusal",
            })

    random.shuffle(pairs)
    return pairs


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=5000, help="Number of refusal examples")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    random.seed(args.seed)

    print("=" * 50)
    print("  Kubi-1 Refusal Training Data Generator")
    print("=" * 50)

    pairs = generate(args.count)

    # Stats
    categories = {}
    for p in pairs:
        cat = p["category"]
        categories[cat] = categories.get(cat, 0) + 1
    print(f"  Generated {len(pairs)} examples:")
    for cat, count in sorted(categories.items()):
        print(f"    {cat}: {count}")

    out_file = OUT / "refusals.jsonl"
    with open(out_file, "w") as f:
        for p in pairs:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")

    print(f"\n  Saved to: {out_file}")
    print(f"  Mix these into SFT data at ~10-15% ratio")


if __name__ == "__main__":
    main()
