"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import {
  failurePolicyConfig,
  getStatusBadgeConfig,
  resolveBadgeLabel,
} from "./badgeConfig";
import { getStatusBadgeToneClass } from "./statusBadgeStyles";

export function FailurePolicyBadge({ policy }: { policy: string }) {
  const t = useTranslations("common");
  const config = getStatusBadgeConfig(failurePolicyConfig, policy);
  const label = config ? resolveBadgeLabel(config.label, { common: t }) : policy;

  return (
    <Badge
      variant="outline"
      className={cn("border font-medium", getStatusBadgeToneClass(config?.tone || "neutral"))}
    >
      {label}
    </Badge>
  );
}
