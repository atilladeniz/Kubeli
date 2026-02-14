import { useTranslations } from "next-intl";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/lib/stores/ui-store";
import { useUpdater } from "@/lib/hooks/useUpdater";

export function HomeTitlebar() {
  const tu = useTranslations("updates");
  const { setSettingsOpen } = useUIStore();
  const {
    available,
    update,
    downloading,
    progress,
    readyToRestart,
    downloadComplete,
    downloadAndInstall,
    restartNow,
  } = useUpdater();

  return (
    <div
      data-tauri-drag-region
      className="flex h-7 shrink-0 items-center justify-center border-b border-border px-6"
    >
      <span
        className="text-xs text-muted-foreground/70"
        data-tauri-drag-region
      >
        Kubeli
      </span>
      <div className="absolute right-2 flex items-center gap-1">
        {available && update && (
          <Button
            variant="default"
            size="sm"
            className="h-5 text-[10px] px-2 py-0"
            onClick={() =>
              readyToRestart || downloadComplete
                ? restartNow()
                : downloadAndInstall()
            }
            disabled={downloading}
          >
            {downloading
              ? `${Math.round(progress)}%`
              : readyToRestart || downloadComplete
                ? tu("restartNow")
                : tu("updateNow")}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
