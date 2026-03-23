"use client";

import { useState } from "react";
import { Copy, Trash2, Eye, RefreshCw, Zap } from "lucide-react";
import { toast } from "sonner";
import { useArgoCDApplications } from "@/lib/hooks/useK8sResources";
import { useRefreshOnDelete } from "@/lib/hooks/useRefreshOnDelete";
import { ResourceList } from "../../../resources/ResourceList";
import {
  argoCDApplicationColumns,
  type SortDirection,
  type ContextMenuItemDef,
} from "../../../resources/columns";
import { useResourceDetail } from "../../context";
import type { ArgoCDApplicationInfo } from "@/lib/types";
import {
  refreshArgoCDApplication,
  hardRefreshArgoCDApplication,
  syncArgoCDApplication,
} from "@/lib/tauri/commands";

export function ArgoCDApplicationsView() {
  const { data, isLoading, error, refresh } = useArgoCDApplications({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useRefreshOnDelete(refresh);

  const getApplicationContextMenu = (a: ArgoCDApplicationInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("application", a.name, a.namespace),
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Refresh",
      icon: <RefreshCw className="size-4" />,
      onClick: async () => {
        try {
          await refreshArgoCDApplication(a.name, a.namespace);
          toast.success("Refresh triggered", { description: a.name });
          refresh();
        } catch (e) {
          toast.error("Failed to trigger refresh", { description: String(e) });
        }
      },
    },
    {
      label: "Hard Refresh",
      icon: <RefreshCw className="size-4" />,
      onClick: async () => {
        try {
          await hardRefreshArgoCDApplication(a.name, a.namespace);
          toast.success("Hard refresh triggered", { description: a.name });
          refresh();
        } catch (e) {
          toast.error("Failed to trigger hard refresh", { description: String(e) });
        }
      },
    },
    {
      label: "Sync",
      icon: <Zap className="size-4" />,
      onClick: async () => {
        try {
          await syncArgoCDApplication(a.name, a.namespace);
          toast.success("Sync triggered", { description: a.name });
          refresh();
        } catch (e) {
          toast.error("Failed to trigger sync", { description: String(e) });
        }
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(a.name);
        toast.success("Copied to clipboard", { description: a.name });
      },
    },
    {
      label: "Copy Repo",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(a.repo_url);
        toast.success("Copied to clipboard", { description: a.repo_url });
      },
    },
    {
      label: "Copy Path",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(a.path);
        toast.success("Copied to clipboard", { description: a.path });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("application", a.name, a.namespace, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title="Applications"
      data={data}
      columns={argoCDApplicationColumns}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      onRowClick={(a) => openResourceDetail("application", a.name, a.namespace)}
      getRowKey={(a) => `${a.namespace}/${a.name}`}
      getRowNamespace={(a) => a.namespace}
      emptyMessage="No ArgoCD Applications found"
      contextMenuItems={getApplicationContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}
