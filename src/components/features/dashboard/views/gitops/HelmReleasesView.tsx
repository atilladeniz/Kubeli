"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Copy,
  Trash2,
  Eye,
  RefreshCw,
  Pause,
  Play,
  GitBranch,
  Zap,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useHelmReleases } from "@/lib/hooks/useK8sResources";
import { useRefreshOnDelete } from "@/lib/hooks/useRefreshOnDelete";
import { ResourceList } from "../../../resources/ResourceList";
import {
  helmReleaseColumns,
  translateColumns,
  type SortDirection,
  type ContextMenuItemDef,
} from "../../../resources/columns";
import { useResourceDetail } from "../../context";
import { useClusterStore } from "@/lib/stores/cluster-store";
import type { HelmReleaseInfo } from "@/lib/types";
import {
  reconcileFluxHelmRelease,
  reconcileFluxHelmReleaseWithSource,
  forceFluxHelmRelease,
  resetFluxHelmRelease,
  suspendFluxHelmRelease,
  resumeFluxHelmRelease,
} from "@/lib/tauri/commands";
import { reportReconcileResult } from "./reconcile-feedback";

type ReconcileMode = "default" | "withSource" | "force" | "reset";

const reconcileCommand: Record<ReconcileMode, (name: string, ns: string) => Promise<string>> = {
  default: reconcileFluxHelmRelease,
  withSource: reconcileFluxHelmReleaseWithSource,
  force: forceFluxHelmRelease,
  reset: resetFluxHelmRelease,
};

export function HelmReleasesView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh, retry } = useHelmReleases({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext, handleUninstallFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("last_deployed");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [inFlight, setInFlight] = useState<ReadonlySet<string>>(new Set());

  // Refresh when a resource is deleted from detail panel
  useRefreshOnDelete(refresh);

  // Surface suspend in the status field so sorting and search match the badge
  const rows = useMemo(
    () => data.map((r) => (r.suspended ? { ...r, status: "suspended" as const } : r)),
    [data]
  );

  const runReconcile = async (release: HelmReleaseInfo, mode: ReconcileMode) => {
    const key = `${release.namespace}/${release.name}`;
    if (inFlight.has(key)) return;
    setInFlight((prev) => new Set(prev).add(key));
    const context = useClusterStore.getState().currentCluster?.context;
    try {
      // Flux ignores reconcile requests while suspended, so resume first
      if (release.suspended) {
        await resumeFluxHelmRelease(release.name, release.namespace);
      }
      const token = await reconcileCommand[mode](release.name, release.namespace);
      const triggered =
        mode === "reset"
          ? t("flux.resetTriggered")
          : release.suspended
            ? t("flux.resumedReconcileTriggered")
            : t("flux.reconcileTriggered");
      toast.success(triggered, { description: release.name });
      refresh();
      await reportReconcileResult(
        t,
        "helmrelease",
        release.name,
        release.namespace,
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

  const getHelmContextMenu = (release: HelmReleaseInfo): ContextMenuItemDef[] => {
    const items: ContextMenuItemDef[] = [];
    const busy = inFlight.has(`${release.namespace}/${release.name}`);

    // View Details for all releases (different resource type based on managed_by)
    items.push({
      label: t("common.viewDetails"),
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail(
        release.managed_by === "flux" ? "helmrelease" : "helm-release",
        release.name,
        release.namespace
      ),
    });

    // Flux-specific actions
    if (release.managed_by === "flux") {
      items.push({ separator: true, label: "", onClick: () => {} });
      items.push({
        label: release.suspended ? t("flux.resumeReconcile") : t("flux.reconcile"),
        icon: <RefreshCw className="size-4" />,
        onClick: () => runReconcile(release, "default"),
        disabled: busy,
      });
      items.push({
        label: t("flux.reconcileWithSource"),
        icon: <GitBranch className="size-4" />,
        onClick: () => runReconcile(release, "withSource"),
        disabled: busy,
      });
      items.push({
        label: t("flux.forceReconcile"),
        icon: <Zap className="size-4" />,
        onClick: () => runReconcile(release, "force"),
        disabled: busy,
      });
      items.push({
        label: t("flux.resetRetries"),
        icon: <RotateCcw className="size-4" />,
        onClick: () => runReconcile(release, "reset"),
        disabled: busy,
      });
      items.push(
        release.suspended
          ? {
              label: t("flux.resume"),
              icon: <Play className="size-4" />,
              onClick: async () => {
                try {
                  await resumeFluxHelmRelease(release.name, release.namespace);
                  toast.success(t("flux.helmReleaseResumed"), { description: release.name });
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
                  await suspendFluxHelmRelease(release.name, release.namespace);
                  toast.success(t("flux.helmReleaseSuspended"), { description: release.name });
                  refresh();
                } catch (e) {
                  toast.error(t("flux.suspendFailed"), { description: String(e) });
                }
              },
            }
      );
    }

    items.push({ separator: true, label: "", onClick: () => {} });
    items.push(
      {
        label: t("common.copyName"),
        icon: <Copy className="size-4" />,
        onClick: () => {
          navigator.clipboard.writeText(release.name);
          toast.success(t("common.copiedToClipboard"), { description: release.name });
        },
      },
      {
        label: t("flux.copyChart"),
        icon: <Copy className="size-4" />,
        onClick: () => {
          const chartInfo = `${release.chart}-${release.chart_version}`;
          navigator.clipboard.writeText(chartInfo);
          toast.success(t("common.copiedToClipboard"), { description: chartInfo });
        },
      }
    );

    // Delete/Uninstall
    items.push({ separator: true, label: "", onClick: () => {} });
    if (release.managed_by === "flux") {
      items.push({
        label: t("common.delete"),
        icon: <Trash2 className="size-4" />,
        onClick: () => handleDeleteFromContext("helmrelease", release.name, release.namespace, refresh),
        variant: "destructive",
      });
    } else {
      items.push({
        label: t("flux.forgetRelease"),
        icon: <Trash2 className="size-4" />,
        onClick: () => handleUninstallFromContext(release.name, release.namespace, refresh),
        variant: "destructive",
      });
    }

    return items;
  };

  return (
    <ResourceList
      title={t("navigation.releases")}
      data={rows}
      columns={translateColumns(helmReleaseColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      onRetry={retry}
      onRowClick={(r) => openResourceDetail(r.managed_by === "flux" ? "helmrelease" : "helm-release", r.name, r.namespace)}
      getRowKey={(r) => `${r.namespace}/${r.name}`}
      getRowNamespace={(r) => r.namespace}
      emptyMessage={t("empty.helmreleases")}
      contextMenuItems={getHelmContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}
