"use client";

import { useCRDs } from "@/lib/hooks/useK8sResources";
import { crdColumns } from "../../../resources/ResourceList";
import { createResourceView } from "../_createResourceView";
import type { CRDInfo } from "@/lib/types";

export const CRDsView = createResourceView<CRDInfo>({
  hook: useCRDs,
  columns: crdColumns,
  titleKey: "navigation.crds",
  emptyMessageKey: "empty.crds",
  resourceType: "customresourcedefinition",
  namespaced: false,
});
