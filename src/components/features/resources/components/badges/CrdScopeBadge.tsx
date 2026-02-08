"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { crdScopeLabels, getLabelRef, resolveBadgeLabel } from "./badgeConfig";

export function CrdScopeBadge({ scope }: { scope: string }) {
  const t = useTranslations("common");
  const labelRef = getLabelRef(crdScopeLabels, scope);
  const label = labelRef
    ? resolveBadgeLabel(labelRef, { common: t })
    : scope;

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] border-0",
        scope === "Namespaced"
          ? "bg-blue-500/10 text-blue-500"
          : "bg-purple-500/10 text-purple-500"
      )}
    >
      {label}
    </Badge>
  );
}
