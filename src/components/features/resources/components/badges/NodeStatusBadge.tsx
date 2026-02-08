"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { getStatusBadgeToneClass } from "./statusBadgeStyles";

const statusTranslationKeys: Record<string, string> = {
  Ready: "ready",
  NotReady: "notReady",
  Unknown: "unknown",
};

export function NodeStatusBadge({ status }: { status: string }) {
  const t = useTranslations("common");
  const translationKey = statusTranslationKeys[status];
  const label = translationKey ? t(translationKey) : status;

  return (
    <Badge
      variant="outline"
      className={cn(
        "border font-medium",
        getStatusBadgeToneClass(status === "Ready" ? "success" : "warning")
      )}
    >
      {label}
    </Badge>
  );
}
