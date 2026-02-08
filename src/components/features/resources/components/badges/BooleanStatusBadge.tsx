"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { getStatusBadgeToneClass, type StatusBadgeTone } from "./statusBadgeStyles";

interface BooleanStatusBadgeProps {
  value: boolean;
  trueKey: string;
  falseKey: string;
  trueTone?: StatusBadgeTone;
  falseTone?: StatusBadgeTone;
}

export function BooleanStatusBadge({
  value,
  trueKey,
  falseKey,
  trueTone = "success",
  falseTone = "neutral",
}: BooleanStatusBadgeProps) {
  const t = useTranslations();
  const key = value ? trueKey : falseKey;

  return (
    <Badge
      variant="outline"
      className={cn(
        "border font-medium",
        getStatusBadgeToneClass(value ? trueTone : falseTone)
      )}
    >
      {t(key)}
    </Badge>
  );
}
