"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  FileText,
  Terminal as TerminalIcon,
  ArrowRightLeft,
  Copy,
  Trash2,
  Eye,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePods, useServices } from "@/lib/hooks/useK8sResources";
import { usePortForward } from "@/lib/hooks/usePortForward";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { useFavoritesStore } from "@/lib/stores/favorites-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useRefreshOnDelete } from "@/lib/hooks/useRefreshOnDelete";
import { useTerminalTabs } from "../../../terminal";
import { ResourceList } from "../../../resources/ResourceList";
import {
  getPodColumnsWithMetrics,
  translateColumns,
  getEffectivePodStatus,
  type SortDirection,
  type FilterOption,
  type BulkAction,
  type ContextMenuItemDef,
} from "../../../resources/columns";
import { deleteResource } from "@/lib/tauri/commands";
import { usePodMetrics } from "@/lib/hooks/useMetrics";
import { seedHistoryFromBulkMetrics } from "@/lib/hooks/useMetricsHistory";
import { useResourceDetail } from "../../context";
import { useTabsStore } from "@/lib/stores/tabs-store";
import { PortSelectPopover } from "../../../portforward";
import type { PodInfo, PodMetrics, ServiceInfo, ServicePortInfo } from "@/lib/types";

export function PodsView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh, retry, startWatch, stopWatchFn, isWatching } = usePods({
    autoWatch: true,
    autoRefresh: true,
    refreshInterval: 10000,
  });
  const { data: services } = useServices({ autoRefresh: true, refreshInterval: 30000 });
  const { data: podMetricsData, isLoading: metricsLoading } = usePodMetrics(undefined, {
    autoRefresh: true,
    refreshInterval: 10000,
    initialRefreshInterval: 3000,
  });

  // Build a lookup map for pod metrics AND seed sparkline history.
  // Seeding inside useMemo (not useEffect) ensures history is populated
  // BEFORE PodMetricsCell renders and calls getHistorySnapshot().
  const metricsMap = useMemo(() => {
    if (podMetricsData.length > 0) {
      seedHistoryFromBulkMetrics(podMetricsData);
    }
    const map = new Map<string, PodMetrics>();
    for (const m of podMetricsData) {
      map.set(`${m.namespace}/${m.name}`, m);
    }
    return map;
  }, [podMetricsData]);

  const { forwards, startForward, stopForward } = usePortForward();
  const { addTab } = useTerminalTabs();
  const { openResourceDetail, handleDeleteFromContext, closeResourceDetail } = useResourceDetail();
  const openTabStore = useTabsStore((s) => s.openTab);
  const tabCount = useTabsStore((s) => s.tabs.length);
  const pendingLogsHandled = useRef<{ namespace: string; podName: string } | null>(null);

  const openLogsTab = (podName: string, namespace: string) => {
    if (tabCount >= 10) {
      toast.warning(t("tabs.limitToast"));
      return;
    }
    openTabStore("pod-logs", `Logs: ${podName} (${namespace})`, {
      newTab: true,
      metadata: { namespace, podName },
    });
  };
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const { currentCluster } = useClusterStore();
  const { addFavorite, removeFavorite, isFavorite } = useFavoritesStore();
  const { pendingPodLogs, setPendingPodLogs } = useUIStore();
  const clusterContext = currentCluster?.context || "";

  // Refresh when a resource is deleted from detail panel (only if not watching)
  useRefreshOnDelete(refresh, !isWatching);

  // Watch for pending pod logs from AI assistant link clicks
  useEffect(() => {
    if (!pendingPodLogs || !data) return;
    if (pendingLogsHandled.current === pendingPodLogs) return;
    const matchingPod = data.find(
      (pod) => pod.namespace === pendingPodLogs.namespace && pod.name === pendingPodLogs.podName
    );
    pendingLogsHandled.current = pendingPodLogs;
    setPendingPodLogs(null);
    if (matchingPod) {
      queueMicrotask(() => openLogsTab(matchingPod.name, matchingPod.namespace));
    }
  }, [pendingPodLogs, data, setPendingPodLogs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pod status filters - use effective status for accurate counting
  const podFilters: FilterOption<PodInfo>[] = useMemo(() => [
    { key: "running", label: t("workloads.running"), predicate: (p) => getEffectivePodStatus(p) === "Running", color: "green" },
    { key: "pending", label: t("workloads.pending"), predicate: (p) => p.phase === "Pending", color: "yellow" },
    { key: "unhealthy", label: t("workloads.unhealthy"), predicate: (p) => {
      const status = getEffectivePodStatus(p);
      return p.phase === "Running" && status !== "Running";
    }, color: "red" },
    { key: "failed", label: t("workloads.failed"), predicate: (p) => p.phase === "Failed", color: "red" },
    { key: "succeeded", label: t("workloads.succeeded"), predicate: (p) => p.phase === "Succeeded", color: "blue" },
  ], [t]);

  // Bulk actions for pods
  const podBulkActions: BulkAction<PodInfo>[] = useMemo(() => [
    {
      key: "delete",
      label: "Delete",
      icon: <Trash2 className="size-3.5" />,
      variant: "destructive",
      onAction: async (pods) => {
        for (const pod of pods) {
          try {
            await deleteResource("pod", pod.name, pod.namespace);
          } catch (err) {
            console.error(`Failed to delete pod ${pod.name}:`, err);
          }
        }
        toast.success(`Deleted ${pods.length} pod(s)`);
        if (!isWatching) {
          refresh();
        }
      },
    },
  ], [refresh, isWatching]);

  const handleOpenShell = (pod: PodInfo) => {
    addTab(pod.namespace, pod.name);
  };

  // Find matching service for a pod based on label selectors
  const findServiceForPod = (pod: PodInfo): ServiceInfo | undefined => {
    return services.find((svc) => {
      if (svc.namespace !== pod.namespace) return false;
      if (!svc.selector || Object.keys(svc.selector).length === 0) return false;
      return Object.entries(svc.selector).every(
        ([key, value]) => pod.labels[key] === value
      );
    });
  };

  // Check if pod's service is being forwarded (any port)
  const getForwardForPod = (pod: PodInfo) => {
    const service = findServiceForPod(pod);
    if (!service) return undefined;
    return forwards.find(
      (f) =>
        f.name === service.name &&
        f.namespace === service.namespace &&
        f.target_type === "service"
    );
  };

  // Get all forwards for a pod's service (for multi-port popover)
  const getForwardsForPod = (pod: PodInfo) => {
    const service = findServiceForPod(pod);
    if (!service) return [];
    return forwards.filter(
      (f) =>
        f.name === service.name &&
        f.namespace === service.namespace &&
        f.target_type === "service"
    );
  };

  const handlePortForward = (pod: PodInfo, port?: ServicePortInfo) => {
    const service = findServiceForPod(pod);
    if (service && service.ports.length > 0) {
      const p = port ?? service.ports[0];
      startForward(service.namespace, service.name, "service", p.port);
    }
  };

  const handleDisconnect = (pod: PodInfo) => {
    const forward = getForwardForPod(pod);
    if (forward) {
      stopForward(forward.forward_id);
    }
  };

  // Get row class for highlighting forwarded pods
  const getRowClassName = (pod: PodInfo): string => {
    if (pod.deletion_timestamp) {
      return "bg-muted/40 text-muted-foreground";
    }
    const forward = getForwardForPod(pod);
    if (forward) {
      return "bg-purple-500/10 hover:bg-purple-500/15";
    }
    return "";
  };

  // Always show metrics columns — skeleton shimmer while loading, no layout shift
  const baseColumns = getPodColumnsWithMetrics(metricsMap, metricsLoading && metricsMap.size === 0);

  const columnsWithActions = [
    ...translateColumns(baseColumns, t),
    {
      key: "actions",
      label: t("columns.actions") || "ACTIONS",
      render: (pod: PodInfo) => {
        const isTerminating = !!pod.deletion_timestamp;
        const service = findServiceForPod(pod);
        const forward = getForwardForPod(pod);
        const isForwarded = !!forward;
        const canForward = !!service && service.ports.length > 0;

        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={isTerminating}
              onClick={(e) => {
                e.stopPropagation();
                closeResourceDetail();
                openLogsTab(pod.name, pod.namespace);
              }}
              className="h-7 px-2 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
            >
              <FileText className="size-3.5" />
              Logs
            </Button>
            {pod.phase === "Running" && (
              <Button
                variant="ghost"
                size="sm"
                disabled={isTerminating}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenShell(pod);
                }}
                className="h-7 px-2 text-green-500 hover:text-green-600 hover:bg-green-500/10"
              >
                <TerminalIcon className="size-3.5" />
                Shell
              </Button>
            )}
            {canForward && service && service.ports.length > 1 ? (() => {
              const podForwards = getForwardsForPod(pod);
              return (
                <PortSelectPopover
                  ports={service.ports}
                  forwards={podForwards}
                  onForward={(port) => handlePortForward(pod, port)}
                  onStop={(id) => stopForward(id)}
                  disabled={isTerminating}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isTerminating}
                    onClick={(e) => e.stopPropagation()}
                    className="h-7 px-2 text-purple-500 hover:text-purple-600 hover:bg-purple-500/10"
                  >
                    <ArrowRightLeft className="size-3.5" />
                    {podForwards.length > 0
                      ? `Forward (${podForwards.length})`
                      : "Forward"}
                  </Button>
                </PortSelectPopover>
              );
            })() : canForward ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={isTerminating}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isForwarded) {
                    handleDisconnect(pod);
                  } else {
                    handlePortForward(pod);
                  }
                }}
                className={cn(
                  "h-7 px-2",
                  isForwarded
                    ? "text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    : "text-purple-500 hover:text-purple-600 hover:bg-purple-500/10"
                )}
              >
                <ArrowRightLeft className="size-3.5" />
                {isForwarded ? "Stop Port" : "Forward"}
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  const getPodContextMenu = (pod: PodInfo): ContextMenuItemDef[] => {
    const isTerminating = !!pod.deletion_timestamp;
    const service = findServiceForPod(pod);
    const forward = getForwardForPod(pod);
    const isForwarded = !!forward;
    const canForward = !!service && service.ports.length > 0;
    const isFav = isFavorite(clusterContext, "pods", pod.name, pod.namespace);

    return [
      {
        label: "View Details",
        icon: <Eye className="size-4" />,
        onClick: () => {
          openResourceDetail("pod", pod.name, pod.namespace);
        },
      },
      {
        label: "View Logs",
        icon: <FileText className="size-4" />,
        onClick: () => {
          closeResourceDetail();
          openLogsTab(pod.name, pod.namespace);
        },
        disabled: isTerminating,
      },
      {
        label: "Open Shell",
        icon: <TerminalIcon className="size-4" />,
        onClick: () => handleOpenShell(pod),
        disabled: isTerminating || pod.phase !== "Running",
      },
      ...(canForward
        ? [
            { separator: true, label: "", onClick: () => {} },
            ...(service!.ports.length === 1
              ? [
                  {
                    label: isForwarded ? "Stop Port Forward" : "Port Forward",
                    icon: <ArrowRightLeft className="size-4" />,
                    onClick: () =>
                      isForwarded ? handleDisconnect(pod) : handlePortForward(pod),
                    disabled: isTerminating,
                  },
                ]
              : [
                  {
                    label: "Port Forward",
                    icon: <ArrowRightLeft className="size-4" />,
                    onClick: () => {},
                    disabled: isTerminating,
                    children: service!.ports.map((port) => {
                      const podForwards = getForwardsForPod(pod);
                      const fwd = podForwards.find((f) => f.target_port === port.port);
                      const label = fwd ? "Stop" : "Forward";
                      return {
                        label: port.name ? `${label} ${port.name}` : `${label} port`,
                        hint: String(port.port),
                        hintVariant: fwd ? "active" as const : "default" as const,
                        onClick: () =>
                          fwd ? stopForward(fwd.forward_id) : handlePortForward(pod, port),
                        disabled: isTerminating,
                      };
                    }),
                  },
                ]),
          ]
        : []),
      { separator: true, label: "", onClick: () => {} },
      {
        label: isFav ? "Remove from Favorites" : "Add to Favorites",
        icon: <Star className={cn("size-4", isFav && "fill-yellow-500 text-yellow-500")} />,
        onClick: () => {
          if (isFav) {
            const favs = useFavoritesStore.getState().favorites[clusterContext] || [];
            const fav = favs.find(f => f.resourceType === "pods" && f.name === pod.name && f.namespace === pod.namespace);
            if (fav) removeFavorite(clusterContext, fav.id);
          } else {
            addFavorite(clusterContext, "pods", pod.name, pod.namespace);
            toast.success("Added to favorites", { description: pod.name });
          }
        },
      },
      { separator: true, label: "", onClick: () => {} },
      {
        label: "Copy Name",
        icon: <Copy className="size-4" />,
        onClick: () => {
          navigator.clipboard.writeText(pod.name);
          toast.success("Copied to clipboard", { description: pod.name });
        },
      },
      {
        label: "Copy Full Name",
        icon: <Copy className="size-4" />,
        onClick: () => {
          const fullName = `${pod.namespace}/${pod.name}`;
          navigator.clipboard.writeText(fullName);
          toast.success("Copied to clipboard", { description: fullName });
        },
      },
      { separator: true, label: "", onClick: () => {} },
      {
        label: "Delete Pod",
        icon: <Trash2 className="size-4" />,
        onClick: () =>
          handleDeleteFromContext("pod", pod.name, pod.namespace, () => {
            if (!isWatching) {
              refresh();
            }
          }),
        variant: "destructive",
        disabled: isTerminating,
      },
    ];
  };

  // Custom sort comparator for metrics columns
  const customSortComparator = useMemo(() => {
    if (sortKey === "cpu_usage" || sortKey === "memory_usage") {
      return (a: PodInfo, b: PodInfo) => {
        const aMetrics = metricsMap.get(`${a.namespace}/${a.name}`);
        const bMetrics = metricsMap.get(`${b.namespace}/${b.name}`);
        const aVal = sortKey === "cpu_usage"
          ? (aMetrics?.total_cpu_nano_cores ?? -1)
          : (aMetrics?.total_memory_bytes ?? -1);
        const bVal = sortKey === "cpu_usage"
          ? (bMetrics?.total_cpu_nano_cores ?? -1)
          : (bMetrics?.total_memory_bytes ?? -1);
        return aVal - bVal;
      };
    }
    return undefined;
  }, [sortKey, metricsMap]);

  return (
    <ResourceList
      title={t("navigation.pods")}
      data={data}
      columns={columnsWithActions}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      onRetry={retry}
      isWatching={isWatching}
      onStartWatch={startWatch}
      onStopWatch={stopWatchFn}
      onRowClick={(pod) => {
        openResourceDetail("pod", pod.name, pod.namespace);
      }}
      getRowKey={(pod) => pod.uid}
      getRowClassName={getRowClassName}
      getRowNamespace={(pod) => pod.namespace}
      emptyMessage={t("empty.pods")}
      contextMenuItems={getPodContextMenu}
      filterOptions={podFilters}
      bulkActions={podBulkActions}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
      customSortComparator={customSortComparator}
    />
  );
}
