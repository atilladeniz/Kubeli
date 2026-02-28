"use client";

import { useState } from "react";
import { Copy, Trash2, Eye, RefreshCw, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { useFluxKustomizations } from "@/lib/hooks/useK8sResources";
import { useRefreshOnDelete } from "@/lib/hooks/useRefreshOnDelete";
import { ResourceList } from "../../../resources/ResourceList";
import {
  fluxKustomizationColumns,
  type SortDirection,
  type ContextMenuItemDef,
} from "../../../resources/columns";
import { useResourceDetail } from "../../context";
import type { FluxKustomizationInfo } from "@/lib/types";
import {
  reconcileFluxKustomization,
  suspendFluxKustomization,
  resumeFluxKustomization,
} from "@/lib/tauri/commands";

export function FluxKustomizationsView() {
  const { data, isLoading, error, refresh, retry } = useFluxKustomizations({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Refresh when a resource is deleted from detail panel
  useRefreshOnDelete(refresh);

  const getKustomizationContextMenu = (k: FluxKustomizationInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("kustomization", k.name, k.namespace),
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Reconcile",
      icon: <RefreshCw className="size-4" />,
      onClick: async () => {
        try {
          await reconcileFluxKustomization(k.name, k.namespace);
          toast.success("Reconciliation triggered", { description: k.name });
          refresh();
        } catch (e) {
          toast.error("Failed to trigger reconciliation", { description: String(e) });
        }
      },
    },
    k.suspended
      ? {
          label: "Resume",
          icon: <Play className="size-4" />,
          onClick: async () => {
            try {
              await resumeFluxKustomization(k.name, k.namespace);
              toast.success("Kustomization resumed", { description: k.name });
              refresh();
            } catch (e) {
              toast.error("Failed to resume", { description: String(e) });
            }
          },
        }
      : {
          label: "Suspend",
          icon: <Pause className="size-4" />,
          onClick: async () => {
            try {
              await suspendFluxKustomization(k.name, k.namespace);
              toast.success("Kustomization suspended", { description: k.name });
              refresh();
            } catch (e) {
              toast.error("Failed to suspend", { description: String(e) });
            }
          },
        },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(k.name);
        toast.success("Copied to clipboard", { description: k.name });
      },
    },
    {
      label: "Copy Path",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(k.path);
        toast.success("Copied to clipboard", { description: k.path });
      },
    },
    {
      label: "Copy Source",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(k.source_ref);
        toast.success("Copied to clipboard", { description: k.source_ref });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("kustomization", k.name, k.namespace, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title="Kustomizations"
      data={data}
      columns={fluxKustomizationColumns}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      onRetry={retry}
      onRowClick={(k) => openResourceDetail("kustomization", k.name, k.namespace)}
      getRowKey={(k) => `${k.namespace}/${k.name}`}
      getRowNamespace={(k) => k.namespace}
      emptyMessage="No Flux Kustomizations found"
      contextMenuItems={getKustomizationContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}
