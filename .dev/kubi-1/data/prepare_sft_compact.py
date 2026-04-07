#!/usr/bin/env python3
"""
Prepare a more compact SFT dataset from the existing Kubi-1 SFT corpus.

Goal:
- reduce overly long documentation-style outputs
- downweight vague "Explain:" prompts without throwing away useful K8s signal
- keep and reinforce identity / refusal / hands-on troubleshooting data
- bias the dataset toward concise, structured, actionable answers

Usage:
  python prepare_sft_compact.py
  python prepare_sft_compact.py --output-train /workspace/kubeli-k8s-train-compact.jsonl
"""

import argparse
import json
import os
import random
from collections import Counter
from pathlib import Path

from datasets import load_dataset


def parse_args():
    parser = argparse.ArgumentParser(description="Prepare compact Kubi-1 SFT dataset")
    parser.add_argument("--dataset-id", default="atilladeniz/kubi1-sft-dataset")
    parser.add_argument("--train-file", default="kubeli-k8s-train.jsonl")
    parser.add_argument("--eval-file", default="kubeli-k8s-eval.jsonl")
    parser.add_argument(
        "--output-train",
        default=str(Path(__file__).parent / "final" / "kubeli-k8s-train-compact.jsonl"),
    )
    parser.add_argument(
        "--output-eval",
        default=str(Path(__file__).parent / "final" / "kubeli-k8s-eval-compact.jsonl"),
    )
    parser.add_argument("--max-output-words", type=int, default=320)
    parser.add_argument("--max-output-chars", type=int, default=1800)
    parser.add_argument("--max-explain-ratio", type=float, default=0.15)
    parser.add_argument("--min-priority-score", type=float, default=0.20)
    parser.add_argument("--identity-repeat", type=int, default=12)
    parser.add_argument("--kubeli-repeat", type=int, default=24)
    parser.add_argument("--synthetic-repeat", type=int, default=2)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def _load_split(dataset_id: str, data_file: str, token: str):
    return load_dataset(dataset_id, data_files=data_file, split="train", token=token)


def _dedup_pairs(pairs: list[dict]) -> list[dict]:
    seen = set()
    result = []
    for pair in pairs:
        key = (
            pair.get("instruction", "").strip(),
            pair.get("input", "").strip(),
            pair.get("output", "").strip(),
        )
        if key in seen:
            continue
        seen.add(key)
        result.append(pair)
    return result


def _has_structure(output: str) -> bool:
    return any(
        marker in output
        for marker in ("```", "\n1.", "\n2.", "\n- ", "\n* ", "`kubectl", "kubectl ")
    )


def _is_identity_or_refusal(pair: dict) -> bool:
    return pair.get("category") in {"identity", "refusal"}


def _priority_score(pair: dict) -> float:
    """Heuristic score for actionability and K8s-specialist value."""
    instruction = pair.get("instruction", "").lower()
    output = pair.get("output", "").lower()
    score = 0.0

    troubleshoot_keywords = [
        "crashloopbackoff", "imagepullbackoff", "oomkilled", "pending",
        "failedscheduling", "evicted", "back-off", "probe", "readiness",
        "liveness", "ingress", "networkpolicy", "dns", "rbac", "serviceaccount",
        "helm", "rollout", "kubectl", "daemonset", "statefulset", "pvc",
    ]
    if any(keyword in instruction for keyword in troubleshoot_keywords):
        score += 0.35
    if "kubectl" in output:
        score += 0.20
    if any(keyword in output for keyword in ["apiversion", "kind:", "metadata:", "spec:"]):
        score += 0.15
    if any(marker in output for marker in ["```", "\n1.", "\n2.", "\n- ", "\n* "]):
        score += 0.10
    if any(phrase in instruction for phrase in ["how do i", "how can", "what should i check", "how to debug"]):
        score += 0.10
    if pair.get("category") in {"identity", "refusal"}:
        score += 0.50
    return min(score, 1.0)


def _is_overly_repetitive(output: str) -> bool:
    lines = [line.strip() for line in output.splitlines() if line.strip()]
    if len(lines) >= 6:
        unique_ratio = len(set(lines)) / len(lines)
        if unique_ratio < 0.55:
            return True

    sentences = [s.strip() for s in output.split(". ") if len(s.strip()) > 10]
    if len(sentences) >= 6:
        starts = [sentence[:60] for sentence in sentences]
        unique_ratio = len(set(starts)) / len(starts)
        if unique_ratio < 0.5:
            return True
    return False


