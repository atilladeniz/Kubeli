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

## Incomplete Files

The three files in `incomplete/` are designed to be merged together. When combined they form a valid kubeconfig with context `merged-test` pointing to cluster `merged-cluster` authenticated as `merged-user`.

All certificates and tokens are fake (base64-encoded placeholder strings). Do not use against real clusters.
