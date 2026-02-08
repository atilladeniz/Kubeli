"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { getStatusBadgeToneClass } from "./statusBadgeStyles";

export function EventTypeBadge({ type }: { type: string }) {
  const t = useTranslations("common");
  const isWarning = type === "Warning";
  const label = type === "Warning" ? t("warning") : type === "Normal" ? t("normal") : type;

  return (
    <Badge
      variant="outline"
      className={cn(
        "border font-medium",
        getStatusBadgeToneClass(isWarning ? "warning" : "info")
      )}
    >
      {label}
    </Badge>
  );
}
