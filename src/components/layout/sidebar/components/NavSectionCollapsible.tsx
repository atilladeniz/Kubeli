"use client";

import { useTranslations } from "next-intl";
import { ChevronRight, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { implementedViews } from "../types/constants";
import type { NavSection, ResourceType } from "../types/types";

interface NavSectionCollapsibleProps {
  section: NavSection;
  activeResource: ResourceType;
  onResourceSelect: (resource: ResourceType) => void;
  onResourceSelectNewTab?: (resource: ResourceType, title: string) => void;
  isNavFavorite: (resource: ResourceType) => boolean;
  onToggleNavFavorite: (resource: ResourceType) => void;
  defaultOpen?: boolean;
  soonLabel: string;
}

export function NavSectionCollapsible({
  section,
  activeResource,
  onResourceSelect,
  onResourceSelectNewTab,
  isNavFavorite,
  onToggleNavFavorite,
  defaultOpen = false,
  soonLabel,
}: NavSectionCollapsibleProps) {
  const t = useTranslations();

  return (
    <Collapsible defaultOpen={defaultOpen} className="mb-1">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 px-2 font-medium text-muted-foreground hover:text-foreground [&[data-state=open]>svg.chevron]:rotate-90"
        >
          {section.icon}
          <span className="flex-1 text-left">{section.title}</span>
          <ChevronRight className="chevron size-3.5 transition-transform" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-4 mt-0.5 space-y-0.5">
        {section.items.map((item) => {
          const isImplemented = implementedViews.includes(item.id);
          const favoriteActive = isNavFavorite(item.id);

          return (
            <div key={item.id} className="group relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  if (!isImplemented) return;
                  if ((e.metaKey || e.ctrlKey) && onResourceSelectNewTab) {
                    onResourceSelectNewTab(item.id, item.label);
                  } else {
                    onResourceSelect(item.id);
                  }
                }}
                disabled={!isImplemented}
                className={cn(
                  "w-full justify-between px-2 pr-9 font-normal",
                  activeResource === item.id
                    ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                    : isImplemented
                      ? "text-muted-foreground hover:text-foreground"
                      : "text-muted-foreground/50 cursor-not-allowed",
                )}
              >
                <span>{item.label}</span>
                {!isImplemented && (
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1 py-0 h-4 font-normal opacity-60"
                  >
                    {soonLabel}
                  </Badge>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={!isImplemented}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleNavFavorite(item.id);
                }}
                className={cn(
                  "absolute right-1 top-1/2 size-7 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
                  favoriteActive
                    ? "text-yellow-500 hover:text-yellow-400"
                    : "text-muted-foreground hover:text-yellow-400",
                )}
                aria-label={
                  favoriteActive
                    ? t("common.removeFromFavorites", { name: item.label })
                    : t("common.addToFavorites", { name: item.label })
                }
              >
                <Star
                  className={cn(
                    "size-3.5",
                    favoriteActive && "fill-yellow-500 text-yellow-500",
                  )}
                />
              </Button>
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
