"use client";

import { PlugZap, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

interface StreamEndedNoticeProps {
  /** Reason the stream ended; null for a clean end-of-stream */
  reason: string | null;
  /** True when the pod is gone, so reconnecting cannot succeed */
  podDeleted?: boolean;
  onReconnect: () => void;
}

/**
 * Inline notice for a stream that ended after running.
 *
 * A stream ends for entirely ordinary reasons — the container exited, the
 * kubelet hit its idle timeout, a load balancer dropped an idle connection —
 * so this reads as a recoverable state, not the error banner it used to be.
 */
export function StreamEndedNotice({ reason, podDeleted, onReconnect }: StreamEndedNoticeProps) {
  const t = useTranslations();

  if (podDeleted) {
    return (
      <div className="flex items-center gap-2 border-t border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
        <Trash2 className="size-4 shrink-0" />
        <span>{t("logs.streamPodDeleted")}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 border-t border-border bg-muted/40 px-4 py-2 text-sm">
      <PlugZap className="size-4 shrink-0 text-muted-foreground" />
      <span className="text-muted-foreground">
        {reason ? t("logs.streamDropped") : t("logs.streamEnded")}
      </span>
      <Button variant="link" size="sm" className="h-auto p-0 text-primary" onClick={onReconnect}>
        {t("logs.reconnect")}
      </Button>
    </div>
  );
}
