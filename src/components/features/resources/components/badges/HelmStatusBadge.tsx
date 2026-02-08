"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import {
  getStatusBadgeConfig,
  helmStatusConfig,
  resolveBadgeLabel,
} from "./badgeConfig";
import { getStatusBadgeToneClass } from "./statusBadgeStyles";

export function HelmStatusBadge({ status }: { status: string }) {
  const t = useTranslations("helm");
  const config = getStatusBadgeConfig(helmStatusConfig, status);
  const label = config ? resolveBadgeLabel(config.label, { helm: t }) : status;

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
