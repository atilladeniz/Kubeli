"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { useLeases } from "@/lib/hooks/useK8sResources";
import { ResourceList } from "../../../resources/ResourceList";
import {
  leaseColumns,
  translateColumns,
  type SortDirection,
  type ContextMenuItemDef,
} from "../../../resources/columns";
import type { LeaseInfo } from "@/lib/types";

export function LeasesView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useLeases({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const [sortKey, setSortKey] = useState<string | null>("namespace");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const getLeaseContextMenu = (lease: LeaseInfo): ContextMenuItemDef[] => [
    {
      label: "Copy Holder Identity",
      icon: <Copy className="size-4" />,
      onClick: () => {
        if (lease.holder_identity) {
          navigator.clipboard.writeText(lease.holder_identity);
          toast.success("Copied to clipboard", { description: lease.holder_identity });
        }
      },
      disabled: !lease.holder_identity,
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(lease.name);
        toast.success("Copied to clipboard", { description: lease.name });
      },
    },
  ];

  return (
    <ResourceList
      title={t("navigation.leases")}
      data={data}
      columns={translateColumns(leaseColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(lease) => lease.uid}
      getRowNamespace={(lease) => lease.namespace}
      emptyMessage={t("empty.leases")}
      contextMenuItems={getLeaseContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}
