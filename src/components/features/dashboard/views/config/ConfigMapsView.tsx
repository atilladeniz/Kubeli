"use client";

import { useConfigMaps } from "@/lib/hooks/useK8sResources";
import { configMapColumns } from "../../../resources/columns";
import { createResourceView } from "../_createResourceView";
import type { ConfigMapInfo } from "@/lib/types";

export const ConfigMapsView = createResourceView<ConfigMapInfo>({
  hook: useConfigMaps,
  columns: configMapColumns,
  titleKey: "navigation.configMaps",
  emptyMessageKey: "empty.configmaps",
  resourceType: "configmap",
});
