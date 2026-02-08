"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { getStatusBadgeToneClass, type StatusBadgeTone } from "./statusBadgeStyles";

const variants: Record<string, StatusBadgeTone> = {
  Complete: "success",
  Running: "info",
  Failed: "danger",
  Pending: "warning",
};

const statusTranslationKeys: Record<string, string> = {
  Complete: "complete",
  Running: "running",
  Failed: "failed",
  Pending: "pending",
};

export function JobStatusBadge({ status }: { status: string }) {
  const t = useTranslations("workloads");
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