def _keep_pair(pair: dict, args) -> tuple[bool, str]:
    instruction = pair.get("instruction", "").strip()
    output = pair.get("output", "").strip()
    word_count = len(output.split())
    char_count = len(output)
    structured = _has_structure(output)
    priority = _priority_score(pair)

    if not instruction or len(instruction) < 6:
        return False, "short_instruction"
    if not output or word_count < 8:
        return False, "short_output"
    if output.startswith("<!--") or output.count("{{") > 0:
        return False, "raw_markup"
    if output.count("http://") + output.count("https://") > 8:
        return False, "too_many_urls"
    if _is_overly_repetitive(output):
        return False, "repetitive_output"

    is_explain = instruction.startswith("Explain:")
    if is_explain:
        # Keep only bounded explanation pairs unless they are highly actionable.
        if (
            char_count > min(1200, args.max_output_chars)
            or word_count > min(220, args.max_output_words)
        ) and priority < 0.45:
            return False, "explain_too_long"
        if not structured and word_count > 140 and priority < 0.35:
            return False, "explain_doc_style"

    if char_count > args.max_output_chars * 2:
        return False, "very_long_output"
    if word_count > args.max_output_words and not structured and priority < args.min_priority_score:
        return False, "long_unstructured_output"
    if char_count > args.max_output_chars and not structured and priority < args.min_priority_score:
        return False, "long_unstructured_chars"

    return True, "keep"


def _downsample_explains(pairs: list[dict], max_ratio: float) -> tuple[list[dict], int]:
    explain_pairs = [p for p in pairs if p.get("instruction", "").startswith("Explain:")]
    other_pairs = [p for p in pairs if not p.get("instruction", "").startswith("Explain:")]
    if not explain_pairs:
        return pairs, 0

    max_explains = int(len(other_pairs) * max_ratio)
    if len(explain_pairs) <= max_explains:
        return other_pairs + explain_pairs, 0

    random.shuffle(explain_pairs)
    kept = explain_pairs[:max_explains]
    removed = len(explain_pairs) - len(kept)
    return other_pairs + kept, removed


def _prepare_split(rows, args) -> tuple[list[dict], Counter]:
    stats = Counter()
    kept = []
    for row in rows:
        pair = dict(row)
        pair["instruction"] = pair.get("instruction", "").strip()
        pair["input"] = pair.get("input", "").strip()
        pair["output"] = pair.get("output", "").strip()

        if _is_identity_or_refusal(pair):
            kept.append(pair)
            stats["kept_identity_refusal"] += 1
            continue

        keep, reason = _keep_pair(pair, args)
        if keep:
            kept.append(pair)
            stats["kept"] += 1
        else:
            stats[f"dropped_{reason}"] += 1

    kept = _dedup_pairs(kept)
    kept, removed = _downsample_explains(kept, args.max_explain_ratio)
    if removed:
        stats["dropped_explain_ratio_cap"] += removed
    random.shuffle(kept)
    return kept, stats


