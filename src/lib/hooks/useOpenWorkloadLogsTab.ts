"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useTabsStore } from "@/lib/stores/tabs-store";
import type { WorkloadLogKind } from "./useWorkloadLogs";

/**
 * Opens (or focuses) the aggregated log tab for a workload.
 *
 * The tab type stays "deployment-logs" for every workload kind — it is
 * persisted in restored tabs, so renaming it would strand existing sessions.
 * The actual kind travels in the tab metadata.
 */
export function useOpenWorkloadLogsTab() {
  const t = useTranslations();
  const openOrActivateTab = useTabsStore((s) => s.openOrActivateTab);

  return useCallback(
    (
      kind: WorkloadLogKind,
      name: string,
      namespace: string,
      opts?: { autoStream?: boolean },
    ) => {
      const result = openOrActivateTab(
        "deployment-logs",
        `Logs: ${name} (${namespace})`,
        { namespace, workloadName: name, workloadKind: kind, autoStream: opts?.autoStream },
        (tab) =>
          tab.type === "deployment-logs" &&
          tab.metadata?.workloadName === name &&
          tab.metadata?.workloadKind === kind &&
          tab.metadata?.namespace === namespace,
      );
      if (result === null) {
        toast.warning(t("tabs.limitToast"));
        return false;
      }
      return true;
    },
    [openOrActivateTab, t],
  );
}
