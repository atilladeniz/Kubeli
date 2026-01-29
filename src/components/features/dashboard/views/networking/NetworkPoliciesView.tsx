"use client";

import { useNetworkPolicies } from "@/lib/hooks/useK8sResources";
import { networkPolicyColumns } from "../../../resources/columns";
import { createResourceView } from "../_createResourceView";
import type { NetworkPolicyInfo } from "@/lib/types";

export const NetworkPoliciesView = createResourceView<NetworkPolicyInfo>({
  hook: useNetworkPolicies,
  columns: networkPolicyColumns,
  titleKey: "navigation.networkPolicies",
  emptyMessageKey: "empty.networkpolicies",
  resourceType: "networkpolicy",
});
