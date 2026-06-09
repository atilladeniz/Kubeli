# Kubeconfig Samples

Sample kubeconfig files for testing multi-source kubeconfig loading and merging in Kubeli.

## Files

| File | Description |
|------|-------------|
| `config-minikube.yaml` | Single context (minikube), client-certificate auth |
| `config-cloud.yaml` | Two contexts (aws-staging, aws-production), exec-based auth |
| `config-azure.yaml` | Single context (aks-dev), kubelogin exec auth |
| `incomplete/contexts-only.yaml` | Only contexts section, references merged-cluster and merged-user |
| `incomplete/clusters-only.yaml` | Only clusters section, defines merged-cluster |
| `incomplete/users-only.yaml` | Only users section, defines merged-user |

## Same User Name Testing (#283)

`make kubeconfig-same-user` starts 3 separate minikube profiles (`kubeli-nonprod`, `kubeli-production`, `kubeli-cicd`), exports each profile's kubeconfig, and renames the user to `admin` in all files. This reproduces the exact bug scenario: different clusters with different certs but same user name. Output goes to `~/.kube/kubeli-same-user/`. Cleanup with `make kubeconfig-cleanup` (stops profiles and removes files).

## Incomplete Files

The three files in `incomplete/` are designed to be merged together. When combined they form a valid kubeconfig with context `merged-test` pointing to cluster `merged-cluster` authenticated as `merged-user`.

All certificates and tokens are fake (base64-encoded placeholder strings). Do not use against real clusters.
