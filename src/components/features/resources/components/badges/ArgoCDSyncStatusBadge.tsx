"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import {
  argoCDSyncStatusConfig,
  getStatusBadgeConfig,
  resolveBadgeLabel,
} from "./badgeConfig";
import { getStatusBadgeToneClass } from "./statusBadgeStyles";

export function ArgoCDSyncStatusBadge({ status }: { status: string }) {
  const tArgoCD = useTranslations("argocd");
  const config = getStatusBadgeConfig(argoCDSyncStatusConfig, status);
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
