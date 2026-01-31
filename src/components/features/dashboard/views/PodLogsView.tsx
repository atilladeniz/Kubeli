"use client";

import { LogViewer } from "../../logs/LogViewer";
import { useTabsStore } from "@/lib/stores/tabs-store";

export function PodLogsView() {
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const tabs = useTabsStore((s) => s.tabs);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const metadata = activeTab?.metadata;

  if (!metadata?.namespace || !metadata?.podName) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No pod selected
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-hidden min-h-0">
        <LogViewer
          namespace={metadata.namespace}
          podName={metadata.podName}
        />
      </div>
    </div>
  );
}
