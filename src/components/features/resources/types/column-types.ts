export interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
  width?: string;
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
}

export type SortDirection = "asc" | "desc";

export type TranslateFunc = (key: string) => string;
