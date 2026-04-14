"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import {
  argoCDHealthStatusConfig,
  getStatusBadgeConfig,
  resolveBadgeLabel,
} from "./badgeConfig";
import { getStatusBadgeToneClass } from "./statusBadgeStyles";

import type { ArgoCDHealthStatus } from "@/lib/types/kubernetes";

export function ArgoCDHealthStatusBadge({ status }: { status: ArgoCDHealthStatus }) {
  const tArgoCD = useTranslations("argocd");
  const config = getStatusBadgeConfig(argoCDHealthStatusConfig, status);
  const label = config
    ? resolveBadgeLabel(config.label, { argocd: tArgoCD })
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
