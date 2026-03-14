"use client";

import { useState, useMemo, useCallback } from "react";
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
import { Button } from "@/components/ui/button";
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

  const handleOpenNodeShell = useCallback((node: NodeInfo) => {
    addNodeTab(node.name);
  }, [addNodeTab]);

  const columnsWithActions = useMemo(() => [
    ...translateColumns(nodeColumns, t),
    {
      key: "actions",
      label: t("columns.actions") || "ACTIONS",
      render: (node: NodeInfo) => (
        <div className="flex items-center gap-1">
          {node.status === "Ready" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenNodeShell(node);
              }}
              className="h-7 px-2 text-green-500 hover:text-green-600 hover:bg-green-500/10"
            >
              <TerminalIcon className="size-3.5" />
              Shell
            </Button>
          )}
        </div>
      ),
    },
  ], [t, handleOpenNodeShell]);

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
      columns={columnsWithActions}
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
