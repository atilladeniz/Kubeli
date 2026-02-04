"use client";

import { useJobs } from "@/lib/hooks/useK8sResources";
import { jobColumns } from "../../../resources/columns";
import { createResourceView } from "../_createResourceView";
import type { JobInfo } from "@/lib/types";

export const JobsView = createResourceView<JobInfo>({
  hook: useJobs,
  columns: jobColumns,
  titleKey: "navigation.jobs",
  emptyMessageKey: "empty.jobs",
  resourceType: "job",
  filterOptions: [
    {
      key: "complete",
      label: "workloads.complete",
      predicate: (job) => job.status === "Complete",
      color: "green",
    },
    {
      key: "running",
      label: "workloads.running",
      predicate: (job) => job.status === "Running",
      color: "blue",
    },
    {
      key: "failed",
      label: "workloads.failed",
      predicate: (job) => job.status === "Failed",
      color: "red",
    },
  ],
});
