"use client";

import { FilePen, PlayCircle, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { useCronJobs } from "@/lib/hooks/useK8sResources";
import {
  cronJobColumns,
  type ContextMenuItemDef,
  type TranslateFunc,
} from "../../../resources/columns";
import { createResourceView } from "../_createResourceView";
import {
  triggerCronjob,
  suspendCronjob,
  resumeCronjob,
  getCronjobJobYaml,
} from "@/lib/tauri/commands";
import { useUIStore } from "@/lib/stores/ui-store";
import { useClusterStore } from "@/lib/stores/cluster-store";
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
    {
      label: t("workloads.editTrigger"),
      icon: <FilePen className="size-4" />,
      onClick: async () => {
        const context = useClusterStore.getState().currentCluster?.context;
        try {
          const yaml = await getCronjobJobYaml(cronJob.name, cronJob.namespace);
          // A cluster switch while the YAML was loading must not open cluster
          // A's job against cluster B.
          if (useClusterStore.getState().currentCluster?.context !== context) return;
          // Review/tweak the generated Job in the create panel before applying
          useUIStore.getState().openCreateResourceWithYaml(yaml);
        } catch (error) {
          toast.error(t("workloads.editTriggerError"), {
            description: getErrorMessage(error),
          });
        }
      },
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
