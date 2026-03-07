"use client";

import { GitFork } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import type { OwnerReference } from "../types";

interface OwnerReferencesSectionProps {
  ownerReferences: OwnerReference[];
  onNavigate: (kind: string, name: string, namespace?: string) => void;
  namespace?: string;
}

export function OwnerReferencesSection({
  ownerReferences,
  onNavigate,
  namespace,
}: OwnerReferencesSectionProps) {
  const t = useTranslations();

  return (
    <section>
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <GitFork className="size-4" />
        {t("resourceDetail.ownedBy")}
      </h3>
      <div className="space-y-2">
        {ownerReferences.map((ref) => (
          <button
            key={ref.uid}
            type="button"
            onClick={() => onNavigate(ref.kind, ref.name, namespace)}
            className="flex w-full items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
          >
            <Badge variant="secondary" className="shrink-0 text-xs">
              {ref.kind}
            </Badge>
            <span className="min-w-0 truncate font-medium">{ref.name}</span>
            {ref.controller && (
              <Badge
                variant="outline"
                className="ml-auto shrink-0 text-[10px] font-normal text-muted-foreground"
              >
                controller
              </Badge>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
