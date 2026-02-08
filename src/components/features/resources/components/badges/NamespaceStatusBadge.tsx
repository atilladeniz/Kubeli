"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { getStatusBadgeToneClass } from "./statusBadgeStyles";

const statusTranslationKeys: Record<string, string> = {
  Active: "active",
  Terminating: "terminating",
  Unknown: "unknown",
};

export function NamespaceStatusBadge({ status }: { status: string }) {
  const t = useTranslations("common");
  const translationKey = statusTranslationKeys[status];
  const label = translationKey ? t(translationKey) : status;

  return (
    <Badge
      variant="outline"
      className={cn(
        "border font-medium",
        getStatusBadgeToneClass(status === "Active" ? "success" : "warning")
      )}
    >
      {label}
    </Badge>
  );
}
