"use client";

import { useDaemonSets } from "@/lib/hooks/useK8sResources";
import { daemonSetColumns } from "../../../resources/columns";
import { createResourceView } from "../_createResourceView";
import type { DaemonSetInfo } from "@/lib/types";

export const DaemonSetsView = createResourceView<DaemonSetInfo>({
  hook: useDaemonSets,
  columns: daemonSetColumns,
  titleKey: "navigation.daemonSets",
  emptyMessageKey: "empty.daemonsets",
  resourceType: "daemonset",
});
