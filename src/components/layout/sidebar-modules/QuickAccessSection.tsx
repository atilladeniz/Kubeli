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
import type { QuickAccessSectionProps } from "./types";

export function QuickAccessSection({
  navFavorites,
  navLabelById,
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
          className="w-full justify-start gap-2 px-2 font-medium text-muted-foreground hover:text-foreground [&[data-state=open]>svg.chevron]:rotate-90"
        >
          <Star className="size-4 text-muted-foreground" />
          <span className="flex-1 text-left">{tNav("quickAccess")}</span>
          <ChevronRight className="chevron size-3.5 transition-transform" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-4 mt-0.5 space-y-0.5">
        {navFavorites.map((resource) => {
          const label = navLabelById.get(resource);
          if (!label) return null;

          return (
            <div key={resource} className="group relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onResourceSelect(resource)}
                className={cn(
                  "w-full justify-start px-2 pr-9 font-normal",
                  activeResource === resource
                    ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
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
