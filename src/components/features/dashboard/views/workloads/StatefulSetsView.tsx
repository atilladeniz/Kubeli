"use client";

import { useStatefulSets } from "@/lib/hooks/useK8sResources";
import { statefulSetColumns } from "../../../resources/columns";
import { createResourceView } from "../_createResourceView";
import type { StatefulSetInfo } from "@/lib/types";

export const StatefulSetsView = createResourceView<StatefulSetInfo>({
  hook: useStatefulSets,
  columns: statefulSetColumns,
  titleKey: "navigation.statefulSets",
  emptyMessageKey: "empty.statefulsets",
  resourceType: "statefulset",
});
