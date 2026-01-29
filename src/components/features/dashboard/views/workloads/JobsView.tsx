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
      label: "Complete",
      predicate: (job) => job.status === "Complete",
      color: "green",
    },
    {
      key: "running",
      label: "Running",
      predicate: (job) => job.status === "Running",
      color: "blue",
    },
    {
      key: "failed",
      label: "Failed",
      predicate: (job) => job.status === "Failed",
      color: "red",
    },
  ],
});
