"use client";

import { Boxes, ChevronRight, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

  return (
    <Collapsible defaultOpen className="mb-1">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 px-2 font-medium text-muted-foreground hover:text-foreground [&[data-state=open]>svg.chevron]:rotate-90"
        >
          <Boxes className="size-4" />
          <span className="flex-1 text-left">{t("customResources")}</span>
          <ChevronRight className="chevron size-3.5 transition-transform" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-4 mt-0.5 space-y-2">
        {groups.map((group) => (
          <div key={group.provider} className="space-y-0.5">
            <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
              {group.provider}
            </div>
            {group.resources.map((resource) => {
              const favoriteActive = isNavFavorite(resource.id);
              return (
                <div key={resource.id} className="group relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(event) => {
                      if ((event.metaKey || event.ctrlKey) && onResourceSelectNewTab) {
                        onResourceSelectNewTab(resource.id, resource.label);
                      } else {
                        onResourceSelect(resource.id);
                      }
                    }}
                    className={cn(
                      "w-full justify-between px-2 pr-9 font-normal text-muted-foreground hover:text-foreground",
                      activeResource === resource.id &&
                        "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                    )}
                  >
                    <span>{resource.label}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleNavFavorite(resource.id);
                    }}
                    className={cn(
                      "absolute right-1 top-1/2 size-7 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
                      favoriteActive
                        ? "text-yellow-500 hover:text-yellow-400"
                        : "text-muted-foreground hover:text-yellow-400",
                    )}
                    aria-label={
                      favoriteActive
                        ? tCommon("removeFromFavorites", { name: resource.label })
                        : tCommon("addToFavorites", { name: resource.label })
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
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
