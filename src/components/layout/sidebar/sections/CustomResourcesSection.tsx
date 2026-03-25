"use client";

import { Boxes, ChevronRight, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TruncateTooltip } from "@/components/ui/truncate-tooltip";
import { cn } from "@/lib/utils";
import type { CustomResourceGroup } from "@/lib/custom-resources";
import type { ResourceType } from "../types/types";

interface CustomResourcesSectionProps {
  groups: CustomResourceGroup[];
  activeResource: ResourceType;
  onResourceSelect: (resource: ResourceType) => void;
  onResourceSelectNewTab?: (resource: ResourceType, title: string) => void;
  isNavFavorite: (resource: ResourceType) => boolean;
  onToggleNavFavorite: (resource: ResourceType) => void;
}

export function CustomResourcesSection({
  groups,
  activeResource,
  onResourceSelect,
  onResourceSelectNewTab,
  isNavFavorite,
  onToggleNavFavorite,
}: CustomResourcesSectionProps) {
  const t = useTranslations("navigation");
  const tCommon = useTranslations("common");

  if (groups.length === 0) {
    return null;
  }

  const resourceCount = groups.reduce(
    (total, group) => total + group.resources.length,
    0,
  );

  return (
    <Collapsible defaultOpen className="mb-1">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 px-2 font-medium text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground [&[data-state=open]>svg.chevron]:rotate-90"
        >
          <span className="flex-1 truncate text-left">{t("customResources")}</span>
          <Badge
            variant="outline"
            className="h-4 shrink-0 border-border/40 px-1.5 text-[9px] font-normal text-muted-foreground"
          >
            {resourceCount}
          </Badge>
          <ChevronRight className="chevron size-3.5 shrink-0 transition-transform" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-0.5 space-y-0.5">
        {groups.map((group) => {
          const hasActiveChild = group.resources.some(
            (r) => activeResource === r.id,
          );

          return (
            <Collapsible
              key={group.provider}
              defaultOpen={hasActiveChild}
              className="relative ml-[11px]"
            >
              {/* Tree vertical line for provider */}
              <div className="absolute left-0 top-0 bottom-0 w-px bg-border/60" />
              <div className="relative min-w-0 pl-4">
                <div className="absolute left-0 top-1/2 h-px w-2.5 bg-border/60" />
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full min-w-0 justify-start gap-1.5 overflow-hidden px-1.5 font-normal text-muted-foreground hover:text-foreground [&[data-state=open]>svg.chevron]:rotate-90"
                  >
                    <ChevronRight className="chevron size-3 shrink-0 transition-transform" />
                    <TruncateTooltip
                      content={group.provider}
                      className="min-w-0 w-0 flex-1 truncate text-left text-xs"
                    />
                    <Badge
                      variant="outline"
                      className="ml-auto h-4 shrink-0 border-border/40 px-1.5 text-[9px] font-normal text-muted-foreground"
                    >
                      {group.resources.length}
                    </Badge>
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="relative ml-4 mt-0.5 space-y-0.5">
                {/* Tree vertical line for resources */}
                <div className="absolute left-[11px] top-0 bottom-2 w-px bg-border/60" />
                {group.resources.map((resource, index) => {
                  const favoriteActive = isNavFavorite(resource.id);
                  const isLast = index === group.resources.length - 1;
                  return (
                    <div
                      key={resource.id}
                      className="group relative min-w-0 pl-7"
                    >
                      {/* Tree horizontal connector */}
                      <div className="absolute left-[11px] top-1/2 h-px w-2.5 bg-border/60" />
                      {isLast && (
                        <div className="absolute left-[11px] top-1/2 bottom-0 w-px bg-card/50" />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(event) => {
                          if (
                            (event.metaKey || event.ctrlKey) &&
                            onResourceSelectNewTab
                          ) {
                            onResourceSelectNewTab(
                              resource.id,
                              resource.label,
                            );
                          } else {
                            onResourceSelect(resource.id);
                          }
                        }}
                        className={cn(
                          "w-full min-w-0 justify-start gap-1.5 overflow-hidden px-1.5 font-normal text-xs",
                          activeResource === resource.id
                            ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Boxes className="size-3.5 shrink-0 text-muted-foreground/70" />
                        <TruncateTooltip
                          content={resource.label}
                          className="min-w-0 w-0 flex-1 truncate text-left"
                        />
                        <span aria-hidden="true" className="size-7 shrink-0" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleNavFavorite(resource.id);
                        }}
                        className={cn(
                          "absolute right-1 top-1/2 z-10 size-7 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
                          favoriteActive
                            ? "text-yellow-500 hover:text-yellow-400"
                            : "text-muted-foreground hover:text-yellow-400",
                        )}
                        aria-label={
                          favoriteActive
                            ? tCommon("removeFromFavorites", {
                                name: resource.label,
                              })
                            : tCommon("addToFavorites", {
                                name: resource.label,
                              })
                        }
                      >
                        <Star
                          className={cn(
                            "size-3.5",
                            favoriteActive &&
                              "fill-yellow-500 text-yellow-500",
                          )}
                        />
                      </Button>
                    </div>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
