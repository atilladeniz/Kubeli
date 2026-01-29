"use client";

import { useHPAs } from "@/lib/hooks/useK8sResources";
import { hpaColumns } from "../../../resources/ResourceList";
import { createResourceView } from "../_createResourceView";
import type { HPAInfo } from "@/lib/types";

export const HPAsView = createResourceView<HPAInfo>({
  hook: useHPAs,
  columns: hpaColumns,
  titleKey: "navigation.hpa",
  emptyMessageKey: "empty.hpas",
  resourceType: "hpa",
});
