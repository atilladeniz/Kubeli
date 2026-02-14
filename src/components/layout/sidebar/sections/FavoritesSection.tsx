"use client";

import { useTranslations } from "next-intl";
import { ChevronRight, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { FavoriteItem } from "../components/FavoriteItem";
import type { FavoritesSectionProps, ResourceType } from "../types/types";

export function FavoritesSection({
  isConnected,
  favorites,
  activeFavoriteId,
  clusterContext,
  isFavoritesSectionOpen,
  setIsFavoritesSectionOpen,
  modKeySymbol,
  onResourceSelect,
  onFavoriteSelect,
  onFavoriteOpenLogs,
  removeFavorite,
}: FavoritesSectionProps) {
  const t = useTranslations();
  const tNav = useTranslations("navigation");

  if (!isConnected || favorites.length === 0) {
    return null;
  }

  return (
    <>
      <div className="p-3 overflow-hidden">
        <Collapsible
          open={isFavoritesSectionOpen}
          onOpenChange={setIsFavoritesSectionOpen}
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex w-full items-center justify-between text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                isFavoritesSectionOpen && "mb-2",
              )}
              aria-label={t("common.toggleSection", {
                section: tNav("pinnedResources"),
              })}
            >
              <span className="flex items-center gap-1.5">
                <Star className="size-3 text-muted-foreground" />
                {tNav("pinnedResources")}
              </span>
              <span className="flex items-center gap-1">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {favorites.length}
                </Badge>
                <ChevronRight
                  className={cn(
                    "size-3.5 transition-transform",
                    isFavoritesSectionOpen && "rotate-90",
                  )}
                />
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent
            className={cn(
              "space-y-1",
              favorites.length > 4 && "max-h-[176px] overflow-y-auto pr-1",
            )}
          >
            {favorites.map((fav, index) => (
              <FavoriteItem
                key={fav.id}
                favorite={fav}
                index={index}
                onSelect={() => {
                  if (onFavoriteSelect) {
                    void onFavoriteSelect(fav);
                    return;
                  }
                  onResourceSelect(fav.resourceType as ResourceType);
                }}
                onRemove={() => removeFavorite(clusterContext, fav.id)}
                onOpenLogs={
                  onFavoriteOpenLogs ? () => onFavoriteOpenLogs(fav) : undefined
                }
                isActive={activeFavoriteId === fav.id}
                modKey={modKeySymbol}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>
      <Separator />
    </>
  );
}
