import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useUpdater } from "@/lib/hooks/useUpdater";

export function UpdateButton() {
  const tu = useTranslations("updates");
  const { available, update, downloading, progress, readyToRestart, downloadComplete, downloadAndInstall, restartNow } = useUpdater();

  if (!available || !update) return null;

  return (
    <Button
      variant="default"
      size="sm"
      className="h-5 text-[10px] px-2 py-0"
      onClick={() => (readyToRestart || downloadComplete) ? restartNow() : downloadAndInstall()}
      disabled={downloading}
    >
      {downloading ? `${Math.round(progress)}%` : (readyToRestart || downloadComplete) ? tu("restartNow") : tu("updateNow")}
    </Button>
  );
}
