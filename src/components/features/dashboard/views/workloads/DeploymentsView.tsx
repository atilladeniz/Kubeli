"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Trash2, Eye, Scale, RefreshCw, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useDeployments } from "@/lib/hooks/useK8sResources";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { useFavoritesStore } from "@/lib/stores/favorites-store";
import {
  ResourceList,
  deploymentColumns,
  translateColumns,
  type SortDirection,
  type ContextMenuItemDef,
} from "../../../resources/ResourceList";
import { useResourceDetail } from "../../context";
import type { DeploymentInfo } from "@/lib/types";

export function DeploymentsView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useDeployments({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext, handleScaleFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const { currentCluster } = useClusterStore();
  const { addFavorite, removeFavorite, isFavorite } = useFavoritesStore();
  const clusterContext = currentCluster?.context || "";

  const getDeploymentContextMenu = (dep: DeploymentInfo): ContextMenuItemDef[] => {
    const isFav = isFavorite(clusterContext, "deployments", dep.name, dep.namespace);
    return [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("deployment", dep.name, dep.namespace),
    },
    {
      label: "Scale",
      icon: <Scale className="size-4" />,
      onClick: () => handleScaleFromContext(dep.name, dep.namespace, dep.replicas, refresh),
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: isFav ? "Remove from Favorites" : "Add to Favorites",
      icon: <Star className={cn("size-4", isFav && "fill-yellow-500 text-yellow-500")} />,
      onClick: () => {
        if (isFav) {
          const favs = useFavoritesStore.getState().favorites[clusterContext] || [];
          const fav = favs.find(f => f.resourceType === "deployments" && f.name === dep.name && f.namespace === dep.namespace);
          if (fav) removeFavorite(clusterContext, fav.id);
        } else {
          addFavorite(clusterContext, "deployments", dep.name, dep.namespace);
          toast.success("Added to favorites", { description: dep.name });
        }
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(dep.name);
        toast.success("Copied to clipboard", { description: dep.name });
      },
    },
    {
      label: "Restart",
      icon: <RefreshCw className="size-4" />,
      onClick: () => toast.info("Coming soon", { description: `Restart ${dep.name}` }),
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("deployment", dep.name, dep.namespace, refresh),
      variant: "destructive",
    },
  ];
  };

  return (
    <ResourceList
      title={t("navigation.deployments")}
      data={data}
      columns={translateColumns(deploymentColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(dep) => dep.uid}
      getRowNamespace={(dep) => dep.namespace}
      emptyMessage={t("empty.deployments")}
      contextMenuItems={getDeploymentContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}
