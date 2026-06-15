"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("common");
  const tArgo = useTranslations("argocd");
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
      label: t("viewDetails"),
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("application", a.name, a.namespace),
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: tArgo("refresh"),
      icon: <RefreshCw className="size-4" />,
      onClick: async () => {
        try {
          await refreshArgoCDApplication(a.name, a.namespace);
          toast.success(tArgo("refreshTriggered"), { description: a.name });
          refresh();
        } catch (e) {
          toast.error(tArgo("refreshFailed"), { description: String(e) });
        }
      },
    },
    {
      label: tArgo("hardRefresh"),
      icon: <RefreshCw className="size-4" />,
      onClick: async () => {
        try {
          await hardRefreshArgoCDApplication(a.name, a.namespace);
          toast.success(tArgo("hardRefreshTriggered"), { description: a.name });
          refresh();
        } catch (e) {
          toast.error(tArgo("hardRefreshFailed"), { description: String(e) });
        }
      },
    },
    {
      label: tArgo("sync"),
      icon: <Zap className="size-4" />,
      onClick: async () => {
        try {
          await syncArgoCDApplication(a.name, a.namespace);
          toast.success(tArgo("syncTriggered"), { description: a.name });
          refresh();
        } catch (e) {
          toast.error(tArgo("syncFailed"), { description: String(e) });
        }
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: t("copyName"),
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(a.name);
        toast.success(t("copiedToClipboard"), { description: a.name });
      },
    },
    {
      label: tArgo("copyRepo"),
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(a.repo_url);
        toast.success(t("copiedToClipboard"), { description: a.repo_url });
      },
    },
    {
      label: tArgo("copyPath"),
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(a.path);
        toast.success(t("copiedToClipboard"), { description: a.path });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: t("delete"),
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("application", a.name, a.namespace, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={tArgo("applications")}
      data={data}
      columns={argoCDApplicationColumns}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      onRowClick={(a) => openResourceDetail("application", a.name, a.namespace)}
      getRowKey={(a) => `${a.namespace}/${a.name}`}
      getRowNamespace={(a) => a.namespace}
      emptyMessage={tArgo("noApplications")}
      contextMenuItems={getApplicationContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}
