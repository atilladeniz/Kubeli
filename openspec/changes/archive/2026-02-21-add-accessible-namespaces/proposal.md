# Change: Add Configurable Accessible Namespaces per Cluster

## Why

On RBAC-restricted clusters (common on managed platforms like GKE, AKS, EKS with scoped service accounts), users often cannot list namespaces at the cluster level but do have access to specific namespaces. Kubeli currently requires `namespaces:list` cluster-wide permission for three critical operations:

1. **Connection test** (`test_connection` in `client.rs:307`) calls `Api::all(Namespace).list(limit:1)` — fails with HTTP 403, preventing connection entirely
2. **Namespace listing** (`list_namespaces` in `client.rs:322`) calls `Api::all(Namespace).list()` — fails silently, leaving the namespace selector empty and hidden
3. **Namespace watch** (`watch_namespaces` in `watch.rs:224`) uses `Api::all(Namespace)` — fails silently, no live updates

This means users on RBAC-restricted clusters cannot connect at all, or if they somehow do, they see no namespaces and the namespace selector disappears entirely (`NamespaceSection.tsx:43` returns null when `namespaces.length === 0`).

Every major Kubernetes GUI tool handles this gap differently, with varying degrees of success:

| Tool | Manual Config | Connection Test | Error Isolation | Pre-Connect Config | Known Issues |
| ------ | -------------- | ---------------- | ----------------- | -------------------- | -------------- |
| **Lens / OpenLens** | Yes (since v4.0, PR #702) | Namespace list (falls back) | Partial (fixed after #4192) | Post-connect only | Persistent 403 banners (#4002), one bad NS poisons all (#4192) |
| **Headlamp** | Yes (cluster settings) | Assumes list; manual fallback | Good | Post-connect | Rare |
| **k9s** | Limited (default NS or flags) | Requires list or fails | Poor | No | Often stuck on default NS for restricted SAs |
| **Kubernetes Dashboard** | Partial (debated) | Namespace list primary | Varies | No | Still no clean manual list in core |
| **Kubeli (proposed)** | Yes (pre- & post-connect) | `/version` + 403 fallback | Full (`Promise.allSettled`) | Yes | None (design avoids known pitfalls) |

Lens/OpenLens was the first to ship this (v4.0.0, PR #702), but had significant bugs: persistent notification banners even after configuration (Issue #4002), one inaccessible namespace poisoning all resource lists (Issue #4192), and null response crashes (Issues #2010, #2111). Headlamp handles it more cleanly but only post-connect. Our implementation learns from all of these.

This feature was requested in GitHub Issue #140.

## What Changes

- **ADDED**: Per-cluster settings store persisted via `tauri_plugin_store` in `cluster-settings.json` (same pattern as existing `kubeconfig-sources.json`), keyed by context name
- **ADDED**: Tauri commands `get_cluster_settings` and `set_cluster_accessible_namespaces` for CRUD operations on per-cluster namespace configuration
- **ADDED**: UI to configure accessible namespaces per cluster — both **before connecting** (cluster card context menu on home page) and **after connecting** (notification prompt when namespace discovery fails)
- **MODIFIED**: `test_connection` — use `client.apiserver_version()` (`GET /version`) as primary connection test instead of namespace listing. The `/version` endpoint is accessible to all users via the default `system:public-info-viewer` ClusterRole, requiring no RBAC permissions
- **MODIFIED**: `test_connection` error handling — use kube-rs `status.is_forbidden()` to distinguish RBAC denial (403) from actual connection failures (network/TLS/auth errors)
- **MODIFIED**: `get_namespaces` / `list_namespaces` — check configured namespaces for context first; on API 403, fall back to configured namespaces
- **MODIFIED**: `fetchNamespaces` in `cluster-store.ts` — on failure, load configured namespaces from Tauri store as fallback
- **MODIFIED**: `NamespaceSection` — when connected but `namespaces.length === 0`, show a "Configure namespaces" prompt instead of hiding the section
- **MODIFIED**: Namespace watch — skip API watcher when using configured namespaces (static list, no live discovery needed)
- **ADDED**: Per-namespace error isolation — if one configured namespace returns 403, show error for that namespace only, don't fail the entire resource list (avoid Lens Issue #4192 pattern)

## Impact

- Affected specs: `cluster-management` (Namespace Selection requirement)
- Affected code:
  - `src-tauri/src/k8s/client.rs` — `test_connection` rewrite (use `/version`), `list_namespaces` fallback with 403 detection
  - `src-tauri/src/commands/cluster_settings.rs` — **NEW**: per-cluster settings CRUD via Tauri store
  - `src-tauri/src/commands/mod.rs` — register new module
  - `src-tauri/src/main.rs` — register new commands
  - `src-tauri/src/commands/clusters.rs` — `get_namespaces` checks configured namespaces, returns `namespace_source` field
  - `src/lib/stores/cluster-store.ts` — `fetchNamespaces` fallback, new `fetchConfiguredNamespaces` action, `namespaceSource` state
  - `src/lib/tauri/commands/cluster.ts` — new command bindings
  - `src/lib/types/kubernetes.ts` — `ClusterSettings`, `NamespaceSource` types
  - `src/components/layout/sidebar/sections/NamespaceSection.tsx` — "configure" prompt when empty, "(configured)" badge
  - `src/components/features/home/components/ClusterGridCard.tsx` — context menu with "Configure Namespaces"
  - `src/components/features/home/components/ClusterListCard.tsx` — same context menu

## Compatibility with Multi-Cluster Proposal

The active `add-multi-cluster-support` proposal plans to key all state by context name. This proposal uses the same key pattern (`HashMap<context, ClusterSettings>`), making both proposals composable. When multi-cluster lands, per-cluster settings naturally extend to the per-connection model.

## Trade-offs

### Benefits

1. **Unblocks RBAC-restricted users**: Users can connect and work with clusters where they only have namespace-scoped access
2. **Graceful degradation**: Auto-discovery works when RBAC allows it, manual config is a fallback — not a requirement
3. **Configure before or after connecting**: Unlike Lens (post-connect only), users can set namespaces on the home page before connecting
4. **Persistent**: Settings stored per context via Tauri store, survive app restarts
5. **Per-namespace error isolation**: Avoids Lens's "one bad namespace poisons everything" bug from day one
6. **Low risk**: Additive change, doesn't break existing workflows for unrestricted clusters

### Costs

1. **New persistence layer**: Adds a second Tauri store file (`cluster-settings.json`) alongside `kubeconfig-sources.json`
2. **Stale config risk**: Manually configured list won't auto-update if cluster namespaces change (mitigated by clear "(configured)" badge and a "Retry auto-discovery" button planned for v1.1)
3. **UI surface**: New configuration dialog and notification prompt add UI complexity

### Implementation Phases

- **Phase 1 (MVP)**: Backend connection rewrite + settings store + namespace resolution (tasks 1-3), then frontend types + store changes (tasks 4-5)
- **Phase 2**: Dialog component + UI integration points (tasks 6-7) + testing (task 8)
- **v1.1 follow-up**: "Retry auto-discovery" button (one-click clear + re-fetch) for stale-config mitigation

## Alternatives Considered

1. **Auto-detect from RBAC rules** (query `SelfSubjectRulesReview` for each potential namespace)
   - Rejected: `SelfSubjectRulesReview` requires you to already know the namespace name. It cannot discover namespaces. The Kubernetes API explicitly has no "list namespaces I have access to" endpoint (kubernetes/kubernetes#71097). Also, the `incomplete` field means results may be missing permissions.

2. **Parse namespace from kubeconfig context only**
   - Rejected: Kubeconfig only has a single default namespace per context, not a list of accessible ones. However, we DO pre-fill the kubeconfig default namespace as a starting point in the configuration dialog.

3. **Global namespace allowlist in app settings**
   - Rejected: Namespaces differ per cluster, a global list doesn't make sense.

4. **Brute-force probe all known namespaces with `SelfSubjectAccessReview`**
   - Rejected: Requires knowing namespace names upfront. Expensive (one API call per namespace). Kubernetes Dashboard maintainers rejected this approach due to API server load concerns (kubernetes/dashboard#6785).

### Feasibility Assessment

The changes are additive, backward-compatible, and use stable APIs (kube-rs 3.x `apiserver_version()`, Tauri plugin store). All referenced Kubernetes limitations and Lens issues remain current as of February 2026. The `/version` endpoint is guaranteed accessible via the built-in `system:public-info-viewer` ClusterRole on every Kubernetes cluster. Static configured namespace lists are actually faster than API watches on large clusters. No new permissions required — purely client-side.

## References

- [GitHub Issue #140](https://github.com/atilladeniz/Kubeli/issues/140) — Original feature request
- [Lens Issue #486](https://github.com/lensapp/lens/issues/486) — Lens's original implementation (PR #702, v4.0.0)
- [Lens Issue #4002](https://github.com/lensapp/lens/issues/4002) — Persistent notification bug
- [Lens Issue #4192](https://github.com/lensapp/lens/issues/4192) — One bad namespace poisons all lists
- [kubernetes/kubernetes#71097](https://github.com/kubernetes/kubernetes/issues/71097) — No ACL-filtered namespace list API (`lifecycle/rotten`, `priority/awaiting-more-evidence`, open since Nov 2018)
- [kubernetes/dashboard#6785](https://github.com/kubernetes/dashboard/issues/6785) — Dashboard's approach to namespace filtering
- [Headlamp FAQ](https://headlamp.dev/docs/latest/faq/) — Headlamp's accessible namespaces approach
- [kube-rs Client API](https://docs.rs/kube/latest/kube/client/struct.Client.html) — `apiserver_version()` documentation
- [Kubernetes RBAC Reference](https://kubernetes.io/docs/reference/access-authn-authz/rbac/) — `system:public-info-viewer` ClusterRole
