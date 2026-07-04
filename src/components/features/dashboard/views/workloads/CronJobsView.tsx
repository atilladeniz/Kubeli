"use client";

import { PlayCircle, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { useCronJobs } from "@/lib/hooks/useK8sResources";
import {
  cronJobColumns,
  type ContextMenuItemDef,
  type TranslateFunc,
} from "../../../resources/columns";
import { createResourceView } from "../_createResourceView";
import { triggerCronjob, suspendCronjob, resumeCronjob } from "@/lib/tauri/commands";
import { getErrorMessage } from "@/lib/types/errors";
import type { CronJobInfo } from "@/lib/types";

function runAction(
  action: Promise<void>,
  cronJob: CronJobInfo,
  messages: { success: string; error: string },
  refresh: () => void
): void {
  action
    .then(() => {
      toast.success(messages.success, { description: cronJob.name });
      refresh();
    })
    .catch((error) =>
      toast.error(messages.error, { description: getErrorMessage(error) })
    );
}

function cronJobActions(
  cronJob: CronJobInfo,
  refresh: () => void,
  t: TranslateFunc
): ContextMenuItemDef[] {
  const toggle: ContextMenuItemDef = cronJob.suspend
    ? {
        label: t("workloads.resume"),
        icon: <Play className="size-4" />,
        onClick: () =>
          runAction(resumeCronjob(cronJob.name, cronJob.namespace), cronJob, {
            success: t("workloads.resumeSuccess"),
            error: t("workloads.resumeError"),
          }, refresh),
      }
    : {
        label: t("workloads.suspend"),
        icon: <Pause className="size-4" />,
        onClick: () =>
          runAction(suspendCronjob(cronJob.name, cronJob.namespace), cronJob, {
            success: t("workloads.suspendSuccess"),
            error: t("workloads.suspendError"),
          }, refresh),
      };

  return [
    {
      label: t("workloads.trigger"),
      icon: <PlayCircle className="size-4" />,
      onClick: () =>
        runAction(triggerCronjob(cronJob.name, cronJob.namespace), cronJob, {
          success: t("workloads.triggerSuccess"),
          error: t("workloads.triggerError"),
        }, refresh),
    },
    toggle,
  ];
}

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
  additionalMenuItems: cronJobActions,
  copyItems: [{ label: "Copy Schedule", getValue: (cj) => cj.schedule }],
});
