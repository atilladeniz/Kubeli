"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useClusterStore } from "@/lib/stores/cluster-store";

/** Shown on the home screen while the app reconnects to the last cluster. */
export function StartupReconnectBanner() {
  const t = useTranslations("cluster");
  const context = useClusterStore((s) => s.startupReconnectContext);
  const clusters = useClusterStore((s) => s.clusters);
  const cancel = useClusterStore((s) => s.cancelStartupReconnect);

  if (!context) return null;
  const name = clusters.find((c) => c.context === context)?.name ?? context;

  return (
    <div
      role="status"
      className="mx-auto mt-4 flex w-full max-w-6xl items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-2 text-sm"
    >
      <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
      <span className="flex-1 truncate">{t("startupReconnecting", { name })}</span>
      <Button variant="outline" size="sm" onClick={cancel}>
        {t("startupReconnectCancel")}
      </Button>
    </div>
  );
}
