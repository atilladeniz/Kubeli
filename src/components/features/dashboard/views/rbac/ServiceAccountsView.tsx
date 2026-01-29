"use client";

import { useServiceAccounts } from "@/lib/hooks/useK8sResources";
import { serviceAccountColumns } from "../../../resources/columns";
import { createResourceView } from "../_createResourceView";
import type { ServiceAccountInfo } from "@/lib/types";

export const ServiceAccountsView = createResourceView<ServiceAccountInfo>({
  hook: useServiceAccounts,
  columns: serviceAccountColumns,
  titleKey: "navigation.serviceAccounts",
  emptyMessageKey: "empty.serviceaccounts",
  resourceType: "serviceaccount",
});
