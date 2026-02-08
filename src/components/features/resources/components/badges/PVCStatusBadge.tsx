"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { getStatusBadgeToneClass, type StatusBadgeTone } from "./statusBadgeStyles";

const variants: Record<string, StatusBadgeTone> = {
  Bound: "success",
  Pending: "warning",
  Lost: "danger",
};

const statusTranslationKeys: Record<string, string> = {
  Bound: "storage.bound",
  Pending: "workloads.pending",
  Lost: "storage.lost",
};

export function PVCStatusBadge({ status }: { status: string }) {
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
