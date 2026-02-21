# Tasks: Accessible Namespaces per Cluster

<!-- Phase 1 (MVP): Tasks 1-5 — Backend + Types + Store -->

## 1. Backend: Connection Test Rewrite

- [x] 1.1 Modify `test_connection` in `client.rs:307` to use `client.apiserver_version()` (`GET /version`) as primary connection test instead of namespace listing
- [x] 1.2 Use kube-rs `Error::Api(status)` with `status.code == 403` to distinguish RBAC 403 from actual connection failures
- [x] 1.3 Log RBAC denial as info-level ("Connection test: /version returned 403, but server is reachable")
- [x] 1.4 Connection test logic verified via integration (unit test skipped — requires mocking kube-rs client)

## 2. Backend: Per-Cluster Settings Store

- [x] 2.1 Create `src-tauri/src/commands/cluster_settings.rs` with Tauri store CRUD following existing `kubeconfig-sources.json` pattern:
  - `get_cluster_settings(context: String) -> ClusterSettings`
  - `set_cluster_accessible_namespaces(context: String, namespaces: Vec<String>)`
  - `clear_cluster_settings(context: String)`
- [x] 2.2 Define `ClusterSettings` struct: `{ accessible_namespaces: Vec<String> }`
- [x] 2.3 Use `app.store("cluster-settings.json")` with context name as key, explicit `store.save()` after writes
- [x] 2.4 Register module in `commands/mod.rs` and commands in `main.rs`
- [x] 2.5 Store read/write/clear operations verified via E2E mock and integration testing

## 3. Backend: Namespace Resolution with Fallback

- [x] 3.1 Modify `get_namespaces` in `clusters.rs` to accept `AppHandle` parameter (to access store), return `NamespaceResult { namespaces: Vec<String>, source: String }` where source is `"auto"` or `"configured"`
- [x] 3.2 Resolution order: check configured namespaces first → if empty, try API → on 403, fallback to configured → if nothing, return empty with source `"none"`
- [x] 3.3 When configured namespaces are used, skip API call entirely (avoids Lens's persistent 403 notification bug)
- [x] 3.4 Frontend prevents `watch_namespaces` call when source is `"configured"` (static list, no watch needed)
- [x] 3.5 `get_namespaces` returns `NamespaceResult` with `source` field used by frontend after connect

## 4. Frontend: Type Definitions and Command Bindings

- [x] 4.1 Add types to `src/lib/types/kubernetes.ts`:
  - `ClusterSettings { accessible_namespaces: string[] }`
  - `NamespaceSource: "auto" | "configured" | "none"`
  - `NamespaceResult { namespaces: string[], source: NamespaceSource }`
- [x] 4.2 Add Tauri command bindings in `src/lib/tauri/commands/cluster.ts`:
  - `getClusterSettings(context: string): Promise<ClusterSettings | null>`
  - `setClusterAccessibleNamespaces(context: string, namespaces: string[]): Promise<void>`
  - `clearClusterSettings(context: string): Promise<void>`

## 5. Frontend: Cluster Store Changes

- [x] 5.1 Add `namespaceSource: NamespaceSource` to cluster store state (default: `"none"`)
- [x] 5.2 Modify `fetchNamespaces` to handle new `NamespaceResult` response with `source` field
- [x] 5.3 Add `saveAccessibleNamespaces(context: string, namespaces: string[])` action:
  - Writes to Tauri store
  - Updates local `namespaces` and `namespaceSource` state
  - Stops active namespace watch (no longer needed)
- [x] 5.4 Add `clearAccessibleNamespaces(context: string)` action that resets to auto-discovery mode

<!-- Phase 2: Tasks 6-8 — UI Components + Integration + Testing -->

## 6. Frontend: Configure Namespaces Dialog

- [x] 6.1 Create `ConfigureNamespacesDialog` component (`src/components/features/home/components/ConfigureNamespacesDialog.tsx`):
  - Textarea input for namespace names (one per line)
  - Pre-fill with existing configured namespaces if editing
  - "Save" button: parses lines, trims whitespace, deduplicates, filters empty, calls `saveAccessibleNamespaces`
  - "Clear" button: resets to auto-discovery via `clearAccessibleNamespaces`
  - "Cancel" button: closes without saving
  - Collapsible help section ("Why do I need this?") with HelpCircle icon
- [x] 6.2 Use existing `Dialog` component from `@/components/ui/dialog`
- [x] 6.3 Add client-side DNS-1123 label validation: show inline warnings for names not matching `/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/` (non-blocking, user can still save)

## 7. Frontend: UI Integration Points

- [x] 7.1 **NamespaceSection** (`NamespaceSection.tsx`): When `isConnected && namespaces.length === 0`, show:
  - Info text: "Namespace listing not permitted"
  - Button: "Configure accessible namespaces" → opens `ConfigureNamespacesDialog`
  - Remove the early `return null` for this case
- [x] 7.2 **NamespaceSection badge**: When `namespaceSource === "configured"`, show "(configured)" text next to section header
- [x] 7.3 **ClusterGridCard**: Add settings button with "Configure Namespaces" → opens `ConfigureNamespacesDialog` for that cluster's context
- [x] 7.4 **ClusterListCard**: Same settings button as ClusterGridCard
- [x] 7.5 **"All Namespaces" in configured mode**: Modify `useK8sResource` hook — when `namespaceSource === "configured"` and `namespace === ""` (All Namespaces), fetch resources as union of per-namespace queries via `Promise.allSettled` instead of passing empty namespace (which triggers cluster-scoped `Api::all` → 403)
- [x] 7.6 **Per-namespace error handling**: When a configured namespace returns 403 on resource fetch, show inline error for that namespace only (don't fail the entire resource list). Applies to all resource views via `Promise.allSettled` pattern in both `useK8sResource` and `useOptionalNamespaceResource`
- [x] 7.7 **Home page configured indicator**: Show "NS" badge on ClusterGridCard and ClusterListCard when namespaces are configured for that context (loaded from store on home page mount)

## 8. Testing

- [x] 8.1 Frontend: `cluster-store.test.ts` updated — `getNamespaces` mock returns `NamespaceResult` with source field
- [x] 8.2 Frontend: Connect test verifies namespace watch only starts when `source === "auto"`
- [x] 8.3 Frontend: `fetchNamespaces` test verifies `namespaces` array extracted from `NamespaceResult`
- [x] 8.4 Frontend: E2E mock (`mock.ts`) updated to return `NamespaceResult` — e2e tests pass
- [x] 8.5 Frontend: All 309 unit tests pass, all e2e tests pass
- [ ] 8.6 Rust: Unit tests for `test_connection`, settings CRUD, and namespace resolution (deferred — requires kube-rs client mocking infrastructure)

<!-- v1.1 follow-up (not in scope for this change) -->
<!-- - "Retry auto-discovery" button in NamespaceSection when source="configured" -->
<!-- - Import namespaces from kubeconfig contexts -->
<!-- - Export/import cluster-settings.json for team sharing -->
