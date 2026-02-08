"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { getStatusBadgeToneClass } from "./statusBadgeStyles";

export function VolumeAttachmentStatusBadge({ attached }: { attached: boolean }) {
  const t = useTranslations();

  return (
    <Badge
      variant="outline"
      className={cn(
        "border font-medium",
        getStatusBadgeToneClass(attached ? "success" : "warning")
      )}
    >
      {attached ? t("storage.attached") : t("workloads.pending")}
    </Badge>
  );
}
