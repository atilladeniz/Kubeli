"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TruncateTooltip } from "@/components/ui/truncate-tooltip";
import { cn } from "@/lib/utils";
import { isImplementedView } from "../types/constants";
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
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hasActiveChild = section.items.some((item) => activeResource === item.id);
  const showHeaderHighlight = !isOpen && hasActiveChild;

  return (
    <Collapsible defaultOpen={defaultOpen} onOpenChange={setIsOpen} className="mb-1">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "w-full justify-start gap-2 px-2 font-medium text-xs uppercase tracking-wider hover:text-foreground [&[data-state=open]>svg.chevron]:rotate-90",
            showHeaderHighlight
              ? "text-primary bg-primary/10 hover:bg-primary/20 hover:text-primary"
              : "text-muted-foreground",
          )}
        >
          <span className="flex-1 text-left">{section.title}</span>
          <ChevronRight className="chevron size-3.5 transition-transform" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="relative ml-[11px] mt-0.5 space-y-0.5">
        {/* Tree vertical line */}
        <div className="absolute left-0 top-0 bottom-2 w-px bg-border/60" />
        {section.items.map((item, index) => {
          const isImplemented = isImplementedView(item.id);
          const favoriteActive = isNavFavorite(item.id);
          const isLast = index === section.items.length - 1;

          return (
            <div key={item.id} className="group relative flex items-center">
              {/* Tree horizontal connector */}
              <div
                className={cn(
                  "absolute left-0 top-1/2 h-px w-2.5 bg-border/60",
                  isLast && "after:absolute after:left-0 after:top-0 after:h-1/2 after:w-px after:bg-card/50",
                )}
              />
              {/* Hide vertical line below last item */}
              {isLast && (
                <div className="absolute left-0 top-1/2 bottom-0 w-px bg-card/50" />
              )}
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
                  "ml-4 w-[calc(100%-1rem)] justify-between gap-1.5 px-1.5 pr-8 font-normal text-xs",
                  activeResource === item.id
                    ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                    : isImplemented
                      ? "text-muted-foreground hover:text-foreground"
                      : "text-muted-foreground/50 cursor-not-allowed",
                )}
              >
                <span className="flex items-center gap-1.5 truncate">
                  {item.icon && (
                    <span
                      className={cn(
                        "shrink-0",
                        activeResource === item.id
                          ? "text-primary"
                          : "text-muted-foreground/70",
                      )}
                    >
                      {item.icon}
                    </span>
                  )}
                  <TruncateTooltip
                    content={item.label}
                    className="min-w-0 flex-1 truncate"
                  />
                </span>
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
