import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";

export function NotConnectedState() {
  const t = useTranslations();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="rounded-2xl bg-muted p-6">
        <AlertCircle className="size-16 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold">{t("cluster.disconnected")}</h2>
      <p className="text-muted-foreground">{t("cluster.selectClusterDesc")}</p>
    </div>
  );
}
