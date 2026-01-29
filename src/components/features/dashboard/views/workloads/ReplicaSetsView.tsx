"use client";

import { useReplicaSets } from "@/lib/hooks/useK8sResources";
import { replicaSetColumns } from "../../../resources/columns";
import { createResourceView } from "../_createResourceView";
import type { ReplicaSetInfo } from "@/lib/types";

export const ReplicaSetsView = createResourceView<ReplicaSetInfo>({
  hook: useReplicaSets,
  columns: replicaSetColumns,
  titleKey: "navigation.replicaSets",
  emptyMessageKey: "empty.replicasets",
  resourceType: "replicaset",
});
