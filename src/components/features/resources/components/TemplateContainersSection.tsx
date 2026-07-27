"use client";

import { useMemo } from "react";
import { Box } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import { parseTemplateContainers } from "../lib/utils";

interface TemplateContainersSectionProps {
  /** Resource YAML; the pod template is read from spec.template.spec */
  yaml: string | undefined;
}

/**
 * Containers declared in a workload's pod template.
 *
 * Distinct from ContainerStatusSection, which reports the live state of a
 * running pod. A template has no instance, so there is nothing to say beyond
 * name and image.
 */
export function TemplateContainersSection({ yaml }: TemplateContainersSectionProps) {
  const t = useTranslations();
  const containers = useMemo(() => parseTemplateContainers(yaml), [yaml]);

  if (containers.length === 0) return null;

  return (
    <section>
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Box className="size-4" />
        {t("podDetail.containers")}
        <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
          {containers.length}
        </Badge>
      </h3>
      <div className="space-y-2">
        {containers.map((container) => (
          <div
            key={`${container.init ? "init" : "main"}-${container.name}`}
            className="rounded-lg border bg-card px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{container.name}</span>
              {container.init && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 text-muted-foreground">
                  {t("podDetail.initContainer")}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground font-mono break-all mt-0.5">
              {container.image || "-"}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
