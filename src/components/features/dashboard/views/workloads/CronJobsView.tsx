"use client";

import { useCronJobs } from "@/lib/hooks/useK8sResources";
import { cronJobColumns } from "../../../resources/columns";
import { createResourceView } from "../_createResourceView";
import type { CronJobInfo } from "@/lib/types";

export const CronJobsView = createResourceView<CronJobInfo>({
  hook: useCronJobs,
  columns: cronJobColumns,
  titleKey: "navigation.cronJobs",
  emptyMessageKey: "empty.cronjobs",
  resourceType: "cronjob",
  filterOptions: [
    {
      key: "active",
      label: "workloads.active",
      predicate: (cj) => !cj.suspend,
      color: "green",
    },
    {
      key: "suspended",
      label: "workloads.suspended",
      predicate: (cj) => cj.suspend,
      color: "yellow",
    },
  ],
  copyItems: [{ label: "Copy Schedule", getValue: (cj) => cj.schedule }],
});