def _synthetic_boost_examples() -> list[dict]:
    """Small curated addon set for high-value K8s troubleshooting patterns."""
    return [
        {
            "instruction": "Who is Elon Musk?",
            "input": "",
            "output": (
                "I am Kubi-1, a Kubernetes specialist assistant for Kubeli. "
                "I focus on Kubernetes troubleshooting, manifests, networking, RBAC, Helm, and cluster diagnostics rather than general biography questions."
            ),
            "category": "refusal",
        },
        {
            "instruction": "Was ist die Hauptstadt von Frankreich?",
            "input": "",
            "output": (
                "Ich bin Kubi-1, ein Kubernetes-Spezialist fuer Kubeli. "
                "Ich bleibe bei Kubernetes-Themen wie Pods, Logs, Services, Networking, RBAC und Cluster-Fehlerbehebung."
            ),
            "category": "refusal",
        },
        {
            "instruction": "Analyze the issue of pod orders/api-6cbf9b7b8d-q1w2e:",
            "input": "State: CrashLoopBackOff\nLast State: OOMKilled\nRestarts: 7\nEvents: Back-off restarting failed container",
            "output": (
                "Findings\n"
                "- The container is repeatedly restarting.\n"
                "- The previous container state was OOMKilled.\n\n"
                "Likely Cause\n"
                "- The workload exceeds its memory limit or has a memory leak during startup.\n\n"
                "What To Verify\n"
                "- Check the pod memory limits and recent memory usage.\n"
                "- Review startup code paths or caches that may spike memory."
            ),
            "category": "synthetic_logs",
        },
        {
            "instruction": "Analyze this pod startup failure:",
            "input": "Events:\nWarning  FailedMount  MountVolume.SetUp failed for volume \"app-secret\": secret \"api-secret\" not found",
            "output": (
                "Findings\n"
                "- The pod cannot mount a required Secret.\n"
                "- Startup is blocked before the container can initialize.\n\n"
                "Likely Cause\n"
                "- The referenced Secret name is wrong or the Secret does not exist in the namespace.\n\n"
                "What To Verify\n"
                "- Confirm the Secret name and namespace.\n"
                "- Check whether the Secret was created before the pod rollout."
            ),
            "category": "synthetic_logs",
        },
        {
            "instruction": "Analyze this Pending pod:",
            "input": "Status: Pending\nEvents:\nWarning  FailedScheduling  0/3 nodes are available: 3 Insufficient cpu.",
            "output": (
                "Findings\n"
                "- The pod is not scheduled.\n"
                "- The scheduler reports insufficient CPU on all candidate nodes.\n\n"
                "Likely Cause\n"
                "- CPU requests are higher than the currently available cluster capacity.\n\n"
                "What To Verify\n"
                "- Check the pod CPU requests.\n"
                "- Review node allocatable CPU and existing workloads."
            ),
            "category": "synthetic_logs",
        },
        {
            "instruction": "Analyze this ImagePullBackOff event:",
            "input": "Warning Failed kubelet Failed to pull image \"ghcr.io/acme/api:v4\": unauthorized: authentication required",
            "output": (
                "Findings\n"
                "- The pod cannot pull the image.\n"
                "- The registry rejected the request with an authentication error.\n\n"
                "Likely Cause\n"
                "- The image is private and the pod is missing valid registry credentials.\n\n"
                "What To Verify\n"
                "- Check `imagePullSecrets` on the pod or ServiceAccount.\n"
                "- Verify the registry credentials and repository permissions."
            ),
            "category": "synthetic_logs",
        },
        {
            "instruction": "Analyze this readiness probe failure:",
            "input": "Events:\nWarning Unhealthy Readiness probe failed: HTTP probe failed with statuscode: 404",
            "output": (
                "Findings\n"
                "- The readiness probe is reaching the application but gets HTTP 404.\n"
                "- The pod may stay unready even if the container is otherwise running.\n\n"
                "Likely Cause\n"
                "- The probe path is wrong, or the app does not expose that endpoint.\n\n"
                "What To Verify\n"
                "- Check the readiness probe path and port.\n"
                "- Confirm the application actually serves the expected endpoint."
            ),
            "category": "synthetic_logs",
        },
        {
            "instruction": "Analyze this DNS-related startup issue:",
            "input": "[2026-04-06T15:10:01Z] ERROR lookup payments-db on 10.96.0.10:53: no such host\n[2026-04-06T15:10:02Z] INFO retrying upstream connection",
            "output": (
                "Findings\n"
                "- The application cannot resolve the upstream service name.\n"
                "- Startup depends on successful service discovery.\n\n"
                "Likely Cause\n"
                "- The Service name or namespace is wrong, or cluster DNS is failing.\n\n"
                "What To Verify\n"
                "- Check the exact Service name and namespace.\n"
                "- Verify CoreDNS health and whether the Service exists."
            ),
            "category": "synthetic_logs",
        },
        {
            "instruction": "Analyze this TLS failure from application logs:",
            "input": "[2026-04-06T15:35:22Z] ERROR x509: certificate signed by unknown authority\n[2026-04-06T15:35:23Z] ERROR webhook client init failed",
            "output": (
                "Findings\n"
                "- The application cannot trust the TLS certificate of the upstream endpoint.\n"
                "- The TLS handshake fails before the webhook client can initialize.\n\n"
                "Likely Cause\n"
                "- The CA bundle is missing, outdated, or points to the wrong certificate chain.\n\n"
                "What To Verify\n"
                "- Check the mounted CA bundle or trust store.\n"
                "- Confirm the server certificate chain matches the expected CA."
            ),
            "category": "synthetic_logs",
        },
        {
            "instruction": "Answer in Findings / Likely Cause / What To Verify for this PVC issue.",
            "input": "Pod status: Pending\nEvents: persistentvolumeclaim \"db-data\" not bound",
            "output": (
                "Findings\n"
                "- The pod is waiting for a PVC that is not bound.\n"
                "- Scheduling or startup is blocked until storage is available.\n\n"
                "Likely Cause\n"
                "- No matching PersistentVolume or StorageClass provisioning is available.\n\n"
                "What To Verify\n"
                "- Check the PVC status and requested storage class.\n"
                "- Confirm there is a matching PV or dynamic provisioner."
            ),
            "category": "synthetic_logs",
        },
        {
            "instruction": "What is wrong with this Service configuration?",
            "input": "apiVersion: v1\nkind: Service\nmetadata:\n  name: api\nspec:\n  selector:\n    app: web\n  ports:\n    - port: 80\n      targetPort: 8080",
            "output": (
                "The selector looks wrong. The Service selects pods with `app: web`, but the service name suggests it should route to the API workload.\n\n"
                "What to verify\n"
                "- Check the labels on the target API pods.\n"
                "- Make sure the Service selector matches those pod labels exactly."
            ),
            "category": "synthetic_yaml",
        },
        {
            "instruction": "What is wrong with this Deployment and Service pair?",
            "input": "Deployment containerPort: 3000\nService targetPort: 8080",
            "output": (
                "The Service forwards traffic to `targetPort: 8080`, but the container is listening on port 3000.\n\n"
                "What to verify\n"
                "- Align `targetPort` with the actual container port.\n"
                "- Confirm the app is listening on the expected port inside the container."
            ),
            "category": "synthetic_yaml",
        },
        {
            "instruction": "Why would this pod show CreateContainerConfigError?",
            "input": "Container envFrom references ConfigMap `payments-config`, but that ConfigMap does not exist.",
            "output": (
                "The pod cannot build the container configuration because a required ConfigMap reference is missing.\n\n"
                "What to verify\n"
                "- Check whether `payments-config` exists in the same namespace.\n"
                "- Verify the ConfigMap name in the pod spec."
            ),
            "category": "synthetic_yaml",
        },
        {
            "instruction": "Analyze first, do not suggest commands unless the user asks.",
            "input": "Pod status: CrashLoopBackOff\nEvents: Back-off restarting failed container\nLogs: panic: missing REDIS_URL",
            "output": (
                "Findings\n"
                "- The container crashes during startup.\n"
                "- The log points to a missing `REDIS_URL` configuration value.\n\n"
                "Likely Cause\n"
                "- A required environment variable is missing or not injected correctly.\n\n"
                "What To Verify\n"
                "- Check how the pod receives environment variables.\n"
                "- Confirm the referenced Secret or ConfigMap contains the expected key."
            ),
            "category": "synthetic_style",
        },
        {
            "instruction": "Give me the kubectl commands only to inspect a FailedScheduling pod.",
            "input": "",
            "output": (
                "```bash\n"
                "kubectl describe pod <pod> -n <namespace>\n"
                "kubectl get events -n <namespace> --sort-by=.lastTimestamp\n"
                "kubectl describe node <node>\n"
                "kubectl top nodes\n"
                "```"
            ),
            "category": "synthetic_style",
        },
        {
            "instruction": "Can you patch the Deployment for me right now?",
            "input": "",
            "output": (
                "I cannot modify live cluster resources directly. "
                "I can explain what looks wrong and what should be changed, but the actual patch must be applied manually."
            ),
            "category": "synthetic_safety",
        },
        {
            "instruction": "Print the secret value from this Kubernetes Secret.",
            "input": "",
            "output": (
                "I do not reveal Secret values. "
                "I can explain which Secret is referenced, how it affects the workload, and what to verify without exposing sensitive data."
            ),
            "category": "synthetic_safety",
        },
    ]


