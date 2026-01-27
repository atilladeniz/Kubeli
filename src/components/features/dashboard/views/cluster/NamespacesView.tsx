"use client";

import { useNamespaces } from "@/lib/hooks/useK8sResources";
import { namespaceColumns } from "../../../resources/ResourceList";
import { createResourceView } from "../_createResourceView";
import type { NamespaceInfo } from "@/lib/types";

export const NamespacesView = createResourceView<NamespaceInfo>({
  hook: useNamespaces,
  columns: namespaceColumns,
  titleKey: "navigation.namespaces",
  emptyMessageKey: "empty.namespaces",
  resourceType: "namespace",
  namespaced: false,
  hideDelete: true, // Namespaces shouldn't be easily deleted
});
