"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { getStatusBadgeToneClass, type StatusBadgeTone } from "./statusBadgeStyles";

const variants: Record<string, StatusBadgeTone> = {
  ready: "success",
  notready: "warning",
  reconciling: "info",
  failed: "danger",
  unknown: "neutral",
};

const statusTranslationKeys: Record<string, string> = {
  ready: "ready",
  notready: "notReady",
  reconciling: "reconciling",
  failed: "failed",
  unknown: "unknown",
};

export function FluxKustomizationStatusBadge({ status }: { status: string }) {
  const t = useTranslations("common");
  const translationKey = statusTranslationKeys[status];
  const label = translationKey ? t(translationKey) : status;

  return (
    <Badge
      variant="outline"
      className={cn(
        "border font-medium",
        getStatusBadgeToneClass(variants[status] || "neutral")
      )}
    >
      {label}
    </Badge>
  );
}
