"use client";

import { useHPAs } from "@/lib/hooks/useK8sResources";
import { hpaColumns } from "../../../resources/columns";
import { createResourceView } from "../_createResourceView";
import type { HPAInfo } from "@/lib/types";

export const HPAsView = createResourceView<HPAInfo>({
  hook: useHPAs,
  columns: hpaColumns,
  titleKey: "navigation.hpa",
  emptyMessageKey: "empty.hpas",
  resourceType: "hpa",
  // The most loaded autoscalers are the ones worth looking at first
  defaultSortKey: "utilization",
  defaultSortDirection: "desc",
});
