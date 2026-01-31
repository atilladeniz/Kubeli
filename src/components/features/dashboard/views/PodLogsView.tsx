"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { FileX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogViewer } from "../../logs/LogViewer";
import { useTabsStore } from "@/lib/stores/tabs-store";
import { listPods } from "@/lib/tauri/commands";

export function PodLogsView() {
  const t = useTranslations();
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const tabs = useTabsStore((s) => s.tabs);
  const navigateCurrentTab = useTabsStore((s) => s.navigateCurrentTab);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const metadata = activeTab?.metadata;
  const [podGone, setPodGone] = useState(false);

  const checkPodExists = useCallback(async () => {
    if (!metadata?.namespace || !metadata?.podName) return;
    try {
      const pods = await listPods({ namespace: metadata.namespace });
      const exists = pods.some((p) => p.name === metadata.podName);
      if (!exists) setPodGone(true);
    } catch {
      // Ignore fetch errors - don't mark as gone on network issues
    }
  }, [metadata]);

  // Check periodically if pod still exists
  useEffect(() => {
    if (!metadata?.namespace || !metadata?.podName) return;
    const interval = setInterval(checkPodExists, 15000);
    return () => clearInterval(interval);
  }, [metadata, checkPodExists]);

  if (!metadata?.namespace || !metadata?.podName) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        {t("empty.noPodSelected")}
      </div>
    );
  }

  if (podGone) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="rounded-2xl bg-muted p-6">
          <FileX className="size-16 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">{t("empty.podNotFound")}</h2>
        <p className="text-center text-muted-foreground max-w-md">
          {t("empty.podNotFoundDescription", {
            podName: metadata.podName,
            namespace: metadata.namespace,
          })}
        </p>
        <Button
          variant="outline"
          onClick={() => navigateCurrentTab("pods", t("navigation.pods"))}
        >
          {t("empty.goToPods")}
        </Button>
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
