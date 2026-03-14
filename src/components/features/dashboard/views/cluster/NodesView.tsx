"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, Copy, Trash2, Eye, TerminalIcon } from "lucide-react";
import { toast } from "sonner";
import { useNodes } from "@/lib/hooks/useK8sResources";
import { ResourceList } from "../../../resources/ResourceList";
import {
  nodeColumns,
  translateColumns,
  type SortDirection,
  type ContextMenuItemDef,
} from "../../../resources/columns";
import { useResourceDetail } from "../../context";
import { useTerminalTabs } from "../../../terminal";
import type { NodeInfo } from "@/lib/types";
import { getNodeSchedulingAction } from "./node-scheduling";

export function NodesView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh, retry } = useNodes({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail } = useResourceDetail();
  const { addNodeTab } = useTerminalTabs();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleOpenNodeShell = (node: NodeInfo) => {
    addNodeTab(node.name);
  };

  const getNodeContextMenu = (node: NodeInfo): ContextMenuItemDef[] => {
    const schedulingAction = getNodeSchedulingAction(node);

    return [
      {
        label: t("common.viewDetails"),
        icon: <Eye className="size-4" />,
        onClick: () => openResourceDetail("node", node.name),
      },
      {
        label: t("common.copyName"),
        icon: <Copy className="size-4" />,
        onClick: () => {
          navigator.clipboard.writeText(node.name);
          toast.success(t("common.copiedToClipboard"), { description: node.name });
        },
      },
      { separator: true, label: "", onClick: () => {} },
      {
        label: t("terminal.shell"),
        icon: <TerminalIcon className="size-4" />,
        onClick: () => handleOpenNodeShell(node),
        disabled: node.status !== "Ready",
      },
      {
        label: schedulingAction.label,
        icon: <AlertCircle className="size-4" />,
        onClick: () => toast.info("Coming soon", { description: schedulingAction.description }),
        disabled: schedulingAction.disabled,
      },
      {
        label: "Drain",
        icon: <Trash2 className="size-4" />,
        onClick: () => toast.info("Coming soon", { description: `Drain ${node.name}` }),
        variant: "destructive",
      },
    ];
  };

  return (
    <ResourceList
      title={t("navigation.nodes")}
      data={data}
      columns={translateColumns(nodeColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      onRetry={retry}
      getRowKey={(node) => node.uid}
      emptyMessage={t("empty.nodes")}
      contextMenuItems={getNodeContextMenu}
      onRowClick={(node) => openResourceDetail("node", node.name)}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}
