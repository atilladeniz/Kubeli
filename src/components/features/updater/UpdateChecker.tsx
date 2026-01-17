"use client";

import { Download, RefreshCw, X, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useUpdater } from "@/lib/hooks/useUpdater";
import { useUIStore } from "@/lib/stores/ui-store";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function UpdateChecker() {
  const t = useTranslations("updates");
  const tc = useTranslations("common");
  const {
    checking,
    available,
    downloading,
    progress,
    error,
    update,
    downloadAndInstall,
    dismissUpdate,
    isSimulated,
    checkerDismissed,
    downloadComplete,
  } = useUpdater({ checkInterval: UPDATE_CHECK_INTERVAL_MS });

  const autoInstallUpdates = useUIStore((state) => state.settings.autoInstallUpdates);

  // Don't render if auto-install is enabled (toast will show instead)
  if (autoInstallUpdates && isSimulated) {
    return null;
  }

  // Don't render if user dismissed the checker (but update is still available for header button)
  if (checkerDismissed) {
    return null;
  }

  // Don't render if download is complete (restart dialog or header button will handle it)
  if (downloadComplete) {
    return null;
  }

  // Don't render if no update available and not checking
  if (!available && !checking && !downloading) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-card p-4 shadow-lg",
        "animate-in slide-in-from-bottom-5 duration-300"
      )}
    >
      {checking ? (
        <div className="flex items-center gap-3">
          <RefreshCw className="size-5 animate-spin text-muted-foreground" />
          <span className="text-sm">{t("checkingForUpdates")}</span>
        </div>
      ) : downloading ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Download className="size-5 text-primary animate-pulse" />
            <span className="text-sm font-medium">{t("downloading")}</span>
          </div>
          <Progress value={progress} className="h-1" />
          <p className="text-xs text-muted-foreground">
            {t("percentComplete", { percent: Math.round(progress) })}
          </p>
        </div>
      ) : available && update ? (
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <div>
                <p className="text-sm font-medium">{t("available")}</p>
                <p className="text-xs text-muted-foreground">
                  {tc("version")} {update.version}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={dismissUpdate}
            >
              <X className="size-4" />
            </Button>
          </div>

          {update.body && (
            <p className="text-xs text-muted-foreground line-clamp-3">
              {update.body}
            </p>
          )}

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => downloadAndInstall()}
            >
              <Download className="size-4 mr-2" />
              {t("installUpdate")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={dismissUpdate}
            >
              {t("restartLater")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
