"use client";

import { useTranslations } from "next-intl";
import { WorkloadLogViewer } from "../../logs/WorkloadLogViewer";
import { useTabsStore } from "@/lib/stores/tabs-store";

export function WorkloadLogsView() {
  const t = useTranslations();
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const tabs = useTabsStore((s) => s.tabs);
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const metadata = activeTab?.metadata;

  // deploymentName is the pre-#212 metadata key; tabs persisted by an older
  // version still carry it.
  const workloadName = metadata?.workloadName ?? metadata?.deploymentName;

  if (!metadata?.namespace || !workloadName) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        {t("empty.noDeploymentSelected")}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-hidden min-h-0">
        <WorkloadLogViewer
          key={activeTab?.id}
          workloadName={workloadName}
          namespace={metadata.namespace}
          kind={metadata.workloadKind ?? "deployment"}
          autoStream={metadata.autoStream}
        />
      </div>
    </div>
  );
}
