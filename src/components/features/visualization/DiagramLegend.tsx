import { useTranslations } from "next-intl";

export function DiagramLegend() {
  const t = useTranslations("diagram");

  return (
    <div className="flex items-center gap-4 px-4 py-3 border-t text-xs text-muted-foreground">
      <div className="flex items-center gap-1">
        <span className="size-2 rounded-full bg-green-500" />
        <span>{t("healthy")}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="size-2 rounded-full bg-yellow-500" />
        <span>{t("warning")}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="size-2 rounded-full bg-red-500" />
        <span>{t("error")}</span>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-muted-foreground">
          {t("hierarchy")}
        </span>
      </div>
    </div>
  );
}
