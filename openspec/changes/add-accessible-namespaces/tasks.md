# Tasks: Accessible Namespaces per Cluster

<!-- Phase 1 (MVP): Tasks 1-5 — Backend + Types + Store -->

## 1. Backend: Connection Test Rewrite

- [ ] 1.1 Modify `test_connection` in `client.rs:307` to use `client.apiserver_version()` (`GET /version`) as primary connection test instead of namespace listing
- [ ] 1.2 Use kube-rs `Error::Api(status)` with `status.is_forbidden()` to distinguish RBAC 403 from actual connection failures
- [ ] 1.3 Log RBAC denial as info-level ("Namespace listing forbidden, RBAC restricted") not as warning/error
- [ ] 1.4 Write unit test: connection succeeds when `/version` returns OK but namespace list returns 403

## 2. Backend: Per-Cluster Settings Store

- [ ] 2.1 Create `src-tauri/src/commands/cluster_settings.rs` with Tauri store CRUD following existing `kubeconfig-sources.json` pattern:
  - `get_cluster_settings(context: String) -> ClusterSettings`
  - `set_cluster_accessible_namespaces(context: String, namespaces: Vec<String>)`
  - `clear_cluster_settings(context: String)`
- [ ] 2.2 Define `ClusterSettings` struct: `{ accessible_namespaces: Vec<String> }`
- [ ] 2.3 Use `app.store("cluster-settings.json")` with context name as key, explicit `store.save()` after writes
- [ ] 2.4 Register module in `commands/mod.rs` and commands in `main.rs`
- [ ] 2.5 Write unit tests for store read/write/clear/missing-key behavior

## 3. Backend: Namespace Resolution with Fallback

- [ ] 3.1 Modify `get_namespaces` in `clusters.rs:342` to accept `AppHandle` parameter (to access store), return `NamespaceResult { namespaces: Vec<String>, source: String }` where source is `"auto"` or `"configured"`
- [ ] 3.2 Resolution order: check configured namespaces first → if empty, try API → on 403, fallback to configured → if nothing, return empty with source `"none"`
- [ ] 3.3 When configured namespaces are used, skip API call entirely (avoids Lens's persistent 403 notification bug)
- [ ] 3.4 Modify `watch_namespaces` to be a no-op when source is `"configured"` (static list, no watch needed)
- [ ] 3.5 Update `connect_cluster` command to pass `namespace_source` info in the connection response

## 4. Frontend: Type Definitions and Command Bindings

- [ ] 4.1 Add types to `src/lib/types/kubernetes.ts`:
  - `ClusterSettings { accessible_namespaces: string[] }`
  - `NamespaceSource: "auto" | "configured" | "none"`
  - `NamespaceResult { namespaces: string[], source: NamespaceSource }`
- [ ] 4.2 Add Tauri command bindings in `src/lib/tauri/commands/cluster.ts`:
  - `getClusterSettings(context: string): Promise<ClusterSettings | null>`
  - `setClusterAccessibleNamespaces(context: string, namespaces: string[]): Promise<void>`
  - `clearClusterSettings(context: string): Promise<void>`

## 5. Frontend: Cluster Store Changes

- [ ] 5.1 Add `namespaceSource: NamespaceSource` to cluster store state (default: `"none"`)
- [ ] 5.2 Modify `fetchNamespaces` to handle new `NamespaceResult` response with `source` field
- [ ] 5.3 Add `saveAccessibleNamespaces(context: string, namespaces: string[])` action:
  - Writes to Tauri store
  - Updates local `namespaces` and `namespaceSource` state
  - Stops active namespace watch (no longer needed)
- [ ] 5.4 Add `clearAccessibleNamespaces(context: string)` action that resets to auto-discovery mode

<!-- Phase 2: Tasks 6-8 — UI Components + Integration + Testing -->

## 6. Frontend: Configure Namespaces Dialog

- [ ] 6.1 Create `ConfigureNamespacesDialog` component (`src/components/features/cluster/ConfigureNamespacesDialog.tsx`):
  - Textarea input for namespace names (one per line)
  - Pre-fill with kubeconfig default namespace from cluster's `namespace` field if no config exists yet
  - Pre-fill with existing configured namespaces if editing
  - "Save" button: parses lines, trims whitespace, deduplicates, filters empty, calls `saveAccessibleNamespaces`
  - "Clear" button: resets to auto-discovery via `clearAccessibleNamespaces`
  - "Cancel" button: closes without saving
- [ ] 6.2 Use existing `Dialog` component from `@/components/ui/dialog`
- [ ] 6.3 Add client-side DNS-1123 label validation: show inline warnings for names not matching `/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/` (non-blocking, user can still save)

## 7. Frontend: UI Integration Points

- [ ] 7.1 **NamespaceSection** (`NamespaceSection.tsx:43`): When `isConnected && namespaces.length === 0`, show:
  - Info text: "Namespace listing not permitted"
  - Button: "Configure accessible namespaces" → opens `ConfigureNamespacesDialog`
  - Remove the early `return null` for this case
- [ ] 7.2 **NamespaceSection badge**: When `namespaceSource === "configured"`, show "(configured)" text next to section header
- [ ] 7.3 **ClusterGridCard**: Add context menu with "Configure Namespaces" option → opens `ConfigureNamespacesDialog` for that cluster's context
- [ ] 7.4 **ClusterListCard**: Same context menu as ClusterGridCard
- [ ] 7.5 **"All Namespaces" in configured mode**: Modify `useK8sResource` hook (`hooks/k8s/useK8sResource.ts:41`) — when `namespaceSource === "configured"` and `namespace === ""` (All Namespaces), fetch resources as union of per-namespace queries via `Promise.allSettled` instead of passing empty namespace (which triggers cluster-scoped `Api::all` → 403)
- [ ] 7.6 **Per-namespace error handling**: When a configured namespace returns 403 on resource fetch, show inline error for that namespace only (don't fail the entire resource list). Applies to all resource views (Pods, Deployments, Services, etc.) via `Promise.allSettled` pattern
- [ ] 7.7 **Home page configured indicator**: Show subtle badge/icon on ClusterGridCard and ClusterListCard when namespaces are configured for that context (loaded from store on home page mount)

## 8. Testing

- [ ] 8.1 Rust: `test_connection` returns true when `/version` works but namespace list returns 403
- [ ] 8.2 Rust: `test_connection` returns false when `/version` fails (actual connection error)
- [ ] 8.3 Rust: Settings store CRUD (save, load, clear, missing key returns None)
- [ ] 8.4 Rust: `get_namespaces` returns configured namespaces with source="configured" when settings exist
- [ ] 8.5 Rust: `get_namespaces` returns API namespaces with source="auto" when no settings and API works
- [ ] 8.6 Rust: `get_namespaces` falls back to configured on 403 with source="configured"
- [ ] 8.7 Frontend: `ConfigureNamespacesDialog` renders, saves, and clears
- [ ] 8.8 Frontend: `NamespaceSection` shows configure prompt when `isConnected && namespaces.length === 0`
- [ ] 8.9 Frontend: `NamespaceSection` shows "(configured)" badge when `namespaceSource === "configured"`
- [ ] 8.10 Frontend: "All Namespaces" in configured mode fetches per-NS union (not cluster-scoped list)
- [ ] 8.11 Frontend: Dialog validates DNS-1123, deduplicates, and trims input

<!-- v1.1 follow-up (not in scope for this change) -->
<!-- - "Retry auto-discovery" button in NamespaceSection when source="configured" -->
<!-- - Import namespaces from kubeconfig contexts -->
<!-- - Export/import cluster-settings.json for team sharing -->
