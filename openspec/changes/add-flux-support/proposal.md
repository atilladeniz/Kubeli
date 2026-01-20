# Change: Add Flux Support for Helm Releases

## Why

Flux-managed HelmRelease resources are not visible in the Helm list today, which blocks GitOps users from seeing their releases.

## What Changes

- Read Flux HelmRelease CRDs and include them in the Helm releases list.
- Mark Flux-managed releases in the UI (badge/label).
- Provide a local test script that creates fake Flux HelmRelease resources in Minikube.

## Impact

- Affected specs: helm-integration
- Affected code:
  - `src-tauri` kube client and helm commands
  - `src` Helm list UI
  - `scripts` (local test setup)
