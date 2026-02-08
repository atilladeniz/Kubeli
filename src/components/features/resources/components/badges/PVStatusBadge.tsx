"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { getStatusBadgeToneClass, type StatusBadgeTone } from "./statusBadgeStyles";

const variants: Record<string, StatusBadgeTone> = {
  Available: "success",
  Bound: "info",
  Released: "warning",
  Failed: "danger",
  Pending: "warning",
};

const statusTranslationKeys: Record<string, string> = {
  Available: "storage.available",
  Bound: "storage.bound",
  Released: "storage.released",
  Failed: "workloads.failed",
  Pending: "workloads.pending",
};

export function PVStatusBadge({ status }: { status: string }) {
  const t = useTranslations();
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
