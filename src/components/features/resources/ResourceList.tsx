"use client";

import { useState, useMemo, useCallback } from "react";
import { RefreshCw, Circle, AlertCircle } from "lucide-react";
import { useTabsStore } from "@/lib/stores/tabs-store";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslations } from "next-intl";
import { parseQuantityToBytes } from "./lib/utils";
import { ResourceListHeader } from "./components/ResourceListHeader";
import { ResourceTable } from "./components/ResourceTable";
import { BulkActionBar } from "./components/BulkActionBar";
import type { Column, FilterOption, BulkAction, ContextMenuItemDef, SortDirection } from "./types";

interface ResourceListProps<T> {
  title: string;
  data: T[];
  columns: Column<T>[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  isWatching?: boolean;
  onStartWatch?: () => void;
  onStopWatch?: () => void;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  getRowKey: (item: T) => string;
  getRowClassName?: (item: T) => string;
  getRowNamespace?: (item: T) => string;
  contextMenuItems?: (item: T) => ContextMenuItemDef[];
  filterOptions?: FilterOption<T>[];
  bulkActions?: BulkAction<T>[];
  sortKey?: string | null;
  sortDirection?: SortDirection;
  onSortChange?: (key: string | null, direction: SortDirection) => void;
  /** Custom comparator for sort keys that don't map directly to item properties */
  customSortComparator?: (a: T, b: T) => number;
}

export function ResourceList<T>({
  title,
  data,
  columns,
  isLoading,
  error,
  onRefresh,
  isWatching,
  onStartWatch,
  onStopWatch,
  onRowClick,
  emptyMessage,
  getRowKey,
  getRowClassName,
  getRowNamespace,
  contextMenuItems,
  filterOptions,
  bulkActions,
  sortKey: controlledSortKey,
  sortDirection: controlledSortDirection,
  onSortChange,
  customSortComparator,
}: ResourceListProps<T>) {
  const t = useTranslations();
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const searchQuery = useTabsStore((s) => s.searchQueries[s.activeTabId] ?? "");
  const activeFilter = useTabsStore((s) => s.activeFilters[s.activeTabId] ?? null);
  const setTabSearch = useTabsStore((s) => s.setTabSearch);
  const setTabFilter = useTabsStore((s) => s.setTabFilter);
  const setSearchQuery = useCallback((q: string) => setTabSearch(activeTabId, q), [activeTabId, setTabSearch]);
  const setActiveFilter = useCallback((f: string | null) => setTabFilter(activeTabId, f), [activeTabId, setTabFilter]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [internalSortKey, setInternalSortKey] = useState<string | null>(null);
  const [internalSortDirection, setInternalSortDirection] =
    useState<SortDirection>("asc");

  const isControlled = onSortChange !== undefined;
  const sortKey = isControlled ? controlledSortKey ?? null : internalSortKey;
  const sortDirection = isControlled
    ? controlledSortDirection ?? "asc"
    : internalSortDirection;

  const filterCounts = useMemo(() => {
    if (!filterOptions) return {};
    return filterOptions.reduce((acc, filter) => {
      acc[filter.key] = data.filter(filter.predicate).length;
      return acc;
    }, {} as Record<string, number>);
  }, [data, filterOptions]);

  const filteredData = useMemo(() => {
    let result = [...data];

    if (activeFilter && filterOptions) {
      const filter = filterOptions.find((f) => f.key === activeFilter);
      if (filter) {
        result = result.filter(filter.predicate);
      }
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) =>
        Object.values(item as Record<string, unknown>).some((value) =>
          String(value).toLowerCase().includes(query)
        )
      );
    }

    if (sortKey) {
      result.sort((a, b) => {
        // Use custom comparator if provided (e.g. for metrics columns)
        if (customSortComparator) {
          const comparison = customSortComparator(a, b);
          return sortDirection === "asc" ? comparison : -comparison;
        }

        const aValue = (a as Record<string, unknown>)[sortKey];
        const bValue = (b as Record<string, unknown>)[sortKey];

        if (aValue === bValue) return 0;
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        let comparison: number;

        if (sortKey === "capacity") {
          const aBytes = parseQuantityToBytes(aValue as string);
          const bBytes = parseQuantityToBytes(bValue as string);
          comparison = aBytes - bBytes;
        } else if (typeof aValue === "number" && typeof bValue === "number") {
          comparison = aValue - bValue;
        } else {
          const aNum = Number(aValue);
          const bNum = Number(bValue);
          if (!isNaN(aNum) && !isNaN(bNum)) {
            comparison = aNum - bNum;
          } else {
            comparison = String(aValue).localeCompare(String(bValue));
          }
        }

        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [data, searchQuery, sortKey, sortDirection, activeFilter, filterOptions, customSortComparator]);

  const handleSort = (key: string) => {
    const newDirection =
      sortKey === key && sortDirection === "asc" ? "desc" : "asc";

    if (isControlled) {
      onSortChange?.(key, newDirection);
    } else {
      setInternalSortKey(key);
      setInternalSortDirection(newDirection);
    }
  };

  const hasBulkActions = bulkActions && bulkActions.length > 0;
  const allSelected =
    filteredData.length > 0 &&
    filteredData.every((item) => selectedKeys.has(getRowKey(item)));
  const someSelected = filteredData.some((item) =>
    selectedKeys.has(getRowKey(item))
  );

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(filteredData.map(getRowKey)));
    }
  };

  const toggleSelect = (key: string) => {
    const newSelected = new Set(selectedKeys);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedKeys(newSelected);
  };

  const selectedItems = filteredData.filter((item) =>
    selectedKeys.has(getRowKey(item))
  );

  const handleBulkAction = async (action: BulkAction<T>) => {
    await action.onAction(selectedItems);
    setSelectedKeys(new Set());
  };

  return (
    <div className="flex h-full flex-col">
      <ResourceListHeader
        title={title}
        filteredCount={filteredData.length}
        filterOptions={filterOptions}
        filterCounts={filterCounts}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isLoading={isLoading}
        isWatching={isWatching}
        onStartWatch={onStartWatch}
        onStopWatch={onStopWatch}
        onRefresh={onRefresh}
      />

      {error && (
        <div className="mx-4 mt-3">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {isLoading && data.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <RefreshCw className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Circle className="size-12 stroke-1" />
            <p>{emptyMessage || t("common.noData")}</p>
          </div>
        ) : (
          <ResourceTable
            data={filteredData}
            columns={columns}
            getRowKey={getRowKey}
            getRowClassName={getRowClassName}
            getRowNamespace={getRowNamespace}
            onRowClick={onRowClick}
            contextMenuItems={contextMenuItems}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            hasBulkActions={!!hasBulkActions}
            selectedKeys={selectedKeys}
            allSelected={allSelected}
            someSelected={someSelected}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={toggleSelect}
          />
        )}
      </div>

      {hasBulkActions && selectedKeys.size > 0 && (
        <BulkActionBar
          selectedCount={selectedKeys.size}
          bulkActions={bulkActions}
          onAction={handleBulkAction}
          onClearSelection={() => setSelectedKeys(new Set())}
        />
      )}
    </div>
  );
}
