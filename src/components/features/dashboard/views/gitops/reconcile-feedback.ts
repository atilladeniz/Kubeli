import { toast } from "sonner";
import { waitFluxReconcile } from "@/lib/tauri/commands";
import { useClusterStore } from "@/lib/stores/cluster-store";

// Follow up the "Reconciliation triggered" toast with the actual outcome
// instead of leaving it to the 30s auto-refresh.
export async function reportReconcileResult(
  t: (key: string) => string,
  kind: "kustomization" | "helmrelease",
  name: string,
  namespace: string,
  token: string,
  startedOnContext: string | undefined,
  refresh: () => void
): Promise<void> {
  let result;
  try {
    result = await waitFluxReconcile(kind, name, namespace, token);
  } catch {
    // Watching failed (persistent API errors) — say so instead of leaving the
    // user with only the optimistic "triggered" toast
    if (useClusterStore.getState().currentCluster?.context === startedOnContext) {
      toast.info(t("flux.resultUnknown"), { description: name });
      refresh();
    }
    return;
  }
  // Don't toast stale results into another cluster's view
  if (useClusterStore.getState().currentCluster?.context !== startedOnContext) {
    return;
  }
  if (result.outcome === "succeeded") {
    toast.success(t("flux.reconcileSucceeded"), { description: name });
  } else if (result.outcome === "failed") {
    toast.error(t("flux.reconcileError"), { description: result.message ?? name });
  } else {
    toast.info(t("flux.reconcilePending"), { description: name });
  }
  refresh();
}
