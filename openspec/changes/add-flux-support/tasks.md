# Tasks: Flux Support

## 1. Backend

- [x] 1.1 Add Flux HelmRelease CRD client/types (kube-rs)
- [x] 1.2 Extend helm list command to include Flux HelmRelease resources
- [x] 1.3 Add `managed_by` field to HelmRelease model and IPC payload

## 2. Frontend

- [x] 2.1 Render a "Flux" badge in the Helm list when `managed_by=flux`
- [x] 2.2 Ensure filters and search include Flux-managed entries

## 3. Local Testing

- [x] 3.1 Add a Minikube script to apply Flux HelmRelease CRDs and sample data
- [ ] 3.2 Document local test steps (scripts README or main README)
