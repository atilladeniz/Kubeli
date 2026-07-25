"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Trash2, Eye, RefreshCw, Pause, Play, GitBranch } from "lucide-react";
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
import { useClusterStore } from "@/lib/stores/cluster-store";
import type { FluxKustomizationInfo } from "@/lib/types";
import {
  reconcileFluxKustomization,
  reconcileFluxKustomizationWithSource,
  suspendFluxKustomization,
  resumeFluxKustomization,
} from "@/lib/tauri/commands";
import { reportReconcileResult } from "./reconcile-feedback";

export function FluxKustomizationsView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh, retry } = useFluxKustomizations({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [inFlight, setInFlight] = useState<ReadonlySet<string>>(new Set());

  // Refresh when a resource is deleted from detail panel
  useRefreshOnDelete(refresh);

  // Surface suspend in the status field so sorting and search match the badge
  const rows = useMemo(
    () => data.map((k) => (k.suspended ? { ...k, status: "suspended" as const } : k)),
    [data]
  );

  const runReconcile = async (k: FluxKustomizationInfo, withSource: boolean) => {
    const key = `${k.namespace}/${k.name}`;
    if (inFlight.has(key)) return;
    setInFlight((prev) => new Set(prev).add(key));
    const context = useClusterStore.getState().currentCluster?.context;
    try {
      // Flux ignores reconcile requests while suspended, so resume first
      if (k.suspended) {
        await resumeFluxKustomization(k.name, k.namespace);
      }
      const token = withSource
        ? await reconcileFluxKustomizationWithSource(k.name, k.namespace)
        : await reconcileFluxKustomization(k.name, k.namespace);
      toast.success(
        k.suspended ? t("flux.resumedReconcileTriggered") : t("flux.reconcileTriggered"),
        { description: k.name }
      );
      refresh();
      await reportReconcileResult(
        t,
        "kustomization",
        k.name,
        k.namespace,
        token,
        context,
        refresh
      );
    } catch (e) {
      toast.error(t("flux.reconcileFailed"), { description: String(e) });
    } finally {
      setInFlight((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const getKustomizationContextMenu = (k: FluxKustomizationInfo): ContextMenuItemDef[] => [
    {
      label: t("common.viewDetails"),
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("kustomization", k.name, k.namespace),
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: k.suspended ? t("flux.resumeReconcile") : t("flux.reconcile"),
      icon: <RefreshCw className="size-4" />,
      onClick: () => runReconcile(k, false),
      disabled: inFlight.has(`${k.namespace}/${k.name}`),
    },
    {
      label: t("flux.reconcileWithSource"),
      icon: <GitBranch className="size-4" />,
      onClick: () => runReconcile(k, true),
      disabled: inFlight.has(`${k.namespace}/${k.name}`),
    },
    k.suspended
      ? {
          label: t("flux.resume"),
          icon: <Play className="size-4" />,
          onClick: async () => {
            try {
              await resumeFluxKustomization(k.name, k.namespace);
              toast.success(t("flux.kustomizationResumed"), { description: k.name });
              refresh();
            } catch (e) {
              toast.error(t("flux.resumeFailed"), { description: String(e) });
            }
          },
        }
      : {
          label: t("flux.suspend"),
          icon: <Pause className="size-4" />,
          onClick: async () => {
            try {
              await suspendFluxKustomization(k.name, k.namespace);
              toast.success(t("flux.kustomizationSuspended"), { description: k.name });
              refresh();
            } catch (e) {
              toast.error(t("flux.suspendFailed"), { description: String(e) });
            }
          },
        },
    { separator: true, label: "", onClick: () => {} },
    {
      label: t("common.copyName"),
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(k.name);
        toast.success(t("common.copiedToClipboard"), { description: k.name });
      },
    },
    {
      label: t("flux.copyPath"),
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(k.path);
        toast.success(t("common.copiedToClipboard"), { description: k.path });
      },
    },
    {
      label: t("flux.copySource"),
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(k.source_ref);
        toast.success(t("common.copiedToClipboard"), { description: k.source_ref });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: t("common.delete"),
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("kustomization", k.name, k.namespace, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("flux.kustomizations")}
      data={rows}
      columns={fluxKustomizationColumns}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      onRetry={retry}
      onRowClick={(k) => openResourceDetail("kustomization", k.name, k.namespace)}
      getRowKey={(k) => `${k.namespace}/${k.name}`}
      getRowNamespace={(k) => k.namespace}
      emptyMessage={t("flux.noKustomizations")}
      contextMenuItems={getKustomizationContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}
