"use client";

import { usePersistentVolumeClaims } from "@/lib/hooks/useK8sResources";
import { pvcColumns } from "../../../resources/columns";
import { createResourceView } from "../_createResourceView";
import type { PVCInfo } from "@/lib/types";

export const PersistentVolumeClaimsView = createResourceView<PVCInfo>({
  hook: usePersistentVolumeClaims,
  columns: pvcColumns,
  titleKey: "navigation.persistentVolumeClaims",
  emptyMessageKey: "empty.pvcs",
  resourceType: "persistentvolumeclaim",
});
