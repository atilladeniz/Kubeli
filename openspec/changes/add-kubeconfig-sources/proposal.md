# Change: Add Kubeconfig Sources Management

## Why

Kubeli currently only reads `~/.kube/config` (or `KUBECONFIG` env var). Users with multiple kubeconfig files (e.g. separate files per cluster, team-shared configs, cloud provider exports) cannot use them without manually merging. Multi-source kubeconfig management is a baseline expectation for K8s desktop tools.

## What Changes

- New **Kubeconfig** settings tab to manage kubeconfig source files/folders
- Backend support for loading and merging multiple kubeconfig files
- Persist configured sources across sessions (Tauri store)
- File/folder picker dialogs for adding sources
- Manual path entry for remote/mounted paths
- Optional **Merge Files** mode (combine incomplete kubeconfigs)
- File watcher for automatic reload on kubeconfig changes

## Impact

- Affected specs: `settings`, `clusters`
- Affected code:
  - `src-tauri/src/k8s/config.rs` — multi-file loading & merging
  - `src-tauri/src/k8s/client.rs` — accept merged config
  - `src-tauri/src/commands/clusters.rs` — list from merged sources
  - `src/lib/stores/ui-store.ts` — persist kubeconfig sources
  - `src/components/features/settings/` — new Kubeconfig tab
  - `src/lib/tauri/commands.ts` — new command bindings
