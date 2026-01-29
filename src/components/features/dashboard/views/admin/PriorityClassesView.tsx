"use client";

import { usePriorityClasses } from "@/lib/hooks/useK8sResources";
import { priorityClassColumns } from "../../../resources/ResourceList";
import { createResourceView } from "../_createResourceView";
import type { PriorityClassInfo } from "@/lib/types";

export const PriorityClassesView = createResourceView<PriorityClassInfo>({
  hook: usePriorityClasses,
  columns: priorityClassColumns,
  titleKey: "navigation.priorityClasses",
  emptyMessageKey: "empty.priorityclasses",
  resourceType: "priorityclass",
  namespaced: false,
  defaultSortKey: "value",
  defaultSortDirection: "desc",
});
