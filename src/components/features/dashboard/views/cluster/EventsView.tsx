"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Copy, Eye } from "lucide-react";
import { toast } from "sonner";
import { useEvents } from "@/lib/hooks/useK8sResources";
import { ResourceList } from "../../../resources/ResourceList";
import {
  eventColumns,
  translateColumns,
  type SortDirection,
  type FilterOption,
  type ContextMenuItemDef,
} from "../../../resources/columns";
import type { EventInfo } from "@/lib/types";

export function EventsView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh, retry } = useEvents({
    autoRefresh: true,
    refreshInterval: 10000,
  });
  const [sortKey, setSortKey] = useState<string | null>("last_timestamp");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const filterOptions: FilterOption<EventInfo>[] = useMemo(() => [
    {
      key: "warning",
      label: t("common.warnings"),
      predicate: (event) => event.event_type === "Warning",
      color: "yellow",
    },
    {
      key: "normal",
      label: t("common.normal"),
      predicate: (event) => event.event_type === "Normal",
      color: "blue",
    },
  ], [t]);

  const getEventContextMenu = (event: EventInfo): ContextMenuItemDef[] => [
    {
      label: "View Involved Object",
      icon: <Eye className="size-4" />,
      onClick: () => {
        toast.info(`${event.involved_object.kind}: ${event.involved_object.name}`);
      },
    },
    {
      label: "Copy Message",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(event.message);
        toast.success("Copied to clipboard");
      },
    },
  ];

  return (
    <ResourceList
      title={t("navigation.events")}
      data={data}
      columns={translateColumns(eventColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      onRetry={retry}
      getRowKey={(event) => event.uid}
      getRowNamespace={(event) => event.namespace}
      emptyMessage={t("empty.events")}
      contextMenuItems={getEventContextMenu}
      filterOptions={filterOptions}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}
