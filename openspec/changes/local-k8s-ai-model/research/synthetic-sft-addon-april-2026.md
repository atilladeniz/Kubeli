# Synthetic SFT Addon Strategy — April 2026

## Summary

NeMo DataDesigner is most relevant for **SFT augmentation**, not for CPT.

Why:
- CPT benefits from large volumes of raw domain text.
- DataDesigner is strongest when generating or validating **instruction-style pairs** with controlled answer formats.
- Our highest-value missing supervision is not more raw K8s prose, but better examples for:
  - log and event diagnosis
  - pod status interpretation
  - YAML / manifest mistake explanation
  - identity / refusal / scope behavior
  - concise "analysis first" answers for Kubeli

## Practical decision for v1

For the current Kubi-1 run, we do **not** introduce a full NeMo DataDesigner dependency.

Instead, we add a small high-value synthetic addon set directly into
`.dev/kubi-1/data/prepare_sft_compact.py`.

This keeps the workflow:
- Hugging Face only
- reproducible on RunPod
- compatible with the current `CPT -> merged model -> compact SFT -> GGUF` path

## What the addon set covers

The synthetic addon focuses on the highest-ROI gaps in the original SFT set:

- CrashLoopBackOff with OOMKilled
- FailedMount / missing Secret
- Pending / FailedScheduling
- ImagePullBackOff with auth failures
- readiness probe failures
- DNS lookup failures
- x509 / CA trust failures
- PVC not bound
- Service selector mismatches
- targetPort / containerPort mismatches
- CreateContainerConfigError from missing ConfigMap
- "analysis first, commands only if asked"
- `kubectl only` format
- stronger off-topic refusal
- stronger secret-redaction / no-mutation behavior

## Why this is aligned with Kubeli

Kubeli already supplies runtime grounding:
- logs
- namespace / pod context
- system prompt constraints
- read-only / no-delete behavior
- secret redaction

Therefore the model does **not** need all live cluster facts baked into weights.

The synthetic addon should teach:
- how to interpret K8s failure patterns
- how to answer in the desired Kubeli style
- how to stay in scope

## v2 path with NeMo DataDesigner

If we expand this later, NeMo DataDesigner is a strong v2 option for:

1. generating 500-1500 more log-analysis pairs
2. generating YAML mutation / diagnosis examples
3. generating preference-style variants for later DPO/SimPO
4. validator-based filtering before merging into the main SFT set

Recommended v2 use:
- keep the hand-written compact addon as the quality anchor
- use DataDesigner for controlled expansion around the same schemas
- re-run quality filtering and evaluation before increasing weight

## Recommendation

For the current run:
- keep the ongoing CPT unchanged
- use the upgraded `prepare_sft_compact.py`
- run SFT on the compact dataset tomorrow

For the next iteration:
- consider a NeMo DataDesigner pipeline only after evaluating the v1 model on real Kubeli log-analysis cases
