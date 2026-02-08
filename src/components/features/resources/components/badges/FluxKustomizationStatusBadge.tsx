"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import {
  fluxStatusConfig,
  getStatusBadgeConfig,
  resolveBadgeLabel,
} from "./badgeConfig";
import { getStatusBadgeToneClass } from "./statusBadgeStyles";

export function FluxKustomizationStatusBadge({ status }: { status: string }) {
  const tCommon = useTranslations("common");
  const tWorkloads = useTranslations("workloads");
  const config = getStatusBadgeConfig(fluxStatusConfig, status);
  const label = config
    ? resolveBadgeLabel(config.label, { common: tCommon, workloads: tWorkloads })
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
