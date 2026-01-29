"use client";

import { useState, useMemo } from "react";
import {
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  Circle,
  AlertCircle,
  Radio,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { getNamespaceColor } from "@/lib/utils/colors";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslations } from "next-intl";
import { parseQuantityToBytes } from "./lib/utils";
import type { Column, FilterOption, BulkAction, ContextMenuItemDef, SortDirection } from "./columns/types";

// Re-export types and columns for backward compatibility
export type { Column, FilterOption, BulkAction, ContextMenuItemDef, SortDirection } from "./columns/types";
export { translateColumns } from "./columns/translate";
export {
  podColumns, getPodColumns,
  deploymentColumns, getDeploymentColumns,
  serviceColumns, getServiceColumns,
  configMapColumns, getConfigMapColumns,
  secretColumns, getSecretColumns,
  nodeColumns, getNodeColumns,
  namespaceColumns, getNamespaceColumns,
  eventColumns,
  leaseColumns,
  replicaSetColumns,
  daemonSetColumns,
  statefulSetColumns,
  jobColumns,
  cronJobColumns,
  ingressColumns,
  endpointSliceColumns,
  networkPolicyColumns,
  ingressClassColumns,
  hpaColumns,
  limitRangeColumns,
  resourceQuotaColumns,
  pdbColumns,
  pvColumns,
  pvcColumns,
  storageClassColumns,
  csiDriverColumns,
  csiNodeColumns,
  volumeAttachmentColumns,
  serviceAccountColumns,
  roleColumns,
  roleBindingColumns,
  clusterRoleColumns,
  clusterRoleBindingColumns,
  crdColumns,
  priorityClassColumns,
  runtimeClassColumns,
  mutatingWebhookColumns,
  validatingWebhookColumns,
  helmReleaseColumns, getHelmReleaseColumns,
  fluxKustomizationColumns,
} from "./columns";

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
  /** Extract namespace from item for row background coloring */
  getRowNamespace?: (item: T) => string;
  contextMenuItems?: (item: T) => ContextMenuItemDef[];
  /** Filter options for quick filtering */
  filterOptions?: FilterOption<T>[];
  /** Bulk actions available when items are selected */
  bulkActions?: BulkAction<T>[];
  // Controlled sorting
  sortKey?: string | null;
  sortDirection?: SortDirection;
  onSortChange?: (key: string | null, direction: SortDirection) => void;
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
}: ResourceListProps<T>) {
  const t = useTranslations();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  // Use controlled or uncontrolled sorting
  const [internalSortKey, setInternalSortKey] = useState<string | null>(null);
  const [internalSortDirection, setInternalSortDirection] =
    useState<SortDirection>("asc");

  const isControlled = onSortChange !== undefined;
  const sortKey = isControlled ? controlledSortKey ?? null : internalSortKey;
  const sortDirection = isControlled
    ? controlledSortDirection ?? "asc"
    : internalSortDirection;

  // Calculate filter counts
  const filterCounts = useMemo(() => {
    if (!filterOptions) return {};
    return filterOptions.reduce((acc, filter) => {
      acc[filter.key] = data.filter(filter.predicate).length;
      return acc;
    }, {} as Record<string, number>);
  }, [data, filterOptions]);

  const filteredData = useMemo(() => {
    let result = [...data];

    // Quick filter
    if (activeFilter && filterOptions) {
      const filter = filterOptions.find((f) => f.key === activeFilter);
      if (filter) {
        result = result.filter(filter.predicate);
      }
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) =>
        Object.values(item as Record<string, unknown>).some((value) =>
          String(value).toLowerCase().includes(query)
        )
      );
    }

    // Sort
    if (sortKey) {
      result.sort((a, b) => {
        const aValue = (a as Record<string, unknown>)[sortKey];
        const bValue = (b as Record<string, unknown>)[sortKey];

        if (aValue === bValue) return 0;
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        let comparison: number;

        // Use numeric comparison for capacity fields (Kubernetes quantities)
        if (sortKey === "capacity") {
          const aBytes = parseQuantityToBytes(aValue as string);
          const bBytes = parseQuantityToBytes(bValue as string);
          comparison = aBytes - bBytes;
        } else {
          comparison = String(aValue).localeCompare(String(bValue));
        }

        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [data, searchQuery, sortKey, sortDirection, activeFilter, filterOptions]);

  const handleSort = (key: string) => {
    const newDirection =
      sortKey === key && sortDirection === "asc" ? "desc" : "asc";
    const newKey = key;

    if (isControlled) {
      onSortChange?.(newKey, newDirection);
    } else {
      setInternalSortKey(newKey);
      setInternalSortDirection(newDirection);
    }
  };

  // Selection helpers
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
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Badge variant="secondary" className="rounded-full">
            {filteredData.length}
          </Badge>

          {/* Quick filters */}
          {filterOptions && filterOptions.length > 0 && (
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => setActiveFilter(null)}
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
                      setActiveFilter(isActive ? null : filter.key)
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
              onChange={(e) => setSearchQuery(e.target.value)}
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

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Table */}
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
          <div className="h-full overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  {hasBulkActions && (
                    <TableHead className="w-8 bg-background pl-3.5">
                      <Checkbox
                        checked={
                          someSelected
                            ? allSelected
                              ? true
                              : "indeterminate"
                            : false
                        }
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                  )}
                  {columns.map((column) => (
                    <TableHead
                      key={String(column.key)}
                      className={cn(
                        "text-xs font-medium tracking-wider bg-background",
                        column.width
                      )}
                    >
                      {column.sortable ? (
                        <button
                          onClick={() => handleSort(String(column.key))}
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          {column.label}
                          {sortKey === column.key &&
                            (sortDirection === "asc" ? (
                              <ChevronUp className="size-3" />
                            ) : (
                              <ChevronDown className="size-3" />
                            ))}
                        </button>
                      ) : (
                        column.label
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item) => {
                  const namespace = getRowNamespace?.(item);
                  const namespaceColor = namespace
                    ? getNamespaceColor(namespace)
                    : null;
                  const itemKey = getRowKey(item);
                  const isSelected = selectedKeys.has(itemKey);

                  const rowContent = (
                    <TableRow
                      key={itemKey}
                      onClick={() => onRowClick?.(item)}
                      className={cn(
                        onRowClick && "cursor-pointer",
                        namespaceColor && "border-l-4",
                        namespaceColor?.borderLeft,
                        isSelected && "bg-muted/50",
                        getRowClassName?.(item)
                      )}
                    >
                      {hasBulkActions && (
                        <TableCell className="w-8 pl-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(itemKey)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select ${itemKey}`}
                          />
                        </TableCell>
                      )}
                      {columns.map((column) => (
                        <TableCell key={String(column.key)} className="text-sm">
                          {column.render
                            ? column.render(item)
                            : String(
                                (item as Record<string, unknown>)[
                                  String(column.key)
                                ] ?? "-"
                              )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );

                  if (contextMenuItems) {
                    const menuItems = contextMenuItems(item);
                    return (
                      <ContextMenu key={getRowKey(item)}>
                        <ContextMenuTrigger asChild>
                          {rowContent}
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-48">
                          {menuItems.map((menuItem, index) =>
                            menuItem.separator ? (
                              <ContextMenuSeparator key={`sep-${index}`} />
                            ) : (
                              <ContextMenuItem
                                key={menuItem.label}
                                onClick={menuItem.onClick}
                                disabled={menuItem.disabled}
                                variant={menuItem.variant}
                                className="gap-2"
                              >
                                {menuItem.icon}
                                {menuItem.label}
                              </ContextMenuItem>
                            )
                          )}
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  }

                  return rowContent;
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Bulk Action Bar - Fixed at bottom */}
      {hasBulkActions && selectedKeys.size > 0 && (
        <div className="flex items-center justify-between gap-2 border-t border-border bg-background px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">
              {t("common.selected", { count: selectedKeys.size })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedKeys(new Set())}
              className="h-7 px-2"
            >
              <X className="size-3.5" />
              {t("logs.clear")}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {bulkActions?.map((action) => (
              <Button
                key={action.key}
                variant={
                  action.variant === "destructive" ? "destructive" : "outline"
                }
                size="sm"
                onClick={() => handleBulkAction(action)}
                className="h-7"
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
