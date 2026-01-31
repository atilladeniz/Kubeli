# Tasks: Add Kubeconfig Sources Management

## 1. Backend — Multi-Kubeconfig Loading (Rust)

- [ ] 1.1 Add `KubeconfigSources` struct to hold list of file paths and folder paths
- [ ] 1.2 Implement folder scanning (find all `*.yaml`, `*.yml`, `config` files in folder)
- [ ] 1.3 Implement multi-file kubeconfig loading — parse each file independently
- [ ] 1.4 Implement kubeconfig merging logic (combine contexts, clusters, users from all files)
- [ ] 1.5 Handle merge conflicts (duplicate context names → prefix with filename)
- [ ] 1.6 Track which context came from which source file (for UI display)
- [ ] 1.7 Respect `KUBECONFIG` env var as additional source (colon-separated paths)

## 2. Backend — Persistence & File Watching (Rust)

- [ ] 2.1 Add Tauri commands: `get_kubeconfig_sources`, `set_kubeconfig_sources`
- [ ] 2.2 Persist sources config using Tauri plugin-store (JSON)
- [ ] 2.3 Implement file watcher (notify crate) for kubeconfig files
- [ ] 2.4 Emit Tauri event `kubeconfig-changed` when watched files change
- [ ] 2.5 Auto-reload cluster list on file change

## 3. Backend — Tauri Commands

- [ ] 3.1 `add_kubeconfig_source(path, type)` — add file or folder source
- [ ] 3.2 `remove_kubeconfig_source(path)` — remove a source
- [ ] 3.3 `list_kubeconfig_sources()` — return configured sources with metadata (file count, context count)
- [ ] 3.4 `validate_kubeconfig_path(path)` — check if path exists and contains valid kubeconfig
- [ ] 3.5 `set_merge_mode(enabled)` — toggle merge behavior
- [ ] 3.6 Update `list_clusters()` to use merged kubeconfig from all sources

## 4. Frontend — Settings UI

- [ ] 4.1 Add "Kubeconfig" tab to SettingsPanel (between General and Network)
- [ ] 4.2 Build source list component showing each configured path with file/context count
- [ ] 4.3 "Add File" button → native file picker dialog (via Tauri dialog plugin)
- [ ] 4.4 "Add Folder" button → native folder picker dialog
- [ ] 4.5 "Enter Path" button → text input for manual path entry
- [ ] 4.6 Remove button per source (with confirmation for last remaining source)
- [ ] 4.7 "Merge Files" toggle with explanation text
- [ ] 4.8 Show validation errors for invalid/missing paths

## 5. Frontend — State & Integration

- [ ] 5.1 Add kubeconfig source settings to ui-store (persisted)
- [ ] 5.2 Add Tauri command bindings in `commands.ts`
- [ ] 5.3 Listen for `kubeconfig-changed` event → auto-refresh cluster list
- [ ] 5.4 Update cluster list to show source file origin per context
- [ ] 5.5 Handle edge case: all sources removed → show onboarding/empty state

## 6. Default Behavior & Migration

- [ ] 6.1 Default source: `~/.kube/config` (pre-populated on first launch)
- [ ] 6.2 Existing users: auto-migrate to new system with `~/.kube/config` as default source
- [ ] 6.3 Merge mode OFF by default (each file treated as complete kubeconfig)
