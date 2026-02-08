"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import {
  getStatusBadgeConfig,
  nodeStatusConfig,
  resolveBadgeLabel,
} from "./badgeConfig";
import { getStatusBadgeToneClass } from "./statusBadgeStyles";

export function NodeStatusBadge({ status }: { status: string }) {
  const t = useTranslations("common");
  const config = getStatusBadgeConfig(nodeStatusConfig, status);
  const label = config ? resolveBadgeLabel(config.label, { common: t }) : status;

  return (
    <Badge
      variant="outline"
      className={cn(
        "border font-medium",
        getStatusBadgeToneClass(config?.tone || "warning")
      )}
    >
      {label}
    </Badge>
  );
}
