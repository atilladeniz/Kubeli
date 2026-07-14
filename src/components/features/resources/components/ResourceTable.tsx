"use client";

import { memo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { getNamespaceColor } from "@/lib/utils/colors";
import { Checkbox } from "@/components/ui/checkbox";
import type { Column, ContextMenuItemDef, SortDirection } from "../types";

const ROW_HEIGHT = 40;
const OVERSCAN = 10;

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

interface ResourceTableRowProps<T> {
  item: T;
  itemKey: string;
  columns: Column<T>[];
  isSelected: boolean;
  namespace?: string;
  rowClassName?: string;
  hasBulkActions: boolean;
  isFixed: boolean;
  onRowClick?: (item: T) => void;
  contextMenuItems?: (item: T) => ContextMenuItemDef[];
  onToggleSelect: (key: string) => void;
}

function renderMenuItems(menuItems: ContextMenuItemDef[]) {
  return menuItems.map((menuItem, index) =>
    menuItem.separator ? (
      <ContextMenuSeparator key={`sep-${index}`} />
    ) : menuItem.children ? (
      <ContextMenuSub key={menuItem.label}>
        <ContextMenuSubTrigger disabled={menuItem.disabled} className="gap-2">
          {menuItem.icon}
          {menuItem.label}
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          {menuItem.children.map((child) => (
            <ContextMenuItem
              key={child.label}
              onClick={child.onClick}
              disabled={child.disabled}
              variant={child.variant}
              className="gap-2"
            >
              {child.icon}
              {child.label}
              {child.hint && (
                <span
                  className={cn(
                    "ml-auto rounded-full px-2 py-0.5 text-[10px] font-mono font-medium",
                    child.hintVariant === "active"
                      ? "bg-purple-500/20 text-purple-400"
                      : "bg-muted text-foreground"
                  )}
                >
                  {child.hint}
                </span>
              )}
            </ContextMenuItem>
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>
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
  );
}

function ResourceTableRowInner<T>({
  item,
  itemKey,
  columns,
  isSelected,
  namespace,
  rowClassName,
  hasBulkActions,
  isFixed,
  onRowClick,
  contextMenuItems,
  onToggleSelect,
}: ResourceTableRowProps<T>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const namespaceColor = namespace ? getNamespaceColor(namespace) : null;

  const rowContent = (
    <TableRow
      onClick={() => onRowClick?.(item)}
      className={cn(
        onRowClick && "cursor-pointer",
        namespaceColor && "border-l-4",
        namespaceColor?.borderLeft,
        isSelected && "bg-muted/50",
        rowClassName
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
        <TableCell
          key={String(column.key)}
          className={cn("text-sm", column.width, isFixed && "truncate")}
        >
          {column.render
            ? column.render(item)
            : String(
                (item as Record<string, unknown>)[String(column.key)] ?? "-"
              )}
        </TableCell>
      ))}
    </TableRow>
  );

  if (!contextMenuItems) {
    return rowContent;
  }

  // Lazy context menu: items are only built and mounted once the menu opens,
  // so contextMenuItems(item) is never called during plain row rendering.
  return (
    <ContextMenu onOpenChange={setMenuOpen}>
      <ContextMenuTrigger asChild>{rowContent}</ContextMenuTrigger>
      {menuOpen && (
        <ContextMenuContent className="w-48">
          {renderMenuItems(contextMenuItems(item))}
        </ContextMenuContent>
      )}
    </ContextMenu>
  );
}

const ResourceTableRow = memo(
  ResourceTableRowInner
) as typeof ResourceTableRowInner;

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
  // Opt out of React Compiler memoization: useVirtualizer returns functions
  // that must not be memoized (react-hooks/incompatible-library).
  "use no memo";

  const scrollRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/incompatible-library -- informational: compiler skips this component ("use no memo")
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0;
  const columnCount = columns.length + (hasBulkActions ? 1 : 0);
  // Fixed layout (stable columns, no scroll jitter) only when widths are
  // declared; otherwise fall back to content-sized auto layout.
  const hasFixedWidths = columns.some((c) => c.width);

  return (
    // overscroll-none kills the elastic bounce that left ghost rows above/below
    // the sticky header. The horizontal jitter is fixed at the source: columns
    // carry fixed widths so their content (e.g. the variable action buttons)
    // can't renegotiate widths as rows scroll through the virtual window.
    <div
      ref={scrollRef}
      className="h-full overflow-auto [overscroll-behavior:none]"
    >
      {/* table-fixed only when columns declare widths: widths then come from the
          headers, not per-row content, so variable action buttons can't jitter
          the layout sideways while scrolling. Tables without declared widths
          keep the content-sized auto layout. */}
      <Table className={cn("w-full", hasFixedWidths && "min-w-max table-fixed")}>
        {/* translate-z-0: force the sticky header onto its own GPU layer so
            virtual rows scrolling under it don't leave repaint ghosts in
            WebKit. */}
        <TableHeader className="sticky top-0 z-20 bg-background [transform:translateZ(0)]">
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
          {paddingTop > 0 && (
            <tr aria-hidden="true">
              <td
                colSpan={columnCount}
                style={{ height: paddingTop, padding: 0, border: 0 }}
              />
            </tr>
          )}
          {virtualRows.map((virtualRow) => {
            const item = data[virtualRow.index];
            const itemKey = getRowKey(item);
            return (
              <ResourceTableRow
                key={itemKey}
                item={item}
                itemKey={itemKey}
                columns={columns}
                isSelected={selectedKeys.has(itemKey)}
                namespace={getRowNamespace?.(item)}
                rowClassName={getRowClassName?.(item)}
                hasBulkActions={hasBulkActions}
                isFixed={hasFixedWidths}
                onRowClick={onRowClick}
                contextMenuItems={contextMenuItems}
                onToggleSelect={onToggleSelect}
              />
            );
          })}
          {paddingBottom > 0 && (
            <tr aria-hidden="true">
              <td
                colSpan={columnCount}
                style={{ height: paddingBottom, padding: 0, border: 0 }}
              />
            </tr>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
