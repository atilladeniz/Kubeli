# Tasks: Local Testing Lab

## 1. Scenario Manifests
- [ ] 1.1 Add OpenShift CRD manifests and sample Route/Project resources under `.dev/k8s-samples/`
- [ ] 1.2 Add scale-test manifests or a generator template for N dummy pods

## 2. Makefile Targets
- [ ] 2.1 Add `minikube-setup-openshift` target to apply OpenShift CRDs and samples
- [ ] 2.2 Add `minikube-setup-scale` target with `N` param for high-volume pods
- [ ] 2.3 Add `kubeconfig-fake-eks|gke|aks` targets (or a single param-driven target)

## 3. Kubeconfig Helpers
- [ ] 3.1 Add a safe helper script to clone an existing context and rename it for EKS/GKE/AKS simulation
- [ ] 3.2 Add a helper to create an invalid-token context for auth-error testing

## 4. Documentation
- [ ] 4.1 Document the local testing lab, prerequisites, and cleanup steps
- [ ] 4.2 Add a short expected-outcomes checklist for Kubeli UI verification
