export interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
  width?: string;
  /**
   * Skip the truncation applied to fixed-width cells. Use for cells whose
   * content must never be clipped (e.g. action buttons, badges).
   */
  noTruncate?: boolean;
  /**
   * Text used by the search filter for this column. Needed for columns whose
   * underlying value is an object (which would stringify to "[object Object]").
   */
  getSearchText?: (item: T) => string;
}

export interface FilterOption<T> {
  key: string;
  label: string;
  /** Count will be calculated from data */
  predicate: (item: T) => boolean;
  /** Optional color for the chip */
  color?: "default" | "green" | "yellow" | "red" | "blue";
}

export interface BulkAction<T> {
  key: string;
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "destructive";
  onAction: (items: T[]) => void | Promise<void>;
}

export interface ContextMenuItemDef {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
  separator?: boolean;
  children?: ContextMenuItemDef[];
  /** Right-aligned hint text (e.g. port number, shortcut) */
  hint?: string;
  /** Color variant for the hint chip */
  hintVariant?: "default" | "active";
}

export type SortDirection = "asc" | "desc";

export type TranslateFunc = (key: string) => string;
