"use client";

import { useTranslations } from "next-intl";
import { DeploymentLogViewer } from "../../logs/DeploymentLogViewer";
import { useTabsStore } from "@/lib/stores/tabs-store";

export function DeploymentLogsView() {
  const t = useTranslations();
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const tabs = useTabsStore((s) => s.tabs);
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const metadata = activeTab?.metadata;

  if (!metadata?.namespace || !metadata?.deploymentName) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        {t("empty.noDeploymentSelected")}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-hidden min-h-0">
        <DeploymentLogViewer
          key={activeTab?.id}
          deploymentName={metadata.deploymentName}
          namespace={metadata.namespace}
          autoStream={metadata.autoStream}
        />
      </div>
    </div>
  );
}
