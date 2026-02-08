"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import {
  booleanBadgeVariants,
  type BooleanBadgeVariant,
  resolveBadgeLabel,
} from "./badgeConfig";
import { getStatusBadgeToneClass } from "./statusBadgeStyles";

interface BooleanStatusBadgeProps {
  value: boolean;
  variant: BooleanBadgeVariant;
}

export function BooleanStatusBadge({
  value,
  variant,
}: BooleanStatusBadgeProps) {
  const tCommon = useTranslations("common");
  const tWorkloads = useTranslations("workloads");
  const config = booleanBadgeVariants[variant];
  const label = resolveBadgeLabel(
    value ? config.trueLabel : config.falseLabel,
    { common: tCommon, workloads: tWorkloads }
  );

  return (
    <Badge
      variant="outline"
      className={cn(
        "border font-medium",
        getStatusBadgeToneClass(value ? config.trueTone : config.falseTone)
      )}
    >
      {label}
    </Badge>
  );
}
