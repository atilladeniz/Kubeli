"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { NamespaceColorDot } from "@/components/features/resources/components/NamespaceColorDot";
import { ResourceList } from "@/components/features/resources/ResourceList";
import type { CustomResourceInfo } from "@/lib/types";
import type { CustomResourceDefinitionRef } from "@/lib/custom-resources";
import { useCustomResources } from "@/lib/hooks/useK8sResources";
import { formatAge } from "@/components/features/resources/lib/utils";
import { useRefreshOnDelete } from "@/lib/hooks/useRefreshOnDelete";
import { useResourceDetail } from "../../context";
import {
  translateColumns,
  type Column,
  type ContextMenuItemDef,
  type SortDirection,
} from "@/components/features/resources/columns";

interface CustomResourcesViewProps {
  resourceType: string;
  definition: CustomResourceDefinitionRef;
}

export function CustomResourcesView({
  resourceType,
  definition,
}: CustomResourcesViewProps) {
  const t = useTranslations();
  const { data, isLoading, error, refresh, retry } = useCustomResources(definition);
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useRefreshOnDelete(refresh);

  const columns = useMemo<Column<CustomResourceInfo>[]>(() => {
    const baseColumns: Column<CustomResourceInfo>[] = [
      {
        key: "name",
        label: "NAME",
        sortable: true,
        render: (resource) => (
          <span className="font-medium text-xs">{resource.name}</span>
        ),
      },
    ];

    if (definition.namespaced) {
      baseColumns.push({
        key: "namespace",
        label: "NAMESPACE",
        sortable: true,
        render: (resource) =>
          resource.namespace ? (
            <div className="flex items-center gap-1.5">
              <NamespaceColorDot namespace={resource.namespace} />
              <span className="text-xs text-muted-foreground">{resource.namespace}</span>
            </div>
          ) : (
            "-"
          ),
      });
    }

    baseColumns.push(
      {
        key: "status",
        label: "STATUS",
        sortable: true,
        render: (resource) => (
          <span className="text-xs text-muted-foreground">
            {resource.status || "-"}
          </span>
        ),
      },
      {
        key: "created_at",
        label: "AGE",
        sortable: true,
        render: (resource) => (resource.created_at ? formatAge(resource.created_at) : "-"),
      }
    );

    return baseColumns;
  }, [definition.namespaced]);

  const getContextMenu = (resource: CustomResourceInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () =>
        openResourceDetail(
          resourceType,
          resource.name,
          definition.namespaced ? resource.namespace || undefined : undefined
        ),
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(resource.name);
        toast.success("Copied to clipboard", { description: resource.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () =>
        handleDeleteFromContext(
          resourceType,
          resource.name,
          definition.namespaced ? resource.namespace || undefined : undefined,
          refresh
        ),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={`${t("navigation.customResources")} / ${definition.group} / ${definition.kind}`}
      data={data}
      columns={translateColumns(columns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      onRetry={retry}
      getRowKey={(resource) => resource.uid}
      getRowNamespace={
        definition.namespaced
          ? (resource) => resource.namespace || ""
          : undefined
      }
      emptyMessage={`No ${definition.kind} resources found`}
      contextMenuItems={getContextMenu}
      onRowClick={(resource) =>
        openResourceDetail(
          resourceType,
          resource.name,
          definition.namespaced ? resource.namespace || undefined : undefined
        )
      }
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => {
        setSortKey(key);
        setSortDirection(dir);
      }}
    />
  );
}
