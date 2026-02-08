"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { resolveBadgeLabel } from "./badgeConfig";
import { getStatusBadgeToneClass } from "./statusBadgeStyles";

export function VolumeAttachmentStatusBadge({ attached }: { attached: boolean }) {
  const tStorage = useTranslations("storage");
  const tWorkloads = useTranslations("workloads");
  const label = attached
    ? resolveBadgeLabel({ namespace: "storage", key: "attached" }, { storage: tStorage })
    : resolveBadgeLabel({ namespace: "workloads", key: "pending" }, { workloads: tWorkloads });

  return (
    <Badge
      variant="outline"
      className={cn(
        "border font-medium",
        getStatusBadgeToneClass(attached ? "success" : "warning")
      )}
    >
      {label}
    </Badge>
  );
}
