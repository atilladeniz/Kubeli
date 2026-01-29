"use client";

import { useRuntimeClasses } from "@/lib/hooks/useK8sResources";
import { runtimeClassColumns } from "../../../resources/ResourceList";
import { createResourceView } from "../_createResourceView";
import type { RuntimeClassInfo } from "@/lib/types";

export const RuntimeClassesView = createResourceView<RuntimeClassInfo>({
  hook: useRuntimeClasses,
  columns: runtimeClassColumns,
  titleKey: "navigation.runtimeClasses",
  emptyMessageKey: "empty.runtimeclasses",
  resourceType: "runtimeclass",
  namespaced: false,
});
