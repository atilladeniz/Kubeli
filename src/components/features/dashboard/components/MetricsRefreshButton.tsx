"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslations } from "next-intl";
import { useUIStore } from "@/lib/stores/ui-store";

interface MetricsRefreshButtonProps {
  onRefresh: () => void;
  isLoading?: boolean;
}

/**
 * Manual metrics refresh.
 *
 * Always available, not just when polling is off — a user watching a rollout
 * wants the current numbers now, regardless of when the next poll lands.
 */
export function MetricsRefreshButton({ onRefresh, isLoading }: MetricsRefreshButtonProps) {
  const t = useTranslations();
  const intervalSeconds = useUIStore((s) => s.settings.metricsRefreshInterval);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onRefresh}
          disabled={isLoading}
          aria-label={t("metrics.refresh")}
        >
          <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {intervalSeconds > 0
          ? t("metrics.refreshWithInterval", { seconds: intervalSeconds })
          : t("metrics.refreshAutoDisabled")}
      </TooltipContent>
    </Tooltip>
  );
}
