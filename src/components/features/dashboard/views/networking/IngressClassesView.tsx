"use client";

import { useIngressClasses } from "@/lib/hooks/useK8sResources";
import { ingressClassColumns } from "../../../resources/columns";
import { createResourceView } from "../_createResourceView";
import type { IngressClassInfo } from "@/lib/types";

export const IngressClassesView = createResourceView<IngressClassInfo>({
  hook: useIngressClasses,
  columns: ingressClassColumns,
  titleKey: "navigation.ingressClasses",
  emptyMessageKey: "empty.ingressclasses",
  resourceType: "ingressclass",
  namespaced: false,
});
