# Design: Accessible Namespaces per Cluster

## Context

Users on RBAC-restricted Kubernetes clusters cannot list namespaces at the cluster level (`GET /api/v1/namespaces` returns 403) but can access resources within specific namespaces via `Api::namespaced()`. Kubeli needs a way to let these users configure which namespaces they have access to, stored persistently per cluster context.

This is a known gap in the Kubernetes API itself — there is no "list namespaces I have access to" endpoint (kubernetes/kubernetes#71097, open since Nov 2018, labeled `lifecycle/rotten`). Kubernetes maintainers have repeatedly rejected an ACL-filtered list API, citing concerns over watchability, security, and core philosophy. Every major K8s tool must implement a manual-configuration fallback: Lens uses manual configuration (post-connect only, bugs with persistent 403 banners and one-NS-poisons-all), Headlamp uses cluster-settings-based manual fallback (cleaner), k9s largely fails on restricted SAs, Kubernetes Dashboard is still debating the approach.

### Constraints

- Must not break existing auto-discovery flow for unrestricted clusters
- Must persist across app restarts
- Must be keyed by context name (compatible with multi-cluster proposal)
- Must allow connection even when `namespaces:list` permission is denied
- Must handle per-namespace errors gracefully (not let one bad namespace fail everything)

## Goals / Non-Goals

- **Goals:**
  - Allow manual namespace configuration per cluster context (before AND after connecting)
  - Fix connection failure when `namespaces:list` is denied (use `/version` endpoint)
  - Show meaningful UI when namespace auto-discovery fails
  - Persist settings in Tauri store (same pattern as kubeconfig sources)
  - Per-namespace error isolation from day one

- **Non-Goals:**
  - Auto-detect accessible namespaces via RBAC introspection (unreliable, rejected)
  - Replace namespace auto-discovery for unrestricted clusters
  - Namespace CRUD operations (create/delete namespaces on the cluster)
  - Namespace regex/glob patterns (exact names only for v1)

## Decisions

### 1. Connection Test: Use `/version` Instead of Namespace Listing

The current `test_connection` (`client.rs:307`) uses `Api::all(Namespace).list(limit:1)` which requires `namespaces:list` ClusterRole permission. This fails with 403 on RBAC-restricted clusters.

Replace with `client.apiserver_version()` which calls `GET /version`. This endpoint is accessible to ALL users (including unauthenticated) via the default `system:public-info-viewer` ClusterRole that ships with every Kubernetes cluster. It confirms:

- Network connectivity to the API server
- TLS handshake works
- Returns parseable JSON with server version info

```rust
// New test_connection approach:
pub async fn test_connection(&self) -> Result<bool> {
    let client = self.get_client().await?;
    match client.apiserver_version().await {
        Ok(_) => Ok(true),
        Err(kube::Error::Api(status)) if status.is_forbidden() => {
            // Extremely unusual for /version, but server IS reachable
            Ok(true)
        }
        Err(e) => {
            tracing::warn!("Connection test failed: {}", e);
            Ok(false)
        }
    }
}
```

**Why not keep namespace listing as primary?** Because it conflates "RBAC denied" with "connection failed". A 403 on namespace listing means the connection works perfectly — the user just doesn't have that specific permission.

### 2. 403 Detection in kube-rs

kube-rs 3.0.0 (used in this project) returns `Error::Api(Box<Status>)` for API errors. The `Status` struct has a `is_forbidden()` helper:

```rust
match namespace_api.list(&ListParams::default()).await {
    Ok(list) => { /* use discovered namespaces */ }
    Err(kube::Error::Api(status)) if status.is_forbidden() => {
        // RBAC denied — fall back to configured namespaces
        tracing::info!("Namespace listing forbidden (RBAC), using configured namespaces");
    }
    Err(e) => {
        // Actual error (network, auth, etc.)
        tracing::error!("Namespace listing failed: {}", e);
    }
}
```

This distinguishes:

- `Error::Api(status)` + `is_forbidden()` → RBAC denial, connection is fine
- `Error::HyperError` → Network/connection failure
- `Error::Auth` → Authentication failure

### 3. Storage: Single Tauri Store File (`cluster-settings.json`)

Use `tauri_plugin_store` with a single file, following the exact pattern from `kubeconfig-sources.json`:

```rust
const STORE_FILENAME: &str = "cluster-settings.json";

// Each context has its own key in the store
fn load_cluster_settings(app: &AppHandle, context: &str) -> Option<ClusterSettings> {
    let store = app.store(STORE_FILENAME).ok()?;
    store.get(context)
        .and_then(|v| serde_json::from_value(v.clone()).ok())
}

fn save_cluster_settings(app: &AppHandle, context: &str, settings: &ClusterSettings) -> Result<(), String> {
    let store = app.store(STORE_FILENAME)
        .map_err(|e| format!("Failed to open store: {}", e))?;
    let value = serde_json::to_value(settings)
        .map_err(|e| format!("Failed to serialize: {}", e))?;
    store.set(context, value);
    store.save().map_err(|e| format!("Failed to save: {}", e))?;
    Ok(())
}
```

Data model:

```json
{
  "prod-restricted-ctx": {
    "accessible_namespaces": ["team-a", "team-b", "shared"]
  },
  "dev-full-access-ctx": {
    "accessible_namespaces": []
  }
}
```

Empty array or missing entry = auto-discover (current behavior). Non-empty array = use these, skip API call.

**Why single file, not per-cluster files?** Matches existing pattern, cluster counts are small (<50), easier to debug/export. `Arc<Mutex>` inside the store handles concurrency.

### 4. Namespace Resolution Order

```text
connect_cluster() called
  │
  ├─ test_connection via GET /version  ← NEW (always succeeds if server reachable)
  │
  ├─ Check configured namespaces for this context
  │   ├─ Found non-empty list → use as namespaces, set source="configured", skip watch
  │   └─ Empty/not found → continue to API discovery
  │
  ├─ Try GET /api/v1/namespaces (existing behavior)
  │   ├─ Success → use API result, set source="auto", start namespace watch
  │   └─ 403 Forbidden → check configured namespaces again (may have been set in the meantime)
  │       ├─ Found → use configured, set source="configured"
  │       └─ Not found → namespaces=[], show "configure" prompt in UI
  │
  └─ Frontend receives namespaces + source indicator
```

Key detail: If configured namespaces exist, we skip the API call entirely. This avoids the Lens bug where the 403 notification kept firing even after configuration.

### 5. UI: Two Entry Points

#### Entry Point 1: Before connecting (Home Page)

- Cluster card context menu (right-click or "..." button) → "Configure Namespaces"
- Opens a dialog with a textarea for namespace names (one per line)
- Pre-fills the kubeconfig default namespace from the context if available
- Save persists to `cluster-settings.json`
- No validation against the cluster (can't verify without connecting)

#### Entry Point 2: After connecting (Sidebar)

- When `isConnected && namespaces.length === 0`, instead of hiding `NamespaceSection`, show:
  - Text: "Namespace listing not permitted"
  - Button: "Configure accessible namespaces"
  - Opens the same dialog
- After saving, immediately updates the namespace selector with the configured list

#### Visual indicator

- When `namespaceSource === "configured"`, show a small "(configured)" text or badge next to the namespace section header
- This makes it clear that auto-discovery is not active and the list is manual

### 6. "All Namespaces" in Configured Mode

When namespace source is "auto", the existing "All Namespaces" option performs a cluster-scoped list (`GET /api/v1/namespaces/{resource}`). This would trigger a 403 on restricted clusters. When source is "configured", "All Namespaces" must fetch per-namespace and union the results:

```typescript
// Auto mode: cluster-scoped (existing behavior)
if (namespaceSource === "auto") {
  return fetchResourcesClusterWide(resourceType);
}

// Configured mode: union of per-namespace fetches
const results = await Promise.allSettled(
  configuredNamespaces.map(ns => fetchResources(ns, resourceType))
);
// Merge successful results, show inline errors for failures
```

This is critical — without it, selecting "All Namespaces" on a restricted cluster would immediately 403 and appear broken. The per-namespace fetch also naturally enables error isolation (Decision 7).

### 7. Per-Namespace Error Isolation

When resource fetching uses configured namespaces and one namespace returns 403:

```typescript
// Instead of: fetch all resources across all namespaces in one call
// Do: fetch per-namespace, collect results, report errors individually
const results = await Promise.allSettled(
  namespaces.map(ns => fetchResources(ns))
);

// Show successful namespaces' resources
// Show toast/inline error for failed namespaces: "Cannot access namespace 'team-c'"
```

This prevents one misconfigured/revoked namespace from breaking the entire UI — the Lens Issue #4192 bug that took them several releases to fix.

### 8. Input Validation

The namespace configuration dialog performs lightweight client-side validation:

- **Trim**: Strip leading/trailing whitespace from each line
- **Dedup**: Remove duplicate entries (case-sensitive, K8s namespaces are case-sensitive)
- **Filter**: Remove empty lines
- **Warn**: Show inline warning for names violating Kubernetes DNS-1123 label rules (lowercase alphanumeric or `-`, must start/end with alphanumeric, max 63 chars)
- **Non-blocking**: Warnings only, not errors. The user can save anyway — the server will enforce the real rules on resource fetch, and per-namespace error isolation will show which namespaces are invalid.

```typescript
const DNS_1123_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

function validateNamespace(name: string): string | null {
  if (!DNS_1123_LABEL.test(name)) {
    return `"${name}" may not be a valid Kubernetes namespace name`;
  }
  return null;
}
```

### 9. Kubeconfig Default Namespace Pre-fill

The dialog pre-fills with the kubeconfig default namespace for the selected context. This is already available in Kubeli's `Cluster` type (`namespace: string | null`), so no new backend command is needed — the frontend passes the cluster's `namespace` field to the dialog as initial value when opening.

If configured namespaces already exist for this context, those take priority as pre-fill content over the kubeconfig default.

### 10. Data Flow Summary

```text
┌─────────────────────────────────────────────────────────┐
│ Home Page (before connect)                              │
│  Cluster Card → Context Menu → "Configure Namespaces"  │
│  → ConfigureNamespacesDialog                            │
│  → invoke('set_cluster_accessible_namespaces')          │
│  → Tauri writes cluster-settings.json                   │
└─────────────────────────────────────────────────────────┘
                          │
                    User clicks Connect
                          │
┌─────────────────────────────────────────────────────────┐
│ Connection Flow                                         │
│  1. test_connection via GET /version  ← always works    │
│  2. Check cluster-settings.json for configured NS       │
│     → Found: use them, skip API list, skip watch        │
│     → Not found: try API list                           │
│       → Success: use API result, start watch            │
│       → 403: show "Configure namespaces" prompt         │
└─────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────────────────────────────────────┐
│ Sidebar (after connect)                                 │
│  NamespaceSection shows:                                │
│  - Auto-discovered namespaces (source=auto), OR         │
│  - Configured namespaces + "(configured)" badge, OR     │
│  - "Configure accessible namespaces" prompt if empty    │
└─────────────────────────────────────────────────────────┘
```

## Risks / Trade-offs

| Risk | Mitigation |
| ------ | ------------ |
| Stale namespace list | "(configured)" badge makes it visible. "Retry auto-discovery" button planned for v1.1 (one-click clear + re-fetch). |
| Typos in namespace names | On first resource fetch failure for a namespace, show error toast: "Cannot access namespace 'typo-ns'" |
| One bad namespace blocks all resources | Per-namespace error isolation via `Promise.allSettled` |
| Store file corruption | Graceful fallback to empty defaults (same as kubeconfig-sources pattern) |
| Namespace added to cluster but not to config | User can re-open dialog and add it. Auto-discovery mode handles unrestricted clusters. |
| Performance with many configured NS | Static list is actually *faster* than API watch on large clusters — no watch overhead |

## Testing Matrix

| Scenario | Expected Behavior |
| ---------- | ------------------- |
| Unrestricted cluster, no config | Auto-discover via API, source="auto", start watch (existing behavior) |
| Restricted cluster (403), no config | Connection succeeds via `/version`, show "Configure" prompt, source="none" |
| Restricted cluster, with config | Use configured list, skip API call, source="configured" |
| Configured NS, one revoked | Show resources from accessible NS, inline error for revoked one |
| Configured NS, all revoked | Show errors for each NS, don't break UI |
| Network failure (server unreachable) | `/version` fails, connection marked as failed with descriptive error |
| Store corruption / missing file | Graceful fallback to empty defaults, auto-discover mode |
| App restart with saved config | Load from store, skip API call on connect |
| Configured + "All Namespaces" selected | Union of per-NS fetches, no cluster-scoped list, per-NS error isolation |
| Invalid namespace name in dialog | Show inline warning, allow save, error surfaces on resource fetch |

## Open Questions

- Should we pre-fill the dialog with the kubeconfig default namespace? **Decision: Yes** — simple to implement and gives users a starting point.
- Should we support namespace regex patterns (e.g., `team-*`)? **Decision: No** — exact names only for v1. Patterns add complexity without clear user demand. K8s API doesn't support pattern-based namespace access anyway.

## Future Enhancements (v1.1)

- **"Retry auto-discovery" button**: One-click action in the namespace section when source="configured" that clears config and re-attempts API discovery. Low effort, high UX win for stale-config mitigation.
- **Import from kubeconfig contexts**: If multiple contexts reference same cluster with different default namespaces, offer to import them all.
- **Export settings**: Allow exporting/importing `cluster-settings.json` for team sharing.
