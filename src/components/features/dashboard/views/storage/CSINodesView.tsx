"use client";

import { useCSINodes } from "@/lib/hooks/useK8sResources";
import { csiNodeColumns } from "../../../resources/ResourceList";
import { createResourceView } from "../_createResourceView";
import type { CSINodeInfo } from "@/lib/types";

export const CSINodesView = createResourceView<CSINodeInfo>({
  hook: useCSINodes,
  columns: csiNodeColumns,
  titleKey: "navigation.csiNodes",
  emptyMessageKey: "empty.csinodes",
  resourceType: "csinode",
  namespaced: false,
});
