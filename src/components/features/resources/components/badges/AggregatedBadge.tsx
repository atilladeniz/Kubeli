"use client";

import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";

export function AggregatedBadge() {
  const t = useTranslations("common");

  return (
    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-blue-500/10 text-blue-500">
      {t("aggregated")}
    </Badge>
  );
}
