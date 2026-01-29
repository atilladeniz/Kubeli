"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
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
import type { Column, ContextMenuItemDef, SortDirection } from "../types";

interface ResourceTableProps<T> {
  data: T[];
  columns: Column<T>[];
  getRowKey: (item: T) => string;
  getRowClassName?: (item: T) => string;
  getRowNamespace?: (item: T) => string;
  onRowClick?: (item: T) => void;
  contextMenuItems?: (item: T) => ContextMenuItemDef[];
  sortKey: string | null;
  sortDirection: SortDirection;
  onSort: (key: string) => void;
  hasBulkActions: boolean;
  selectedKeys: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleSelectAll: () => void;
  onToggleSelect: (key: string) => void;
}

export function ResourceTable<T>({
  data,
  columns,
  getRowKey,
  getRowClassName,
  getRowNamespace,
  onRowClick,
  contextMenuItems,
  sortKey,
  sortDirection,
  onSort,
  hasBulkActions,
  selectedKeys,
  allSelected,
  someSelected,
  onToggleSelectAll,
  onToggleSelect,
}: ResourceTableProps<T>) {
  return (
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
                  onCheckedChange={onToggleSelectAll}
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
                    onClick={() => onSort(String(column.key))}
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
          {data.map((item) => {
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
                      onCheckedChange={() => onToggleSelect(itemKey)}
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
  );
}
