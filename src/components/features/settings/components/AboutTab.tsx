import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { Heart, RefreshCw, Download } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useUpdater } from "@/lib/hooks/useUpdater";

interface AboutTabProps {
  appVersion: string;
}

export function AboutTab({ appVersion }: AboutTabProps) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const {
    checking,
    available,
    downloading,
    progress,
    error,
    update,
    checkForUpdates,
    downloadAndInstall,
  } = useUpdater();

  const handleCheckForUpdates = useCallback(async () => {
    await checkForUpdates(true);
  }, [checkForUpdates]);

  return (
    <div className="flex flex-col items-center text-center py-4">
      <div className="mb-4 rounded-2xl bg-muted p-4">
        <Image
          src="/kubeli-icon.png"
          alt="Kubeli"
          width={80}
          height={80}
          className="rounded-xl"
        />
      </div>
      <h2 className="text-2xl font-bold mb-1">{t("about.title")}</h2>
      <p className="text-sm text-muted-foreground mb-2">
        {tc("version")} {appVersion}
      </p>

      {/* Update Check Section */}
      <div className="mb-4 space-y-2">
        {downloading ? (
          <div className="space-y-2">
            <Button size="sm" disabled>
              <RefreshCw className="size-4 mr-2 animate-spin" />
              {t("about.downloading", { progress: Math.round(progress) })}
            </Button>
            <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : available && update ? (
          <Button size="sm" onClick={() => downloadAndInstall()}>
            <Download className="size-4 mr-2" />
            {t("about.updateTo", { version: update.version })}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={handleCheckForUpdates}
            disabled={checking}
          >
            {checking ? (
              <>
                <RefreshCw className="size-4 mr-2 animate-spin" />
                {t("about.checking")}
              </>
            ) : (
              <>
                <RefreshCw className="size-4 mr-2" />
                {t("about.checkForUpdates")}
              </>
            )}
          </Button>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <div className="max-w-md space-y-4 text-sm text-muted-foreground">
        <p>
          <span className="text-foreground font-medium">
            {t("about.thankYou")}
          </span>
        </p>
        <p>{t("about.description")}</p>
        <p>{t("about.devNote")}</p>
        <p className="flex items-center justify-center gap-1.5">
          {t("about.happyOrchestrating")}{" "}
          <Heart className="size-4 text-red-500 fill-red-500" />
        </p>
      </div>

      <Separator className="my-6 w-full" />

      <div className="text-xs text-muted-foreground/70 space-y-2">
        <div className="space-y-0.5">
          <p className="text-muted-foreground">{t("about.developer")}</p>
          <p className="font-medium text-foreground">Atilla Deniz</p>
          <a
            href="https://atilladeniz.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            atilladeniz.com
          </a>
        </div>
        <p className="pt-1">{t("about.tagline")}</p>
        <p>&copy; {new Date().getFullYear()} Kubeli</p>
      </div>
    </div>
  );
}
