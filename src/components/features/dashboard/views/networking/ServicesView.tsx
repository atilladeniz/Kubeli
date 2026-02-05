"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRightLeft, Copy, Trash2, Eye, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useServices } from "@/lib/hooks/useK8sResources";
import { usePortForward } from "@/lib/hooks/usePortForward";
import { useRefreshOnDelete } from "@/lib/hooks/useRefreshOnDelete";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { useFavoritesStore } from "@/lib/stores/favorites-store";
import { ResourceList } from "../../../resources/ResourceList";
import {
  serviceColumns,
  translateColumns,
  type SortDirection,
  type ContextMenuItemDef,
} from "../../../resources/columns";
import { useResourceDetail } from "../../context";
import type { ServiceInfo } from "@/lib/types";

export function ServicesView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useServices({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { forwards, startForward, stopForward } = usePortForward();
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const { currentCluster } = useClusterStore();
  const { addFavorite, removeFavorite, isFavorite } = useFavoritesStore();
  const clusterContext = currentCluster?.context || "";

  // Refresh when a resource is deleted from detail panel
  useRefreshOnDelete(refresh);

  // Check if a service is currently being forwarded
  const getForwardForService = (svc: ServiceInfo) => {
    return forwards.find(
      (f) =>
        f.name === svc.name &&
        f.namespace === svc.namespace &&
        f.target_type === "service"
    );
  };

  const handlePortForward = (svc: ServiceInfo) => {
    if (svc.ports.length > 0) {
      const port = svc.ports[0];
      startForward(svc.namespace, svc.name, "service", port.port);
    }
  };

  const handleDisconnect = (svc: ServiceInfo) => {
    const forward = getForwardForService(svc);
    if (forward) {
      stopForward(forward.forward_id);
    }
  };

  // Get row class for highlighting forwarded services
  const getRowClassName = (svc: ServiceInfo): string => {
    const forward = getForwardForService(svc);
    if (forward) {
      return "bg-purple-500/10 hover:bg-purple-500/15";
    }
    return "";
  };

  // Add port forward action column
  const columnsWithActions = [
    ...translateColumns(serviceColumns, t),
    {
      key: "actions",
      label: "Actions",
      render: (svc: ServiceInfo) => {
        const forward = getForwardForService(svc);
        const isForwarded = !!forward;

        return (
          <div className="flex items-center gap-1">
            {svc.ports.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isForwarded) {
                    handleDisconnect(svc);
                  } else {
                    handlePortForward(svc);
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

  const getServiceContextMenu = (svc: ServiceInfo): ContextMenuItemDef[] => {
    const forward = getForwardForService(svc);
    const isForwarded = !!forward;
    const isFav = isFavorite(clusterContext, "services", svc.name, svc.namespace);

    return [
      {
        label: "View Details",
        icon: <Eye className="size-4" />,
        onClick: () => openResourceDetail("service", svc.name, svc.namespace),
      },
      {
        label: isForwarded ? "Stop Port Forward" : "Port Forward",
        icon: <ArrowRightLeft className="size-4" />,
        onClick: () => (isForwarded ? handleDisconnect(svc) : handlePortForward(svc)),
        disabled: svc.ports.length === 0,
      },
      { separator: true, label: "", onClick: () => {} },
      {
        label: isFav ? "Remove from Favorites" : "Add to Favorites",
        icon: <Star className={cn("size-4", isFav && "fill-yellow-500 text-yellow-500")} />,
        onClick: () => {
          if (isFav) {
            const favs = useFavoritesStore.getState().favorites[clusterContext] || [];
            const fav = favs.find(f => f.resourceType === "services" && f.name === svc.name && f.namespace === svc.namespace);
            if (fav) removeFavorite(clusterContext, fav.id);
          } else {
            addFavorite(clusterContext, "services", svc.name, svc.namespace);
            toast.success("Added to favorites", { description: svc.name });
          }
        },
      },
      { separator: true, label: "", onClick: () => {} },
      {
        label: "Copy Name",
        icon: <Copy className="size-4" />,
        onClick: () => {
          navigator.clipboard.writeText(svc.name);
          toast.success("Copied to clipboard", { description: svc.name });
        },
      },
      {
        label: "Copy Cluster IP",
        icon: <Copy className="size-4" />,
        onClick: () => {
          navigator.clipboard.writeText(svc.cluster_ip || "");
          toast.success("Copied to clipboard", { description: svc.cluster_ip });
        },
        disabled: !svc.cluster_ip,
      },
      { separator: true, label: "", onClick: () => {} },
      {
        label: "Delete",
        icon: <Trash2 className="size-4" />,
        onClick: () => handleDeleteFromContext("service", svc.name, svc.namespace, refresh),
        variant: "destructive",
      },
    ];
  };

  return (
    <ResourceList
      title={t("navigation.services")}
      data={data}
      columns={columnsWithActions}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(svc) => svc.uid}
      getRowClassName={getRowClassName}
      getRowNamespace={(svc) => svc.namespace}
      emptyMessage={t("empty.services")}
      contextMenuItems={getServiceContextMenu}
      onRowClick={(svc) => openResourceDetail("service", svc.name, svc.namespace)}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}
