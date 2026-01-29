"use client";

import { usePersistentVolumes } from "@/lib/hooks/useK8sResources";
import { pvColumns } from "../../../resources/columns";
import { createResourceView } from "../_createResourceView";
import type { PVInfo } from "@/lib/types";

export const PersistentVolumesView = createResourceView<PVInfo>({
  hook: usePersistentVolumes,
  columns: pvColumns,
  titleKey: "navigation.persistentVolumes",
  emptyMessageKey: "empty.pvs",
  resourceType: "persistentvolume",
  namespaced: false,
});
