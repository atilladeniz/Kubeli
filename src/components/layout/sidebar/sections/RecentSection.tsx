"use client";

import { useTranslations } from "next-intl";
import { ChevronRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { RecentSectionProps, ResourceType } from "../types/types";

export function RecentSection({
  isConnected,
  recentResources,
  isRecentSectionOpen,
  setIsRecentSectionOpen,
  onResourceSelect,
}: RecentSectionProps) {
  const t = useTranslations();
  const tNav = useTranslations("navigation");

  if (!isConnected || recentResources.length === 0) {
    return null;
  }

  return (
    <>
      <div className="p-3 overflow-hidden">
        <Collapsible
          open={isRecentSectionOpen}
          onOpenChange={setIsRecentSectionOpen}
        >
          <div
            className={cn(
              "flex items-center justify-between",
              isRecentSectionOpen && "mb-2",
            )}
          >
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Clock className="size-3" />
              {tNav("recent")}
            </span>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-5 p-0 text-muted-foreground hover:text-foreground"
                aria-label={t("common.toggleSection", {
                  section: tNav("recent"),
                })}
              >
                <ChevronRight
                  className={cn(
                    "size-3.5 transition-transform",
                    isRecentSectionOpen && "rotate-90",
                  )}
                />
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="space-y-1">
            {recentResources.map((recent) => (
              <button
                key={`${recent.resourceType}-${recent.name}-${recent.namespace || ""}`}
                onClick={() =>
                  onResourceSelect(recent.resourceType as ResourceType)
                }
                className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <span className="truncate font-medium">{recent.name}</span>
                {recent.namespace && (
                  <span className="text-[10px] text-muted-foreground/60 truncate">
                    {recent.namespace}
                  </span>
                )}
              </button>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>
      <Separator />
    </>
  );
}
