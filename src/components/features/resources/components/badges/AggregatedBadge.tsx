"use client";

import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";

export function AggregatedBadge() {
  const t = useTranslations("common");

  return (
    <Badge variant="outline" className="text-xs px-1.5 py-0.5 bg-blue-500/10 text-blue-500">
      {t("aggregated")}
    </Badge>
  );
}
