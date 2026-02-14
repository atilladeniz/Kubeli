"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Eye, FileText, MoreHorizontal, Trash2 } from "lucide-react";
import type { FavoriteResource } from "@/lib/stores/favorites-store";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FavoriteItemProps {
  favorite: FavoriteResource;
  index: number;
  onSelect: () => void;
  onRemove: () => void;
  onOpenLogs?: () => void | Promise<void>;
  isActive?: boolean;
  modKey: string;
}

export function FavoriteItem({
  favorite,
  index,
  onSelect,
  onRemove,
  onOpenLogs,
  isActive = false,
  modKey,
}: FavoriteItemProps) {
  const t = useTranslations();
  const itemRef = useRef<HTMLDivElement>(null);
  const shortcutKey = index < 9 ? index + 1 : null;
  const canOpenLogs = favorite.resourceType === "pods" && !!favorite.namespace;

  useEffect(() => {
    if (isActive && itemRef.current) {
      itemRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [isActive]);

  return (
    <div
      ref={itemRef}
      className={cn(
        "flex items-start justify-between rounded-md border px-2 py-2 text-xs group overflow-hidden",
        isActive ? "bg-primary/10 border-primary/40" : "bg-muted/50 border-border/50"
      )}
    >
      <button
        onClick={onSelect}
        className={cn(
          "flex min-w-0 flex-1 flex-col items-start gap-0.5 overflow-hidden text-left transition-colors",
          isActive ? "text-foreground" : "hover:text-foreground"
        )}
      >
        <span className="w-full truncate text-xs font-medium leading-tight">
          {favorite.name}
        </span>
        {favorite.namespace && (
          <span
            className={cn(
              "w-full truncate text-[10px] leading-tight",
              isActive ? "text-muted-foreground" : "text-muted-foreground/60"
            )}
          >
            {favorite.namespace}
          </span>
        )}
      </button>
      <div className="ml-1 flex shrink-0 items-center gap-1 self-start">
        {shortcutKey && (
          <Kbd
            className={cn(
              "text-[9px] transition-opacity",
              isActive ? "opacity-100" : "opacity-50 group-hover:opacity-100"
            )}
          >
            {modKey}
            {shortcutKey}
          </Kbd>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={t("common.actions")}
              className={cn(
                "p-1 rounded hover:bg-background transition-opacity",
                isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
            >
              <MoreHorizontal className="size-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onSelect()}>
              <Eye className="size-4" />
              {t("favorites.openDetails")}
            </DropdownMenuItem>
            {canOpenLogs && onOpenLogs && (
              <DropdownMenuItem onClick={() => onOpenLogs()}>
                <FileText className="size-4" />
                {t("favorites.openLogs")}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onRemove()}>
              <Trash2 className="size-4" />
              {t("favorites.remove")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
