"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import {
  getStatusBadgeConfig,
  pvcStatusConfig,
  resolveBadgeLabel,
} from "./badgeConfig";
import { getStatusBadgeToneClass } from "./statusBadgeStyles";

export function PVCStatusBadge({ status }: { status: string }) {
  const tStorage = useTranslations("storage");
  const tWorkloads = useTranslations("workloads");
  const config = getStatusBadgeConfig(pvcStatusConfig, status);
  const label = config
    ? resolveBadgeLabel(config.label, { storage: tStorage, workloads: tWorkloads })
    : status;

  return (
    <Badge
      variant="outline"
      className={cn(
        "border font-medium",
        getStatusBadgeToneClass(config?.tone || "neutral")
      )}
    >
      {label}
    </Badge>
  );
}
