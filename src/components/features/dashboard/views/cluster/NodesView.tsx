"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, Copy, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { useNodes } from "@/lib/hooks/useK8sResources";
import {
  ResourceList,
  nodeColumns,
  translateColumns,
  type SortDirection,
  type ContextMenuItemDef,
} from "../../../resources/ResourceList";
import { useResourceDetail } from "../../context";
import type { NodeInfo } from "@/lib/types";

export function NodesView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useNodes({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getNodeContextMenu = (node: NodeInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("node", node.name),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(node.name);
        toast.success("Copied to clipboard", { description: node.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Cordon",
      icon: <AlertCircle className="size-4" />,
      onClick: () => toast.info("Coming soon", { description: `Cordon ${node.name}` }),
      disabled: node.status !== "Ready",
    },
    {
      label: "Drain",
      icon: <Trash2 className="size-4" />,
      onClick: () => toast.info("Coming soon", { description: `Drain ${node.name}` }),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.nodes")}
      data={data}
      columns={translateColumns(nodeColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(node) => node.uid}
      emptyMessage={t("empty.nodes")}
      contextMenuItems={getNodeContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}
