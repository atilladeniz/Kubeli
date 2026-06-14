/**
 * ArgoCD operation phases that mean a sync/rollback is still in progress.
 *
 * `Terminating` is a running operation being cancelled — ArgoCD keeps `.operation`
 * set and rejects a new one until it clears, so the UI must treat it the same as
 * `Running` (disable rollback, keep polling). Mirrors `is_in_progress_phase` in
 * the Rust backend (`src-tauri/src/commands/argocd.rs`).
 */
export const OPERATION_IN_PROGRESS_PHASES = new Set(["Running", "Terminating"]);

/** True while a sync/rollback is still running (`Running` or `Terminating`). */
export function isOperationInProgress(
  phase: string | null | undefined,
): boolean {
  return phase != null && OPERATION_IN_PROGRESS_PHASES.has(phase);
}
