"use client";

import { useClusterRoleBindings } from "@/lib/hooks/useK8sResources";
import { clusterRoleBindingColumns } from "../../../resources/ResourceList";
import { createResourceView } from "../_createResourceView";
import type { ClusterRoleBindingInfo } from "@/lib/types";

export const ClusterRoleBindingsView =
  createResourceView<ClusterRoleBindingInfo>({
    hook: useClusterRoleBindings,
    columns: clusterRoleBindingColumns,
    titleKey: "navigation.clusterRoleBindings",
    emptyMessageKey: "empty.clusterrolebindings",
    resourceType: "clusterrolebinding",
    namespaced: false,
  });
