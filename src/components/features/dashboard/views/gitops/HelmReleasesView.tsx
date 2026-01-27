"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Trash2, Eye, RefreshCw, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { useHelmReleases } from "@/lib/hooks/useK8sResources";
import {
  ResourceList,
  helmReleaseColumns,
  translateColumns,
  type SortDirection,
  type ContextMenuItemDef,
} from "../../../resources/ResourceList";
import { useResourceDetail } from "../../context";
import type { HelmReleaseInfo } from "@/lib/types";
import {
  reconcileFluxHelmRelease,
  suspendFluxHelmRelease,
  resumeFluxHelmRelease,
} from "@/lib/tauri/commands";

export function HelmReleasesView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useHelmReleases({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext, handleUninstallFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("last_deployed");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getHelmContextMenu = (release: HelmReleaseInfo): ContextMenuItemDef[] => {
    const items: ContextMenuItemDef[] = [];

    // View Details for all releases (different resource type based on managed_by)
    items.push({
      label: "View Details",
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
        label: "Reconcile",
        icon: <RefreshCw className="size-4" />,
        onClick: async () => {
          try {
            await reconcileFluxHelmRelease(release.name, release.namespace);
            toast.success("Reconciliation triggered", { description: release.name });
            refresh();
          } catch (e) {
            toast.error("Failed to trigger reconciliation", { description: String(e) });
          }
        },
      });
      items.push(
        release.suspended
          ? {
              label: "Resume",
              icon: <Play className="size-4" />,
              onClick: async () => {
                try {
                  await resumeFluxHelmRelease(release.name, release.namespace);
                  toast.success("HelmRelease resumed", { description: release.name });
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
                  await suspendFluxHelmRelease(release.name, release.namespace);
                  toast.success("HelmRelease suspended", { description: release.name });
                  refresh();
                } catch (e) {
                  toast.error("Failed to suspend", { description: String(e) });
                }
              },
            }
      );
    }

    items.push({ separator: true, label: "", onClick: () => {} });
    items.push(
      {
        label: "Copy Name",
        icon: <Copy className="size-4" />,
        onClick: () => {
          navigator.clipboard.writeText(release.name);
          toast.success("Copied to clipboard", { description: release.name });
        },
      },
      {
        label: "Copy Chart",
        icon: <Copy className="size-4" />,
        onClick: () => {
          const chartInfo = `${release.chart}-${release.chart_version}`;
          navigator.clipboard.writeText(chartInfo);
          toast.success("Copied to clipboard", { description: chartInfo });
        },
      }
    );

    // Delete/Uninstall
    items.push({ separator: true, label: "", onClick: () => {} });
    if (release.managed_by === "flux") {
      items.push({
        label: "Delete",
        icon: <Trash2 className="size-4" />,
        onClick: () => handleDeleteFromContext("helmrelease", release.name, release.namespace, refresh),
        variant: "destructive",
      });
    } else {
      items.push({
        label: "Uninstall",
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
      data={data}
      columns={translateColumns(helmReleaseColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
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
