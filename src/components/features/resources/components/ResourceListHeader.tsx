"use client";

import { useEffect, useRef } from "react";
import { RefreshCw, Search, Radio, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useUIStore } from "@/lib/stores/ui-store";
import type { FilterOption } from "../types";

interface ResourceListHeaderProps<T> {
  title: string;
  filteredCount: number;
  filterOptions?: FilterOption<T>[];
  filterCounts: Record<string, number>;
  activeFilter: string | null;
  onFilterChange: (key: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isLoading: boolean;
  isWatching?: boolean;
  onStartWatch?: () => void;
  onStopWatch?: () => void;
  onRefresh: () => void;
}

export function ResourceListHeader<T>({
  title,
  filteredCount,
  filterOptions,
  filterCounts,
  activeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  isLoading,
  isWatching,
  onStartWatch,
  onStopWatch,
  onRefresh,
}: ResourceListHeaderProps<T>) {
  const t = useTranslations();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchFocusTrigger = useUIStore((s) => s.searchFocusTrigger);
  const refreshTrigger = useUIStore((s) => s.refreshTrigger);
  const handleClearSearch = () => {
    onSearchChange("");
    searchInputRef.current?.focus();
  };

  useEffect(() => {
    if (searchFocusTrigger > 0) {
      searchInputRef.current?.focus();
    }
  }, [searchFocusTrigger]);

  useEffect(() => {
    if (refreshTrigger > 0) {
      onRefresh();
    }
  }, [refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div className="flex items-center gap-3 min-w-0 flex-wrap">
        <h2 className="text-lg font-semibold whitespace-nowrap">{title}</h2>
        <Badge variant="secondary" className="rounded-full">
          {filteredCount}
        </Badge>

        {/* Quick filters */}
        {filterOptions && filterOptions.length > 0 && (
          <div className="flex items-center gap-1 ml-2 flex-wrap">
            <button
              onClick={() => onFilterChange(null)}
              aria-pressed={activeFilter === null}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                activeFilter === null
                  ? "border-foreground bg-foreground text-background dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600 classic-dark:border-zinc-500 classic-dark:bg-zinc-700 classic-dark:text-zinc-100 classic-dark:hover:bg-zinc-600"
                  : "border-border/70 bg-muted text-foreground/80 hover:bg-muted/80"
              )}
            >
              {t("common.all")}
            </button>
            {filterOptions.map((filter) => {
              const count = filterCounts[filter.key] || 0;
              const isActive = activeFilter === filter.key;
              const colorClasses = {
                default: isActive
                  ? "border-foreground bg-foreground text-background dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600 classic-dark:border-zinc-500 classic-dark:bg-zinc-700 classic-dark:text-zinc-100 classic-dark:hover:bg-zinc-600"
                  : "border-border/70 bg-muted text-foreground/80 hover:bg-muted/80",
                green: isActive
                  ? "border-green-600 bg-green-600 text-white hover:bg-green-500 dark:border-green-500/70 dark:bg-green-500/30 dark:text-green-100 dark:hover:bg-green-500/35 classic-dark:border-green-500/70 classic-dark:bg-green-500/30 classic-dark:text-green-100 classic-dark:hover:bg-green-500/35"
                  : "border-green-300 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-700/60 dark:bg-green-500/15 dark:text-green-300 dark:hover:bg-green-500/25 classic-dark:border-green-700/60 classic-dark:bg-green-500/15 classic-dark:text-green-300 classic-dark:hover:bg-green-500/25",
                yellow: isActive
                  ? "border-amber-500 bg-amber-400 text-amber-950 hover:bg-amber-300 dark:border-amber-500/70 dark:bg-amber-500/30 dark:text-amber-100 dark:hover:bg-amber-500/35 classic-dark:border-amber-500/70 classic-dark:bg-amber-500/30 classic-dark:text-amber-100 classic-dark:hover:bg-amber-500/35"
                  : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25 classic-dark:border-amber-700/60 classic-dark:bg-amber-500/15 classic-dark:text-amber-300 classic-dark:hover:bg-amber-500/25",
                red: isActive
                  ? "border-red-600 bg-red-600 text-white hover:bg-red-500 dark:border-red-500/70 dark:bg-red-500/30 dark:text-red-100 dark:hover:bg-red-500/35 classic-dark:border-red-500/70 classic-dark:bg-red-500/30 classic-dark:text-red-100 classic-dark:hover:bg-red-500/35"
                  : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-700/60 dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-500/25 classic-dark:border-red-700/60 classic-dark:bg-red-500/15 classic-dark:text-red-300 classic-dark:hover:bg-red-500/25",
                blue: isActive
                  ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-500 dark:border-blue-500/70 dark:bg-blue-500/30 dark:text-blue-100 dark:hover:bg-blue-500/35 classic-dark:border-blue-500/70 classic-dark:bg-blue-500/30 classic-dark:text-blue-100 classic-dark:hover:bg-blue-500/35"
                  : "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-700/60 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-500/25 classic-dark:border-blue-700/60 classic-dark:bg-blue-500/15 classic-dark:text-blue-300 classic-dark:hover:bg-blue-500/25",
              };
              return (
                <button
                  key={filter.key}
                  onClick={() =>
                    onFilterChange(isActive ? null : filter.key)
                  }
                  aria-pressed={isActive}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                    colorClasses[filter.color || "default"]
                  )}
                >
                  {filter.label}
                  <span className={cn("tabular-nums", isActive ? "opacity-90" : "opacity-80")}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder={`${t("common.search")}...`}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-56 pl-8 pr-8"
          />
          {searchQuery.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute right-1 top-1/2 size-6 -translate-y-1/2 rounded"
              onClick={handleClearSearch}
              aria-label={`${t("common.clear")} ${t("common.search")}`}
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>

        {/* Watch toggle */}
        {onStartWatch && onStopWatch && (
          <Button
            variant={isWatching ? "default" : "outline"}
            size="sm"
            onClick={isWatching ? onStopWatch : onStartWatch}
            className={cn(isWatching && "bg-green-600 hover:bg-green-700")}
          >
            <Radio
              className={cn("size-3.5", isWatching && "animate-pulse")}
            />
            {isWatching ? t("watch.watching") : t("watch.watch")}
          </Button>
        )}

        {/* Refresh */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw
            className={cn("size-3.5", isLoading && "animate-spin")}
          />
          {t("common.refresh")}
        </Button>
      </div>
    </div>
  );
}
