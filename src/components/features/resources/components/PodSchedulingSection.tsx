"use client";

import { SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import type { TolerationInfo } from "@/lib/types";

interface PodSchedulingSectionProps {
  serviceAccount: string | null;
  nodeSelector: Record<string, string>;
  tolerations: TolerationInfo[];
  namespace?: string;
  onNavigate?: (kind: string, name: string, namespace?: string) => void;
}

function formatToleration(toleration: TolerationInfo): string {
  const parts: string[] = [];
  if (toleration.key) {
    parts.push(toleration.key);
  }
  if (toleration.operator) {
    parts.push(toleration.operator);
  }
  if (toleration.value) {
    parts.push(toleration.value);
  }
  return parts.join(" ");
}

export function PodSchedulingSection({
  serviceAccount,
  nodeSelector,
  tolerations,
  namespace,
  onNavigate,
}: PodSchedulingSectionProps) {
  const t = useTranslations();
  const nodeSelectorEntries = Object.entries(nodeSelector);

  if (!serviceAccount && nodeSelectorEntries.length === 0 && tolerations.length === 0) {
    return null;
  }

  return (
    <section>
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <SlidersHorizontal className="size-4" />
        {t("podDetail.scheduling")}
      </h3>
      <div className="space-y-4 text-sm">
        {serviceAccount && (
          <div>
            <dt className="text-muted-foreground">{t("podDetail.serviceAccount")}</dt>
            <dd className="mt-0.5">
              {onNavigate ? (
                <button
                  type="button"
                  onClick={() => onNavigate("ServiceAccount", serviceAccount, namespace)}
                  className="text-primary hover:underline"
                >
                  {serviceAccount}
                </button>
              ) : (
                serviceAccount
              )}
            </dd>
          </div>
        )}
        {nodeSelectorEntries.length > 0 && (
          <div>
            <dt className="text-muted-foreground">{t("podDetail.nodeSelector")}</dt>
            <dd className="mt-0.5 flex flex-wrap gap-2 min-w-0">
              {nodeSelectorEntries.map(([key, value]) => (
                <Badge
                  key={key}
                  variant="secondary"
                  className="font-mono text-xs max-w-full min-w-0"
                  title={`${key}=${value}`}
                >
                  <span className="truncate">{key}={value}</span>
                </Badge>
              ))}
            </dd>
          </div>
        )}
        {tolerations.length > 0 && (
          <div>
            <dt className="text-muted-foreground">{t("podDetail.tolerations")}</dt>
            <dd className="mt-0.5 space-y-2">
              {tolerations.map((toleration, index) => (
                <div
                  key={index}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2"
                >
                  <span className="min-w-0 truncate font-mono text-xs">
                    {formatToleration(toleration)}
                  </span>
                  {toleration.effect && (
                    <Badge variant="outline" className="shrink-0 text-xs font-normal">
                      {toleration.effect}
                    </Badge>
                  )}
                  {toleration.toleration_seconds !== null && (
                    <Badge
                      variant="outline"
                      className="shrink-0 text-xs font-normal text-muted-foreground"
                    >
                      {toleration.toleration_seconds}s
                    </Badge>
                  )}
                </div>
              ))}
            </dd>
          </div>
        )}
      </div>
    </section>
  );
}
