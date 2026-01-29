"use client";

import { useResourceQuotas } from "@/lib/hooks/useK8sResources";
import { resourceQuotaColumns } from "../../../resources/columns";
import { createResourceView } from "../_createResourceView";
import type { ResourceQuotaInfo } from "@/lib/types";

export const ResourceQuotasView = createResourceView<ResourceQuotaInfo>({
  hook: useResourceQuotas,
  columns: resourceQuotaColumns,
  titleKey: "navigation.resourceQuotas",
  emptyMessageKey: "empty.resourcequotas",
  resourceType: "resourcequota",
});
