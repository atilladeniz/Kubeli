"use client";

import { RefreshCw, Search, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
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

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Badge variant="secondary" className="rounded-full">
          {filteredCount}
        </Badge>

        {/* Quick filters */}
        {filterOptions && filterOptions.length > 0 && (
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => onFilterChange(null)}
              className={cn(
                "px-2 py-0.5 text-xs rounded-full transition-colors",
                activeFilter === null
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {t("common.all")}
            </button>
            {filterOptions.map((filter) => {
              const count = filterCounts[filter.key] || 0;
              const isActive = activeFilter === filter.key;
              const colorClasses = {
                default: isActive
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
                green: isActive
                  ? "bg-green-500 text-white"
                  : "bg-green-500/10 text-green-500 hover:bg-green-500/20",
                yellow: isActive
                  ? "bg-yellow-500 text-black"
                  : "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20",
                red: isActive
                  ? "bg-red-500 text-white"
                  : "bg-red-500/10 text-red-500 hover:bg-red-500/20",
                blue: isActive
                  ? "bg-blue-500 text-white"
                  : "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
              };
              return (
                <button
                  key={filter.key}
                  onClick={() =>
                    onFilterChange(isActive ? null : filter.key)
                  }
                  className={cn(
                    "px-2 py-0.5 text-xs rounded-full transition-colors flex items-center gap-1",
                    colorClasses[filter.color || "default"]
                  )}
                >
                  {filter.label}
                  <span className="opacity-70">{count}</span>
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
            type="text"
            placeholder={`${t("common.search")}...`}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-56 pl-8"
          />
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
