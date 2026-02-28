"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { FileX, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogViewer } from "../../logs/LogViewer";
import { useTabsStore } from "@/lib/stores/tabs-store";
import { useLogStore } from "@/lib/stores/log-store";

export function PodLogsView() {
  const t = useTranslations();
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const tabs = useTabsStore((s) => s.tabs);
  const navigateCurrentTab = useTabsStore((s) => s.navigateCurrentTab);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const metadata = activeTab?.metadata;
  const logTab = useLogStore((s) => activeTabId ? s.logTabs[activeTabId] : undefined);
  const podGone = useMemo(() => {
    const err = logTab?.error;
    return !!err && (err.kind === "NotFound" || err.message.includes("not found"));
  }, [logTab?.error]);
  const hasLogs = (logTab?.logs?.length ?? 0) > 0;

  if (!metadata?.namespace || !metadata?.podName) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        {t("empty.noPodSelected")}
      </div>
    );
  }

  if (podGone && !hasLogs) {
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
          <ArrowRight className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-hidden min-h-0">
        <LogViewer
          key={activeTab?.id}
          namespace={metadata.namespace}
          podName={metadata.podName}
        />
      </div>
    </div>
  );
}