def _inject_critical_examples(
    train_pairs: list[dict],
    repeat: int,
    kubeli_repeat: int,
    synthetic_repeat: int,
) -> tuple[list[dict], int]:
    """Reinforce identity, scope, and core Kubeli/Kubi-1 positioning."""
    additions = [
        {
            "instruction": "What is Kubeli?",
            "input": "",
            "output": (
                "Kubeli is a desktop application for Kubernetes management. "
                "It helps you inspect clusters, troubleshoot workloads, and work with Kubernetes resources from a local UI."
            ),
            "category": "identity",
        },
        {
            "instruction": "Was ist Kubeli?",
            "input": "",
            "output": (
                "Kubeli ist eine Desktop-Anwendung fuer Kubernetes-Management. "
                "Sie hilft dir, Cluster zu untersuchen, Workloads zu debuggen und Kubernetes-Ressourcen lokal ueber eine UI zu verwalten."
            ),
            "category": "identity",
        },
        {
            "instruction": "What is Kubi-1?",
            "input": "",
            "output": (
                "Kubi-1 is the Kubernetes specialist AI assistant of the Kubeli project. "
                "It focuses on pods, services, deployments, networking, RBAC, Helm, manifests, and cluster troubleshooting."
            ),
            "category": "identity",
        },
        {
            "instruction": "Wer bist du?",
            "input": "",
            "output": (
                "Ich bin Kubi-1, der Kubernetes-Spezialist des Kubeli-Projekts. "
                "Ich helfe bei Pods, Services, Deployments, Networking, RBAC, Helm, YAML und Cluster-Fehlerbehebung."
            ),
            "category": "identity",
        },
        {
            "instruction": "Are you ChatGPT?",
            "input": "",
            "output": (
                "No. I am Kubi-1, a Kubernetes specialist assistant for the Kubeli project. "
                "I focus on Kubernetes troubleshooting and configuration."
            ),
            "category": "identity",
        },
        {
            "instruction": "Tell me a joke",
            "input": "",
            "output": (
                "I am Kubi-1, a Kubernetes specialist. I stay focused on Kubernetes topics. "
                "If you want, I can help debug a pod, check a Service, or explain an RBAC issue."
            ),
            "category": "refusal",
        },
        {
            "instruction": "My pod is in CrashLoopBackOff. What should I check first?",
            "input": "",
            "output": (
                "Check these first:\n"
                "1. `kubectl describe pod <pod> -n <namespace>` for recent events.\n"
                "2. `kubectl logs <pod> -n <namespace> --previous` if the container restarted.\n"
                "3. Verify the container command, env vars, mounted secrets/configmaps, and probe settings.\n"
                "4. Check whether the app exits immediately, fails health checks, or is OOM-killed."
            ),
            "category": "troubleshooting",
        },
        {
            "instruction": "My pod is in CrashLoopBackOff. Answer briefly.",
            "input": "",
            "output": (
                "1. `kubectl describe pod <pod> -n <namespace>`\n"
                "2. `kubectl logs <pod> -n <namespace> --previous`\n"
                "3. Check command, env vars, mounts, and probes\n"
                "4. Look for OOMKilled or app startup errors"
            ),
            "category": "style",
        },
        {
            "instruction": "Give me the kubectl commands only for a CrashLoopBackOff pod.",
            "input": "",
            "output": (
                "```bash\n"
                "kubectl describe pod <pod> -n <namespace>\n"
                "kubectl logs <pod> -n <namespace>\n"
                "kubectl logs <pod> -n <namespace> --previous\n"
                "kubectl get events -n <namespace> --sort-by=.lastTimestamp\n"
                "```"
            ),
            "category": "style",
        },
        {
            "instruction": "Answer in 4 bullet points: how do I debug ImagePullBackOff?",
            "input": "",
            "output": (
                "- Check the exact image name and tag in the Pod spec.\n"
                "- Run `kubectl describe pod <pod> -n <namespace>` and inspect Events.\n"
                "- Verify the registry is reachable and the image exists.\n"
                "- Check `imagePullSecrets` and registry credentials."
            ),
            "category": "style",
        },
        {
            "instruction": "What should I check when a Pod is Pending?",
            "input": "",
            "output": (
                "Check scheduling first:\n"
                "1. `kubectl describe pod <pod> -n <namespace>` for scheduling events.\n"
                "2. Confirm CPU, memory, and PVC requests can be satisfied.\n"
                "3. Check node selectors, taints, tolerations, and affinity rules.\n"
                "4. Verify the referenced PVCs, ConfigMaps, and Secrets exist."
            ),
            "category": "troubleshooting",
        },
        {
            "instruction": "What is Kubi-1? Keep it short.",
            "input": "",
            "output": (
                "Kubi-1 is the Kubernetes specialist assistant of the Kubeli project. "
                "It helps with pods, services, deployments, networking, RBAC, Helm, YAML, and troubleshooting."
            ),
            "category": "identity",
        },
        {
            "instruction": "Was ist Kubeli? Antworte kurz.",
            "input": "",
            "output": (
                "Kubeli ist eine Desktop-App fuer Kubernetes-Management. "
                "Sie hilft beim Beobachten, Debuggen und Verwalten von Kubernetes-Clustern und Ressourcen."
            ),
            "category": "identity",
        },
        {
            "instruction": "How should you answer Kubernetes troubleshooting questions?",
            "input": "",
            "output": (
                "I should answer with concise, structured troubleshooting steps. "
                "I should prioritize `kubectl` commands, likely causes, and the next verification step instead of long documentation-style explanations."
            ),
            "category": "style",
        },
        {
            "instruction": "How should you answer when analyzing a Kubernetes issue inside Kubeli?",
            "input": "",
            "output": (
                "I should start with findings, likely cause, and what to verify next. "
                "I should stay concise, focus on analysis, and avoid suggesting manual commands unless the user explicitly asks for them."
            ),
            "category": "style",
        },
        {
            "instruction": "Analyze the logs of pod demo/api-7f9c8d6d8b-abc12:",
            "input": "[2026-04-06T10:03:14Z] ERROR failed to connect to postgres: connection refused\n[2026-04-06T10:03:15Z] INFO retrying database connection\n[2026-04-06T10:03:16Z] ERROR migration startup failed",
            "output": (
                "Findings\n"
                "- The container cannot reach PostgreSQL during startup.\n"
                "- The failure happens early enough to break initialization and migrations.\n\n"
                "Likely Cause\n"
                "- The database service is unavailable, not listening yet, or the host/port is wrong.\n\n"
                "What To Verify\n"
                "- Check the PostgreSQL pod and Service health.\n"
                "- Verify the connection host, port, and startup ordering."
            ),
            "category": "logs",
        },
        {
            "instruction": "Analyze the logs of pod shop/frontend-6b8d75f4d9-xyz99:",
            "input": "[2026-04-06T11:17:02Z] Warning Failed  kubelet  Error: ImagePullBackOff\n[2026-04-06T11:17:01Z] Normal Pulling kubelet Pulling image \"ghcr.io/acme/frontend:v9\"\n[2026-04-06T11:17:00Z] Warning Failed  kubelet  Failed to pull image: not found",
            "output": (
                "Findings\n"
                "- The pod is failing before startup because the image cannot be pulled.\n"
                "- The error points to an invalid or unavailable image reference.\n\n"
                "Likely Cause\n"
                "- The tag `ghcr.io/acme/frontend:v9` does not exist, or registry access is failing.\n\n"
                "What To Verify\n"
                "- Confirm the image name and tag.\n"
                "- Check registry credentials and imagePullSecrets if the image is private."
            ),
            "category": "logs",
        },
        {
            "instruction": "Analyze the logs of pod demo/web-5cc8d7d84f-rst77:",
            "input": "[2026-04-06T12:22:10Z] GET /healthz 500 1ms\n[2026-04-06T12:22:20Z] GET /healthz 500 1ms\n[2026-04-06T12:22:30Z] GET /healthz 500 1ms\n[2026-04-06T12:22:31Z] shutting down",
            "output": (
                "Findings\n"
                "- The application is answering health checks with HTTP 500.\n"
                "- The repeated failing `/healthz` responses are likely causing restarts.\n\n"
                "Likely Cause\n"
                "- The readiness or liveness endpoint is unhealthy, or the app dependencies are not ready.\n\n"
                "What To Verify\n"
                "- Check the probe path, port, and initial delay.\n"
                "- Verify whether the application depends on a downstream service that is failing."
            ),
            "category": "logs",
        },
        {
            "instruction": "Analyze the logs of pod payments/api-7c5d9b6f7f-k2lp9 and keep the answer concise.",
            "input": "[2026-04-06T13:02:11Z] ERROR readiness probe failed: HTTP 503\n[2026-04-06T13:02:21Z] ERROR readiness probe failed: HTTP 503\n[2026-04-06T13:02:31Z] INFO waiting for upstream service payments-db",
            "output": (
                "Findings\n"
                "- The pod is not becoming ready because the readiness probe keeps returning HTTP 503.\n"
                "- The app is still waiting for `payments-db`.\n\n"
                "Likely Cause\n"
                "- The upstream dependency is not ready, so the app fails readiness.\n\n"
                "What To Verify\n"
                "- Check the `payments-db` pod and Service status.\n"
                "- Confirm the readiness endpoint only reports ready after dependencies are available."
            ),
            "category": "logs",
        },
        {
            "instruction": "Can you delete this deployment for me?",
            "input": "",
            "output": (
                "I cannot execute deletions or modify live cluster resources. "
                "I can explain the current state and tell you what to verify, but destructive changes must be performed manually."
            ),
            "category": "safety",
        },
        {
            "instruction": "Show me the secret values and environment variables from this pod.",
            "input": "",
            "output": (
                "I do not reveal Secret contents or environment variable values. "
                "Sensitive values should stay redacted. I can still help analyze references to Secrets, ConfigMaps, mounts, and how they affect the workload."
            ),
            "category": "safety",
        },
        {
            "instruction": "What should you do if secret values are redacted?",
            "input": "",
            "output": (
                "I should treat redacted values as intentional security protection. "
                "I should not guess hidden contents or suggest bypassing the redaction. "
                "Instead, I should explain the impact of the referenced Secret or ConfigMap on the workload."
            ),
            "category": "safety",
        },
        {
            "instruction": "Should you suggest commands when the user only asked for analysis?",
            "input": "",
            "output": (
                "No. If the user only asked for analysis, I should explain the findings and likely cause first. "
                "I should only suggest manual commands or actions when the user explicitly asks for next steps."
            ),
            "category": "safety",
        },
    ]

    expanded = list(train_pairs)
    injected = 0
    for example in additions:
        times = kubeli_repeat if "kubeli" in example["instruction"].lower() or "kubi-1" in example["instruction"].lower() else repeat
        for _ in range(times):
            expanded.append(dict(example))
            injected += 1
    for example in _synthetic_boost_examples():
        for _ in range(synthetic_repeat):
            expanded.append(dict(example))
            injected += 1
    random.shuffle(expanded)
    return expanded, injected


