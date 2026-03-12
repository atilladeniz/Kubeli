"use client";

import { useTranslations } from "next-intl";
import { ChevronRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { QuickAccessSectionProps } from "../types/types";

export function QuickAccessSection({
  navFavorites,
  navLabelById,
  navIconById,
  activeResource,
  isNavFavoritesSectionOpen,
  setIsNavFavoritesSectionOpen,
  onResourceSelect,
  onToggleNavFavorite,
}: QuickAccessSectionProps) {
  const tNav = useTranslations("navigation");
  const t = useTranslations();

  if (navFavorites.length === 0) {
    return null;
  }

  return (
    <Collapsible
      open={isNavFavoritesSectionOpen}
      onOpenChange={setIsNavFavoritesSectionOpen}
      className="mb-1"
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 px-2 font-medium text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground [&[data-state=open]>svg.chevron]:rotate-90"
        >
          <Star className="size-3.5 text-yellow-500 fill-yellow-500" />
          <span className="flex-1 text-left">{tNav("quickAccess")}</span>
          <ChevronRight className="chevron size-3.5 transition-transform" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="relative ml-[11px] mt-0.5 space-y-0.5">
        {/* Tree vertical line */}
        <div className="absolute left-0 top-0 bottom-2 w-px bg-border/60" />
        {navFavorites.map((resource, index) => {
          const label = navLabelById.get(resource);
          if (!label) return null;
          const icon = navIconById.get(resource);
          const isLast = index === navFavorites.length - 1;

          return (
            <div key={resource} className="group relative flex items-center">
              {/* Tree horizontal connector */}
              <div className="absolute left-0 top-1/2 h-px w-2.5 bg-border/60" />
              {isLast && (
                <div className="absolute left-0 top-1/2 bottom-0 w-px bg-card/50" />
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onResourceSelect(resource)}
                className={cn(
                  "ml-4 w-[calc(100%-1rem)] justify-between gap-1.5 px-1.5 pr-8 font-normal text-xs",
                  activeResource === resource
                    ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="flex items-center gap-1.5 truncate">
                  {icon && (
                    <span
                      className={cn(
                        "shrink-0",
                        activeResource === resource
                          ? "text-primary"
                          : "text-muted-foreground/70",
                      )}
                    >
                      {icon}
                    </span>
                  )}
                  <span className="truncate">{label}</span>
                </span>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onToggleNavFavorite(resource)}
                className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-yellow-500 opacity-0 transition-opacity hover:text-yellow-400 group-hover:opacity-100 group-focus-within:opacity-100"
                aria-label={t("common.removeFromFavorites", {
                  name: label,
                })}
              >
                <Star className="size-3.5 fill-yellow-500 text-yellow-500" />
              </Button>
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
