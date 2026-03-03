"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Copy, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { ResourceList } from "../../resources/ResourceList";
import {
  translateColumns,
  type SortDirection,
  type ContextMenuItemDef,
  type FilterOption,
  type Column,
} from "../../resources/columns";
import { useResourceDetail } from "../context";
import { useRefreshOnDelete } from "@/lib/hooks/useRefreshOnDelete";

// Base resource type - all K8s resources have these
interface BaseResource {
  uid: string;
  name: string;
  namespace?: string;
}

import type { KubeliError } from "@/lib/types/errors";

// Hook result type
interface ResourceHookResult<T> {
  data: T[];
  isLoading: boolean;
  error: KubeliError | null;
  refresh: () => void;
  retry?: () => void;
}

// Configuration for creating a resource view
export interface ResourceViewConfig<T extends BaseResource> {
  // Data hook
  hook: (options?: { autoRefresh?: boolean; refreshInterval?: number }) => ResourceHookResult<T>;

  // Column definitions
  columns: Column<T>[];

  // Translation keys
  titleKey: string;
  emptyMessageKey: string;

  // Resource type for API calls (e.g., "configmap", "secret")
  resourceType: string;

  // Whether resource is namespaced (default: true)
  namespaced?: boolean;

  // Default sort settings
  defaultSortKey?: string;
  defaultSortDirection?: SortDirection;

  // Optional filter options
  filterOptions?: FilterOption<T>[];

  // Optional: Additional context menu items (inserted before Copy/Delete)
  additionalMenuItems?: (resource: T, refresh: () => void) => ContextMenuItemDef[];

  // Optional: Skip delete action (for read-only resources like EndpointSlices)
  hideDelete?: boolean;

  // Optional: Custom copy items beyond just name
  copyItems?: { label: string; getValue: (resource: T) => string }[];
}

/**
 * Factory function to create simple resource list views.
 * Reduces boilerplate for views that follow the standard pattern:
 * - Fetch data with hook
 * - Display in ResourceList
 * - Context menu with View Details, Copy, Delete
 */
export function createResourceView<T extends BaseResource>(
  config: ResourceViewConfig<T>
) {
  const {
    hook,
    columns,
    titleKey,
    emptyMessageKey,
    resourceType,
    namespaced = true,
    defaultSortKey = "created_at",
    defaultSortDirection = "desc",
    filterOptions,
    additionalMenuItems,
    hideDelete = false,
    copyItems = [],
  } = config;

  return function ResourceView() {
    const t = useTranslations();
    const { data, isLoading, error, refresh, retry } = hook({
      autoRefresh: true,
      refreshInterval: 30000,
    });
    const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
    const [sortKey, setSortKey] = useState<string | null>(defaultSortKey);
    const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSortDirection);

    // Refresh when a resource is deleted from detail panel
    useRefreshOnDelete(refresh);

    const translatedColumns = useMemo(
      () => translateColumns(columns, t),
      [t]
    );

    const translatedFilterOptions = useMemo(() => {
      if (!filterOptions) return undefined;
      return filterOptions.map(opt => ({
        ...opt,
        label: t(opt.label) || opt.label,
      }));
    }, [t]);

    const getContextMenu = (resource: T): ContextMenuItemDef[] => {
      const items: ContextMenuItemDef[] = [
        {
          label: "View Details",
          icon: <Eye className="size-4" />,
          onClick: () => openResourceDetail(
            resourceType,
            resource.name,
            namespaced ? resource.namespace : undefined
          ),
        },
      ];

      // Add custom menu items if provided
      if (additionalMenuItems) {
        items.push({ separator: true, label: "", onClick: () => {} });
        items.push(...additionalMenuItems(resource, refresh));
      }

      items.push({ separator: true, label: "", onClick: () => {} });

      // Copy name
      items.push({
        label: "Copy Name",
        icon: <Copy className="size-4" />,
        onClick: () => {
          navigator.clipboard.writeText(resource.name);
          toast.success("Copied to clipboard", { description: resource.name });
        },
      });

      // Additional copy items
      for (const copyItem of copyItems) {
        const value = copyItem.getValue(resource);
        if (value) {
          items.push({
            label: copyItem.label,
            icon: <Copy className="size-4" />,
            onClick: () => {
              navigator.clipboard.writeText(value);
              toast.success("Copied to clipboard", { description: value });
            },
          });
        }
      }

      // Delete action
      if (!hideDelete) {
        items.push({ separator: true, label: "", onClick: () => {} });
        items.push({
          label: "Delete",
          icon: <Trash2 className="size-4" />,
          onClick: () => handleDeleteFromContext(
            resourceType,
            resource.name,
            namespaced ? resource.namespace : undefined,
            refresh
          ),
          variant: "destructive",
        });
      }

      return items;
    };

    return (
      <ResourceList
        title={t(titleKey)}
        data={data}
        columns={translatedColumns}
        isLoading={isLoading}
        error={error}
        onRefresh={refresh}
        onRetry={retry}
        getRowKey={(r) => r.uid}
        getRowNamespace={namespaced ? (r) => r.namespace || "" : undefined}
        emptyMessage={t(emptyMessageKey)}
        contextMenuItems={getContextMenu}
        onRowClick={(resource) => openResourceDetail(
          resourceType,
          resource.name,
          namespaced ? resource.namespace : undefined
        )}
        filterOptions={translatedFilterOptions}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
      />
    );
  };
}
