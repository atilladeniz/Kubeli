"use client";

import { useState, useMemo, useCallback } from "react";
import { RefreshCw, Circle } from "lucide-react";
import { useTabsStore } from "@/lib/stores/tabs-store";
import { useTranslations } from "next-intl";
import { parseQuantityToBytes } from "./lib/utils";
import { ResourceListHeader } from "./components/ResourceListHeader";
import { ResourceTable } from "./components/ResourceTable";
import { BulkActionBar } from "./components/BulkActionBar";
import { ResourceError } from "./ResourceError";
import type { KubeliError } from "@/lib/types/errors";
import type { Column, FilterOption, BulkAction, ContextMenuItemDef, SortDirection } from "./types";

interface ResourceListProps<T> {
  title: string;
  data: T[];
  columns: Column<T>[];
  isLoading: boolean;
  error: KubeliError | null;
  onRefresh: () => void;
  onRetry?: () => void;
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
  onRetry,
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
      const searchColumns = columns.filter((col) => col.getSearchText);
      result = result.filter(
        (item) =>
          Object.values(item as Record<string, unknown>).some((value) =>
            String(value).toLowerCase().includes(query)
          ) ||
          searchColumns.some((col) =>
            col.getSearchText!(item).toLowerCase().includes(query)
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

        // Computed columns (e.g. HPA utilization) have no field behind their
        // key, so they supply the sort value themselves.
        const sortColumn = columns.find((col) => col.key === sortKey);
        const aValue = sortColumn?.sortValue
          ? sortColumn.sortValue(a)
          : (a as Record<string, unknown>)[sortKey];
        const bValue = sortColumn?.sortValue
          ? sortColumn.sortValue(b)
          : (b as Record<string, unknown>)[sortKey];

        if (aValue === bValue) return 0;
        // Nulls sort last in both directions: an HPA without metrics is not
        // "least utilized", it has no reading at all. These return early, so
        // the direction flip below never reaches them.
        const isEmpty = (v: unknown) => v === null || v === undefined;
        if (isEmpty(aValue)) return 1;
        if (isEmpty(bValue)) return -1;

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
  }, [data, columns, searchQuery, sortKey, sortDirection, activeFilter, filterOptions, customSortComparator]);

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
        <ResourceError error={error} onRetry={onRetry ?? onRefresh} />
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
