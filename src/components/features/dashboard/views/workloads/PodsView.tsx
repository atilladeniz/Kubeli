"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  FileText,
  X,
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
import { LogViewer } from "../../../logs/LogViewer";
import { ResourceList } from "../../../resources/ResourceList";
import {
  podColumns,
  translateColumns,
  type SortDirection,
  type FilterOption,
  type BulkAction,
  type ContextMenuItemDef,
} from "../../../resources/columns";
import { deleteResource } from "@/lib/tauri/commands";
import { useResourceDetail } from "../../context";
import type { PodInfo, ServiceInfo } from "@/lib/types";

export function PodsView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh, startWatch, stopWatchFn, isWatching } = usePods({
    autoWatch: true,
    autoRefresh: true,
    refreshInterval: 10000,
  });
  const { data: services } = useServices({ autoRefresh: true, refreshInterval: 30000 });
  const { forwards, startForward, stopForward } = usePortForward();
  const [selectedPod, setSelectedPod] = useState<PodInfo | null>(null);
  const { addTab } = useTerminalTabs();
  const { openResourceDetail, handleDeleteFromContext, closeResourceDetail } = useResourceDetail();
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
    if (pendingPodLogs && data) {
      const matchingPod = data.find(
        (pod) => pod.namespace === pendingPodLogs.namespace && pod.name === pendingPodLogs.podName
      );
      // Clear pending state first
      setPendingPodLogs(null);
      // Defer state update to avoid cascading renders
      if (matchingPod) {
        queueMicrotask(() => setSelectedPod(matchingPod));
      }
    }
  }, [pendingPodLogs, data, setPendingPodLogs]);

  // Pod status filters
  const podFilters: FilterOption<PodInfo>[] = useMemo(() => [
    { key: "running", label: "Running", predicate: (p) => p.phase === "Running", color: "green" },
    { key: "pending", label: "Pending", predicate: (p) => p.phase === "Pending", color: "yellow" },
    { key: "failed", label: "Failed", predicate: (p) => p.phase === "Failed", color: "red" },
    { key: "succeeded", label: "Succeeded", predicate: (p) => p.phase === "Succeeded", color: "blue" },
  ], []);

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

  // Check if pod's service is being forwarded
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

  const handlePortForward = (pod: PodInfo) => {
    const service = findServiceForPod(pod);
    if (service && service.ports.length > 0) {
      const port = service.ports[0];
      startForward(service.namespace, service.name, "service", port.port);
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

  // Add logs and shell action columns
  const columnsWithActions = [
    ...translateColumns(podColumns, t),
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
                setSelectedPod(pod);
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
            {canForward && (
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
            )}
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
          setSelectedPod(null);
          openResourceDetail("pod", pod.name, pod.namespace);
        },
      },
      {
        label: "View Logs",
        icon: <FileText className="size-4" />,
        onClick: () => {
          closeResourceDetail();
          setSelectedPod(pod);
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
            {
              label: isForwarded ? "Stop Port Forward" : "Port Forward",
              icon: <ArrowRightLeft className="size-4" />,
              onClick: () =>
                isForwarded ? handleDisconnect(pod) : handlePortForward(pod),
              disabled: isTerminating,
            },
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

  if (selectedPod) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedPod(null)}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
            Back to Pods
          </Button>
        </div>
        <div className="flex-1 overflow-hidden min-h-0">
          <LogViewer
            namespace={selectedPod.namespace}
            podName={selectedPod.name}
            onClose={() => setSelectedPod(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <ResourceList
      title={t("navigation.pods")}
      data={data}
      columns={columnsWithActions}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      isWatching={isWatching}
      onStartWatch={startWatch}
      onStopWatch={stopWatchFn}
      onRowClick={(pod) => {
        setSelectedPod(null);
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
    />
  );
}
