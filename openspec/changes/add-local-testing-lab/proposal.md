# Change: Add Local Testing Lab for Simulated Environments

## Why
Testing Kubeli across EKS, OpenShift, Flux, and large clusters is expensive and slow if it requires real
cloud providers. We need a repeatable local lab so contributors can validate environment detection and
UX flows without paid clusters.

## What Changes
- Define a local testing lab that simulates Flux, OpenShift, cloud-provider contexts, auth failures, and
  scale using Minikube plus repo-managed manifests.
- Add Makefile targets and helper scripts to provision and clean these scenarios.
- Document prerequisites, commands, and expected results.

## Impact
- Affected specs: local-testing (new)
- Affected code:
  - `Makefile`
  - `.dev/k8s-samples/`
  - `.dev/README.md` or `README.md`
  - `scripts/` (if kubeconfig helpers are added)
