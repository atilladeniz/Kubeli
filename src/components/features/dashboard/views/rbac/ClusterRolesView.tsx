"use client";

import { useClusterRoles } from "@/lib/hooks/useK8sResources";
import { clusterRoleColumns } from "../../../resources/columns";
import { createResourceView } from "../_createResourceView";
import type { ClusterRoleInfo } from "@/lib/types";

export const ClusterRolesView = createResourceView<ClusterRoleInfo>({
  hook: useClusterRoles,
  columns: clusterRoleColumns,
  titleKey: "navigation.clusterRoles",
  emptyMessageKey: "empty.clusterroles",
  resourceType: "clusterrole",
  namespaced: false,
});
