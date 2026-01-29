"use client";

import { useCSIDrivers } from "@/lib/hooks/useK8sResources";
import { csiDriverColumns } from "../../../resources/ResourceList";
import { createResourceView } from "../_createResourceView";
import type { CSIDriverInfo } from "@/lib/types";

export const CSIDriversView = createResourceView<CSIDriverInfo>({
  hook: useCSIDrivers,
  columns: csiDriverColumns,
  titleKey: "navigation.csiDrivers",
  emptyMessageKey: "empty.csidrivers",
  resourceType: "csidriver",
  namespaced: false,
});
