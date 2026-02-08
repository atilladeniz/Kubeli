"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export function CronJobSuspendBadge({ suspend }: { suspend: boolean }) {
  const t = useTranslations("workloads");

  return (
    <Badge
      variant="outline"
      className={cn(
        suspend
          ? "bg-yellow-500/10 text-yellow-500"
          : "bg-green-500/10 text-green-500"
      )}
    >
      {suspend ? t("suspended") : t("active")}
    </Badge>
  );
}
