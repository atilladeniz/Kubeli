"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import {
  getStatusBadgeConfig,
  jobStatusConfig,
  resolveBadgeLabel,
} from "./badgeConfig";
import { getStatusBadgeToneClass } from "./statusBadgeStyles";

export function JobStatusBadge({ status }: { status: string }) {
  const t = useTranslations("workloads");
  const config = getStatusBadgeConfig(jobStatusConfig, status);
  const label = config ? resolveBadgeLabel(config.label, { workloads: t }) : status;

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
