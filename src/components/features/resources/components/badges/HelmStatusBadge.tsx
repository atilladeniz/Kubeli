"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { getStatusBadgeToneClass, type StatusBadgeTone } from "./statusBadgeStyles";

const variants: Record<string, StatusBadgeTone> = {
  deployed: "success",
  superseded: "neutral",
  failed: "danger",
  uninstalling: "warning",
  "pending-install": "info",
  "pending-upgrade": "info",
  "pending-rollback": "warning",
  uninstalled: "neutral",
};

const statusTranslationKeys: Record<string, string> = {
  deployed: "deployed",
  superseded: "superseded",
  failed: "failed",
  uninstalling: "uninstalling",
  "pending-install": "pendingInstall",
  "pending-upgrade": "pendingUpgrade",
  "pending-rollback": "pendingRollback",
  uninstalled: "uninstalled",
};

export function HelmStatusBadge({ status }: { status: string }) {
  const t = useTranslations("helm");
  const translationKey = statusTranslationKeys[status];
  const label = translationKey ? t(translationKey) : status;

  return (
    <Badge
      variant="outline"
      className={cn(
        "border font-medium",
        getStatusBadgeToneClass(variants[status] || "neutral")
      )}
    >
      {label}
    </Badge>
  );
}
