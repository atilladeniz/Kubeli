"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const scopeTranslationKeys: Record<string, string> = {
  Namespaced: "common.namespaced",
  Cluster: "navigation.cluster",
};

export function CrdScopeBadge({ scope }: { scope: string }) {
  const t = useTranslations();
  const translationKey = scopeTranslationKeys[scope];

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
      {translationKey ? t(translationKey) : scope}
    </Badge>
  );
}
