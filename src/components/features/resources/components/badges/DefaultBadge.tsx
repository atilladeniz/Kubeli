"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export function DefaultBadge({ className }: { className?: string }) {
  const t = useTranslations("common");

  return (
    <Badge
      variant="outline"
      className={cn("text-xs px-1.5 py-0.5 font-medium", className)}
    >
      {t("default")}
    </Badge>
  );
}
