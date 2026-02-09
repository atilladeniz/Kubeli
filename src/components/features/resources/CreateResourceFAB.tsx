"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslations } from "next-intl";
import { usePlatform } from "@/lib/hooks/usePlatform";

/** Views where creating resources doesn't apply */
const HIDDEN_VIEWS = new Set([
  "cluster-overview",
  "resource-diagram",
  "workloads-overview",
  "nodes",
  "events",
  "namespaces",
  "port-forwards",
  "helm-releases",
  "flux-kustomizations",
  "pod-logs",
]);

interface CreateResourceFABProps {
  activeResource: string;
  onClick: () => void;
}

export function CreateResourceFAB({ activeResource, onClick }: CreateResourceFABProps) {
  const t = useTranslations("createResource");
  const { modKeySymbol } = usePlatform();

  if (HIDDEN_VIEWS.has(activeResource)) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          onClick={onClick}
          className="absolute bottom-6 right-6 z-10 size-12 rounded-full shadow-lg border border-border"
        >
          <Plus className="size-6" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">
        {t("title")} ({modKeySymbol}N)
      </TooltipContent>
    </Tooltip>
  );
}
