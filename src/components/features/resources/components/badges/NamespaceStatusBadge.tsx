"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import {
  getStatusBadgeConfig,
  namespaceStatusConfig,
  resolveBadgeLabel,
} from "./badgeConfig";
import { getStatusBadgeToneClass } from "./statusBadgeStyles";

export function NamespaceStatusBadge({ status }: { status: string }) {
  const t = useTranslations("common");
  const config = getStatusBadgeConfig(namespaceStatusConfig, status);
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
