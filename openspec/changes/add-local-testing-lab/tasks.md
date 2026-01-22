# Tasks: Local Testing Lab

## 1. Scenario Manifests
- [x] 1.1 Add OpenShift CRD manifests and sample Route/Project resources under `.dev/k8s-samples/`
- [x] 1.2 Add scale-test manifests or a generator template for N dummy pods

## 2. Makefile Targets
- [x] 2.1 Add `minikube-setup-openshift` target to apply OpenShift CRDs and samples
- [x] 2.2 Add `minikube-setup-scale` target with `N` param for high-volume pods
- [x] 2.3 Add `kubeconfig-fake-eks|gke|aks` targets (or a single param-driven target)

## 3. Kubeconfig Helpers
- [x] 3.1 Add a safe helper script to clone an existing context and rename it for EKS/GKE/AKS simulation
- [x] 3.2 Add a helper to create an invalid-token context for auth-error testing

## 4. Documentation
- [x] 4.1 Document the local testing lab, prerequisites, and cleanup steps
- [x] 4.2 Add a short expected-outcomes checklist for Kubeli UI verification
