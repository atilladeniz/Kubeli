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

## Same User Name Files (`same-user/`)

| File | Description |
|------|-------------|
| `same-user/cluster-nonprod.yaml` | Context `k8s-nonprod`, user `admin`, client-cert auth |
| `same-user/cluster-production.yaml` | Context `k8s-production`, user `admin`, client-cert auth |
| `same-user/cluster-cicd.yaml` | Context `k8s-cicd`, user `admin`, client-cert auth |

These three files reproduce [#283](https://github.com/atilladeniz/Kubeli/issues/283): each defines a user named `admin` with different certificates. When merged naively, only the first file's `admin` credentials survive, causing connection failures for the other clusters. Add the `same-user/` folder as a source in Kubeli to test.

## Incomplete Files

The three files in `incomplete/` are designed to be merged together. When combined they form a valid kubeconfig with context `merged-test` pointing to cluster `merged-cluster` authenticated as `merged-user`.

All certificates and tokens are fake (base64-encoded placeholder strings). Do not use against real clusters.