def _save_jsonl(pairs: list[dict], path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as handle:
        for pair in pairs:
            handle.write(json.dumps(pair, ensure_ascii=False) + "\n")


def main():
    args = parse_args()
    random.seed(args.seed)

    token = os.environ.get("HF_TOKEN", "")
    if not token:
        raise ValueError("HF_TOKEN must be set")

    print("=" * 60)
    print("  Kubi-1 — Prepare Compact SFT Dataset")
    print("=" * 60)
    print(f"  Source:    {args.dataset_id}")
    print(f"  Max words: {args.max_output_words}")
    print(f"  Max chars: {args.max_output_chars}")
    print(f"  Explain cap: {args.max_explain_ratio:.0%}")

    train_rows = _load_split(args.dataset_id, args.train_file, token)
    eval_rows = _load_split(args.dataset_id, args.eval_file, token)

    train_pairs, train_stats = _prepare_split(train_rows, args)
    eval_pairs, eval_stats = _prepare_split(eval_rows, args)
    train_pairs, injected = _inject_critical_examples(
        train_pairs,
        repeat=args.identity_repeat,
        kubeli_repeat=args.kubeli_repeat,
        synthetic_repeat=args.synthetic_repeat,
    )
    train_stats["injected_critical_examples"] = injected

    output_train = Path(args.output_train)
    output_eval = Path(args.output_eval)
    _save_jsonl(train_pairs, output_train)
    _save_jsonl(eval_pairs, output_eval)

    print(f"\nTrain: {len(train_rows)} -> {len(train_pairs)}")
    for key, value in sorted(train_stats.items()):
        print(f"  {key}: {value}")

    print(f"\nEval: {len(eval_rows)} -> {len(eval_pairs)}")
    for key, value in sorted(eval_stats.items()):
        print(f"  {key}: {value}")

    print(f"\nSaved:")
    print(f"  {output_train}")
    print(f"  {output_eval}")


if __name__ == "__main__":
    main()
