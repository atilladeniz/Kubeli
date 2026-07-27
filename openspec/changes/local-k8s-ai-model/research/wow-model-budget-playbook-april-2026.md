# Building a "Wow" Local Specialist Model on a Budget

## Summary

The highest-ROI path to a strong local specialist model is **not** maximum training volume.

For small and mid-size local models, the strongest product outcome usually comes from:

1. a strong base model
2. a narrowly justified CPT pass only where domain language truly matters
3. high-quality SFT with consistent behavior and answer format
4. strong runtime grounding from the application
5. disciplined evaluation on real product cases

For Kubeli, this means the "wow" effect should come from the combination of:

- K8s-aware weights
- concise and stable SFT behavior
- runtime context from logs, pods, events, namespaces, and safety constraints

The model alone should not be expected to carry the entire product.

## What professionals optimize for

Teams building strong budget-efficient assistants usually optimize for:

- **behavioral precision over raw model size**
- **high-signal datasets over large noisy datasets**
- **real product tasks over generic benchmark-style prompts**
- **few strong iterations over one oversized training run**

The practical pattern is:

- choose a strong open base
- run the minimum useful domain adaptation
- invest heavily in curation, style control, and evaluation
- use runtime grounding to provide fresh facts

## The budget path with the highest ROI

### 1. Start from a strong base

Do not waste budget trying to rescue a weak base model.

For Kubeli, `Qwen3-4B-Base` is a sensible base because it is:

- small enough for local and low-cost tuning
- strong enough to support specialist behavior
- flexible for CPT + SFT

### 2. Use CPT only when domain language truly matters

CPT is worth the cost when the product depends on:

- domain-specific terminology
- structured artifacts such as YAML
- command patterns such as `kubectl`
- troubleshooting logs and cluster failure language

This is exactly the case for Kubeli.

However, CPT should remain scoped and economical:

- enough to shift distribution toward Kubernetes
- not so large that it dominates budget and iteration speed

### 3. Treat SFT as the main quality lever

For budget-constrained specialist models, SFT is usually the largest product-quality lever.

SFT should define:

- identity
- scope
- refusal behavior
- answer brevity
- diagnostic structure
- app-aligned safety behavior

For Kubeli, that means:

- short, structured K8s troubleshooting answers
- analysis first
- commands only when requested
- no secret disclosure
- no pretending to execute destructive actions

### 4. Keep training format and inference format aligned

A model can be trained well and still look bad at inference if:

- chat template differs from training
- stop tokens are wrong
- PAD/EOS are misconfigured
- decoding parameters are poor

This is one of the most common causes of repetition, endless outputs, or broken identity.

### 5. Use runtime grounding aggressively

A strong local specialist product should not rely on memorization alone.

For Kubeli, the application already has the right architecture for this:

- system prompt
- pod and namespace context
- logs
- failure context
- read-only constraints
- secret redaction rules

This is the correct separation of concerns:

- training teaches the model how to think and answer
- runtime grounding provides the live facts

## What actually creates a "wow" effect

The "wow" moment in a specialist assistant usually comes from:

- recognizing the failure pattern quickly
- naming the likely cause correctly
- staying concise
- proposing the right next verification step
- avoiding filler

That means the model should feel:

- specific
- grounded
- decisive
- safe
- fast

For Kubeli, the best examples of this are:

- CrashLoopBackOff diagnosis
- ImagePullBackOff diagnosis
- FailedScheduling interpretation
- readiness/liveness probe failures
- DNS and Service resolution issues
- PVC / storage binding issues
- RBAC or auth failures

## The highest-value data types

The most valuable data for the Kubeli product are:

1. **log and event diagnosis**
2. **pod status and scheduler failure interpretation**
3. **YAML and Service/selector/port mismatch explanations**
4. **identity, refusal, and scope-control examples**
5. **short structured answers in app-like formats**

These are more valuable than generic explanatory Kubernetes text.

## The strongest budget-friendly strategy

The best practical path for Kubeli is:

1. one successful domain-aware CPT pass
2. one strong compact SFT pass
3. direct evaluation on real Kubeli use cases
4. targeted SFT repair data from failure cases
5. a second smaller refinement pass if needed

This usually beats:

- very long CPT runs
- giant noisy SFT corpora
- expensive RLHF-style pipelines too early

## What to watch closely

### Data quality

Watch for:

- long documentation-style answers
- repetitive examples
- mixed or contradictory identity behavior
- non-K8s generic assistant behavior
- examples that reward verbosity instead of diagnostic clarity

### Inference alignment

Watch for:

- wrong chat template
- wrong stop tokens
- PAD/EOS collisions
- greedy decoding or poor sampling settings

### Product mismatch

Watch for:

- too much command-first behavior inside an analysis-first UI
- overfitting to synthetic examples that do not resemble Kubeli requests
- behavior that ignores runtime constraints

## What not to over-invest in too early

Avoid early over-investment in:

- oversized CPT runs
- large-scale RLHF/PPO
- preference optimization before basic SFT quality is proven
- large synthetic expansion before baseline evaluation is complete

For budget-sensitive local products, these are usually second-order improvements.

## Practical recommendation for Kubeli

The best near-term path is:

1. finish the current budget SFT run
2. export and test `Q5_K_M` first
3. evaluate on real Kubeli troubleshooting cases
4. collect 50-200 concrete failures
5. build a small repair dataset and run a focused v2 refinement

## Guiding principle

The goal is not to make the model know everything.

The goal is to make the model:

- excellent within a narrow domain
- consistent in identity and scope
- strong at diagnosis
- aligned with the actual product workflow

That is what usually creates a "wow" experience on a budget.
