"use client";

import { useIngresses } from "@/lib/hooks/useK8sResources";
import { ingressColumns } from "../../../resources/ResourceList";
import { createResourceView } from "../_createResourceView";
import type { IngressInfo } from "@/lib/types";

export const IngressesView = createResourceView<IngressInfo>({
  hook: useIngresses,
  columns: ingressColumns,
  titleKey: "navigation.ingresses",
  emptyMessageKey: "empty.ingresses",
  resourceType: "ingress",
});
