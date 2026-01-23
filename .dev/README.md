# Local Testing Lab

This directory contains manifests and tools to simulate various Kubernetes environments locally using Minikube. Use these to test Kubeli's environment detection, auth error handling, and performance without paid cloud clusters.

## Prerequisites

- [Minikube](https://minikube.sigs.k8s.io/docs/start/) installed and running
- [kubectl](https://kubernetes.io/docs/tasks/tools/) configured
- [Helm](https://helm.sh/docs/intro/install/) (optional, for native Helm releases)

## Quick Start

```bash
# Start minikube with all sample resources
make minikube-start

# The above includes:
# - Flux CRDs and sample HelmReleases/Kustomizations
# - Demo workloads (Deployments, StatefulSets, DaemonSets, etc.)
# - Native Helm releases (nginx, mysql)
```

## Available Scenarios

### 1. Flux Environment

Already included in `make minikube-start`. Tests Kubeli's Flux GitOps support.

```bash
# Manual setup (if not using minikube-start)
make minikube-setup-flux
```

**Resources created:**
- Flux CRDs (HelmRelease, Kustomization, GitRepository, etc.)
- Sample HelmReleases: podinfo (Ready), redis (Ready), prometheus-stack (Failed), cert-manager (Ready)
- Sample Kustomizations: apps (Ready), infrastructure (Ready), monitoring (Failed)

### 2. OpenShift Environment

Simulates an OpenShift cluster with Route, Project, and DeploymentConfig resources.

```bash
# Setup
make minikube-setup-openshift

# Cleanup
make minikube-clean-openshift
```

**Resources created:**
- OpenShift CRDs (Route, Project, DeploymentConfig)
- Namespace: kubeli-openshift-demo
- Routes: demo-web-route, demo-secure-route, demo-api-route
- DeploymentConfigs: demo-web-dc, demo-api-dc

**Expected Kubeli behavior:**
- Detects OpenShift environment from CRD presence
- Shows Routes in resource list
- Shows DeploymentConfigs alongside Deployments

### 3. Cloud Provider Context Simulation

Creates kubeconfig contexts that look like EKS/GKE/AKS but point to your local cluster.

```bash
# Create fake cloud contexts
make kubeconfig-fake-eks    # Creates kubeli-eks-demo context
make kubeconfig-fake-gke    # Creates kubeli-gke-demo context
make kubeconfig-fake-aks    # Creates kubeli-aks-demo context

# List simulated contexts
./scripts/kubeconfig-sim.sh list

# Cleanup all kubeli-* contexts
make kubeconfig-cleanup
```

**Context naming:**
- EKS: `arn:aws:eks:us-west-2:123456789012:cluster/kubeli-eks-demo`
- GKE: `gke_kubeli-project_us-central1-a_kubeli-gke-demo`
- AKS: `kubeli-aks-demo`

**Expected Kubeli behavior:**
- Detects cloud provider from context/cluster naming
- Shows appropriate provider icon/badge
- All operations work (points to real minikube cluster)

### 4. Auth Error Simulation

Creates a context with invalid credentials to test auth error handling.

```bash
# Create auth-error context
make kubeconfig-auth-error

# Switch to test auth errors
kubectl config use-context kubeli-auth-error

# Cleanup
make kubeconfig-cleanup
```

**Expected Kubeli behavior:**
- Shows authentication error message
- Graceful error handling without crash
- Ability to switch to working context

### 5. Scale Testing

Creates N dummy pods to test Kubeli's performance with large resource counts.

```bash
# Create 100 pods (default)
make minikube-setup-scale

# Create 500 pods
make minikube-setup-scale N=500

# Check status
./scripts/k8s-scale.sh status

# Cleanup
make minikube-clean-scale
```

**Technical details:**
- Uses `registry.k8s.io/pause:3.9` (minimal image)
- Pods created in batches of 50 to avoid API overload
- Resource quota limits: 500 pods, 50 CPU, 10Gi memory
- Namespace: kubeli-scale-test

**Expected Kubeli behavior:**
- Resource list loads without lag
- Pagination/virtualization handles large lists
- Memory usage stays reasonable

## Sample Manifests

| File | Description |
|------|-------------|
| `01-namespace.yaml` | kubeli-demo namespace |
| `02-storage.yaml` | PersistentVolumes and PVC |
| `03-app-deployment.yaml` | Demo Deployments |
| `04-ingress.yaml` | Ingress resources |
| `05-network-policies.yaml` | NetworkPolicies |
| `06-hpa.yaml` | HorizontalPodAutoscalers |
| `07-pdb.yaml` | PodDisruptionBudgets |
| `08-quotas-limits.yaml` | ResourceQuotas, LimitRanges |
| `09-rbac.yaml` | Roles, RoleBindings |
| `10-workloads.yaml` | StatefulSet, DaemonSet, Job, CronJob |
| `11-flux-crds.yaml` | Flux CRD definitions |
| `12-flux-helmreleases.yaml` | Sample Flux HelmReleases |
| `13-flux-kustomizations.yaml` | Sample Flux Kustomizations |
| `14-openshift-crds.yaml` | OpenShift CRD definitions |
| `15-openshift-samples.yaml` | Sample OpenShift resources |
| `16-scale-pods.yaml` | Scale test template and quota |

## Scripts

| Script | Description |
|--------|-------------|
| `scripts/kubeconfig-sim.sh` | Create/manage simulated cloud contexts |
| `scripts/k8s-scale.sh` | Create/delete scale test pods |

## Cleanup

```bash
# Remove all sample resources
make minikube-clean-samples

# Remove OpenShift resources
make minikube-clean-openshift

# Remove scale test pods
make minikube-clean-scale

# Remove simulated kubeconfig contexts
make kubeconfig-cleanup

# Stop minikube entirely
make minikube-stop
```

## Expected Outcomes Checklist

Use this checklist to verify Kubeli works correctly with each scenario:

### Flux Environment
- [ ] HelmReleases appear in resource list
- [ ] Kustomizations appear in resource list
- [ ] Ready/Failed status displayed correctly
- [ ] Resource details show Flux-specific fields

### OpenShift Environment
- [ ] Routes appear in resource list
- [ ] DeploymentConfigs appear in resource list
- [ ] OpenShift detection triggers (if applicable)

### Cloud Context Simulation
- [ ] EKS context detected as AWS
- [ ] GKE context detected as GCP
- [ ] AKS context detected as Azure
- [ ] All K8s operations work normally

### Auth Error Simulation
- [ ] Auth error displayed gracefully
- [ ] No application crash
- [ ] Can switch to working context

### Scale Testing
- [ ] 100+ pods load without noticeable lag
- [ ] Resource list scrolls smoothly
- [ ] Memory usage stays stable

## Automated Tests

Kubeli also ships automated tests that do not require a live cluster:

```bash
# Frontend unit tests
npm run test

# Backend unit tests
cd src-tauri && cargo test

# E2E smoke tests (builds static export, serves `out`, uses mocked IPC)
npm run test:e2e
```

CI runs all three suites on every pull request and blocks merges on failure.

`npm run test:e2e` loads its environment defaults from `config/e2e.env` and injects a mocked
Google Fonts response from `config/font-mocks.cjs` for offline builds.
