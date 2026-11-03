import type {
  PodInfo,
  PodMetrics,
  DeploymentInfo,
  ReplicaSetInfo,
  DaemonSetInfo,
  StatefulSetInfo,
  JobInfo,
  CronJobInfo,
} from "@/lib/types";
import type { Column, TranslateFunc } from "../types";
import { cn } from "@/lib/utils";
import { NamespaceColorDot } from "../components/NamespaceColorDot";
import { PodPhaseBadge } from "../components/badges/PodPhaseBadge";
import { JobStatusBadge } from "../components/badges/JobStatusBadge";
import { CronJobSuspendBadge } from "../components/badges/CronJobSuspendBadge";
import { PodMetricsCell } from "../components/PodMetricsCell";
import { formatAge, formatDuration } from "../lib/utils";
import { getEffectivePodStatus } from "@/lib/utils/pod-status";

// Re-export for backwards compatibility
export { getEffectivePodStatus } from "@/lib/utils/pod-status";

function parseReadyContainersPercent(readyStr: string): number {
  const [readyRaw, totalRaw] = readyStr.split("/");
  const ready = Number(readyRaw);
  const total = Number(totalRaw);
  if (!total || isNaN(ready) || isNaN(total)) return 0;
  return (ready / total) * 100;
}

function replicaReadyPercent(ready: number, total: number): number {
  if (total <= 0) return 100;
  return (ready / total) * 100;
}

// Pod columns
export const podColumns: Column<PodInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    width: "w-[22rem]",
    render: (pod) => (
      <span className="font-medium">{pod.name}</span>
    ),
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    width: "w-40",
    render: (pod) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={pod.namespace} />
        <span className="truncate">{pod.namespace}</span>
      </div>
    ),
  },
  {
    key: "ready_containers",
    label: "READY",
    sortable: true,
    width: "w-20",
    sortValue: (pod) => parseReadyContainersPercent(pod.ready_containers),
    render: (pod) => (
      <span
        className={cn(
          pod.ready_containers.startsWith("0/") && "text-yellow-500"
        )}
      >
        {pod.ready_containers}
      </span>
    ),
  },
  {
    key: "phase",
    label: "STATUS",
    sortable: true,
    width: "w-44",
    noTruncate: true,
    render: (pod) => <PodPhaseBadge phase={getEffectivePodStatus(pod)} />,
  },
  {
    key: "restart_count",
    label: "RESTARTS",
    sortable: true,
    width: "w-24",
    render: (pod) => (
      <span className={cn(pod.restart_count > 0 && "text-yellow-500")}>
        {pod.restart_count}
      </span>
    ),
  },
  { key: "node_name", label: "NODE", sortable: true, width: "w-28" },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    width: "w-20",
    render: (pod) => (pod.created_at ? formatAge(pod.created_at) : "-"),
  },
];

/** Creates pod columns with CPU/Memory metrics columns injected */
export function getPodColumnsWithMetrics(
  metricsMap: Map<string, PodMetrics>,
  metricsLoading = false,
): Column<PodInfo>[] {
  return [
    ...podColumns,
    {
      key: "cpu_usage",
      label: "CPU",
      sortable: true,
      width: "w-32",
      noTruncate: true,
      render: (pod) => (
        <PodMetricsCell
          podName={pod.name}
          namespace={pod.namespace}
          metricsMap={metricsMap}
          type="cpu"
          loading={metricsLoading}
        />
      ),
    },
    {
      key: "memory_usage",
      label: "MEMORY",
      sortable: true,
      width: "w-32",
      noTruncate: true,
      render: (pod) => (
        <PodMetricsCell
          podName={pod.name}
          namespace={pod.namespace}
          metricsMap={metricsMap}
          type="memory"
          loading={metricsLoading}
        />
      ),
    },
  ];
}

export function getPodColumns(t: TranslateFunc): Column<PodInfo>[] {
  return [
    {
      key: "name",
      label: t("columns.name"),
      sortable: true,
      width: "w-[22rem]",
      render: (pod) => <span className="font-medium">{pod.name}</span>,
    },
    {
      key: "namespace",
      label: t("columns.namespace"),
      sortable: true,
      width: "w-40",
      render: (pod) => (
        <div className="flex items-center gap-2">
          <NamespaceColorDot namespace={pod.namespace} />
          <span className="truncate">{pod.namespace}</span>
        </div>
      ),
    },
    {
      key: "ready_containers",
      label: t("columns.ready"),
      sortable: true,
      width: "w-20",
      sortValue: (pod) => parseReadyContainersPercent(pod.ready_containers),
      render: (pod) => (
        <span className={cn(pod.ready_containers.startsWith("0/") && "text-yellow-500")}>
          {pod.ready_containers}
        </span>
      ),
    },
    {
      key: "phase",
      label: t("columns.status"),
      sortable: true,
      width: "w-44",
      noTruncate: true,
      render: (pod) => (
        <PodPhaseBadge
          phase={pod.deletion_timestamp ? "Terminating" : pod.phase}
        />
      ),
    },
    {
      key: "restart_count",
      label: t("columns.restarts"),
      sortable: true,
      width: "w-24",
      render: (pod) => (
        <span className={cn(pod.restart_count > 0 && "text-yellow-500")}>{pod.restart_count}</span>
      ),
    },
    { key: "node_name", label: t("columns.node"), sortable: true, width: "w-28" },
    {
      key: "created_at",
      label: t("columns.age"),
      sortable: true,
      width: "w-20",
      render: (pod) => (pod.created_at ? formatAge(pod.created_at) : "-"),
    },
  ];
}

// Deployment columns
export const deploymentColumns: Column<DeploymentInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    width: "w-[22rem]",
    render: (dep) => <span className="font-medium">{dep.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    width: "w-44",
    render: (dep) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={dep.namespace} />
        <span className="truncate">{dep.namespace}</span>
      </div>
    ),
  },
  {
    key: "ready_replicas",
    label: "READY",
    sortable: true,
    width: "w-24",
    sortValue: (dep) => replicaReadyPercent(dep.ready_replicas, dep.replicas),
    render: (dep) => (
      <span
        className={cn(
          dep.ready_replicas < dep.replicas
            ? "text-yellow-500"
            : "text-green-500"
        )}
      >
        {dep.ready_replicas}/{dep.replicas}
      </span>
    ),
  },
  {
    key: "available_replicas",
    label: "AVAILABLE",
    sortable: true,
    width: "w-28",
    render: (dep) => dep.available_replicas,
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    width: "w-24",
    render: (dep) => (dep.created_at ? formatAge(dep.created_at) : "-"),
  },
];

export function getDeploymentColumns(t: TranslateFunc): Column<DeploymentInfo>[] {
  return [
    {
      key: "name",
      label: t("columns.name"),
      sortable: true,
      width: "w-[22rem]",
      render: (dep) => <span className="font-medium">{dep.name}</span>,
    },
    {
      key: "namespace",
      label: t("columns.namespace"),
      sortable: true,
      width: "w-44",
      render: (dep) => (
        <div className="flex items-center gap-2">
          <NamespaceColorDot namespace={dep.namespace} />
          <span className="truncate">{dep.namespace}</span>
        </div>
      ),
    },
    {
      key: "ready_replicas",
      label: t("columns.ready"),
      sortable: true,
      width: "w-24",
      sortValue: (dep) => replicaReadyPercent(dep.ready_replicas, dep.replicas),
      render: (dep) => (
        <span className={cn(dep.ready_replicas < dep.replicas ? "text-yellow-500" : "text-green-500")}>
          {dep.ready_replicas}/{dep.replicas}
        </span>
      ),
    },
    {
      key: "available_replicas",
      label: t("columns.available"),
      sortable: true,
      width: "w-28",
      render: (dep) => dep.available_replicas,
    },
    {
      key: "created_at",
      label: t("columns.age"),
      sortable: true,
      width: "w-24",
      render: (dep) => (dep.created_at ? formatAge(dep.created_at) : "-"),
    },
  ];
}

// ReplicaSet columns
export const replicaSetColumns: Column<ReplicaSetInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    width: "w-[24rem]",
    render: (rs) => <span className="font-medium">{rs.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    width: "w-44",
    render: (rs) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={rs.namespace} />
        <span className="truncate">{rs.namespace}</span>
      </div>
    ),
  },
  {
    key: "ready_replicas",
    label: "READY",
    sortable: true,
    width: "w-24",
    sortValue: (rs) => replicaReadyPercent(rs.ready_replicas, rs.replicas),
    render: (rs) => (
      <span
        className={cn(
          rs.ready_replicas < rs.replicas
            ? "text-yellow-500"
            : "text-green-500"
        )}
      >
        {rs.ready_replicas}/{rs.replicas}
      </span>
    ),
  },
  {
    key: "available_replicas",
    label: "AVAILABLE",
    sortable: true,
    width: "w-28",
    render: (rs) => rs.available_replicas,
  },
  {
    key: "owner_name",
    label: "OWNER",
    sortable: true,
    width: "w-56",
    render: (rs) => (
      <div className="flex flex-col">
        <span className="text-muted-foreground">{rs.owner_kind || "-"}</span>
        <span className="truncate">{rs.owner_name || "-"}</span>
      </div>
    ),
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    width: "w-24",
    render: (rs) => (rs.created_at ? formatAge(rs.created_at) : "-"),
  },
];

// DaemonSet columns
export const daemonSetColumns: Column<DaemonSetInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    width: "w-[20rem]",
    render: (ds) => <span className="font-medium">{ds.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    width: "w-44",
    render: (ds) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={ds.namespace} />
        <span className="truncate">{ds.namespace}</span>
      </div>
    ),
  },
  {
    key: "desired_number_scheduled",
    label: "DESIRED",
    sortable: true,
    width: "w-24",
    render: (ds) => ds.desired_number_scheduled,
  },
  {
    key: "current_number_scheduled",
    label: "CURRENT",
    sortable: true,
    width: "w-24",
    render: (ds) => ds.current_number_scheduled,
  },
  {
    key: "number_ready",
    label: "READY",
    sortable: true,
    width: "w-24",
    sortValue: (ds) =>
      replicaReadyPercent(ds.number_ready, ds.desired_number_scheduled),
    render: (ds) => (
      <span
        className={cn(
          ds.number_ready < ds.desired_number_scheduled
            ? "text-yellow-500"
            : "text-green-500"
        )}
      >
        {ds.number_ready}
      </span>
    ),
  },
  {
    key: "number_available",
    label: "AVAILABLE",
    sortable: true,
    width: "w-28",
    render: (ds) => ds.number_available,
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    width: "w-24",
    render: (ds) => (ds.created_at ? formatAge(ds.created_at) : "-"),
  },
];

// StatefulSet columns
export const statefulSetColumns: Column<StatefulSetInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    width: "w-[20rem]",
    render: (sts) => <span className="font-medium">{sts.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    width: "w-44",
    render: (sts) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={sts.namespace} />
        <span className="truncate">{sts.namespace}</span>
      </div>
    ),
  },
  {
    key: "ready_replicas",
    label: "READY",
    sortable: true,
    width: "w-24",
    sortValue: (sts) => replicaReadyPercent(sts.ready_replicas, sts.replicas),
    render: (sts) => (
      <span
        className={cn(
          sts.ready_replicas < sts.replicas
            ? "text-yellow-500"
            : "text-green-500"
        )}
      >
        {sts.ready_replicas}/{sts.replicas}
      </span>
    ),
  },
  {
    key: "current_replicas",
    label: "CURRENT",
    sortable: true,
    width: "w-24",
    render: (sts) => sts.current_replicas,
  },
  {
    key: "service_name",
    label: "SERVICE",
    sortable: true,
    width: "w-44",
    render: (sts) => sts.service_name || "-",
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    width: "w-24",
    render: (sts) => (sts.created_at ? formatAge(sts.created_at) : "-"),
  },
];

// Job columns
export const jobColumns: Column<JobInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    width: "w-[22rem]",
    render: (job) => <span className="font-medium">{job.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    width: "w-44",
    render: (job) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={job.namespace} />
        <span className="truncate">{job.namespace}</span>
      </div>
    ),
  },
  {
    key: "status",
    label: "STATUS",
    sortable: true,
    width: "w-32",
    noTruncate: true,
    render: (job) => <JobStatusBadge status={job.status} />,
  },
  {
    key: "completions",
    label: "COMPLETIONS",
    sortable: true,
    width: "w-32",
    sortValue: (job) => replicaReadyPercent(job.succeeded, job.completions ?? 1),
    render: (job) => (
      <span>
        {job.succeeded}/{job.completions ?? 1}
      </span>
    ),
  },
  {
    key: "duration_seconds",
    label: "DURATION",
    sortable: true,
    width: "w-28",
    render: (job) => (job.duration_seconds ? formatDuration(job.duration_seconds) : "-"),
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    width: "w-24",
    render: (job) => (job.created_at ? formatAge(job.created_at) : "-"),
  },
];

// CronJob columns
export const cronJobColumns: Column<CronJobInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    width: "w-[22rem]",
    render: (cj) => <span className="font-medium">{cj.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    width: "w-44",
    render: (cj) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={cj.namespace} />
        <span className="truncate">{cj.namespace}</span>
      </div>
    ),
  },
  {
    key: "schedule",
    label: "SCHEDULE",
    sortable: true,
    width: "w-36",
    render: (cj) => (
      <code className="text-sm bg-muted px-1.5 py-0.5 rounded">{cj.schedule}</code>
    ),
  },
  {
    key: "suspend",
    label: "STATUS",
    sortable: true,
    width: "w-28",
    noTruncate: true,
    render: (cj) => <CronJobSuspendBadge suspend={cj.suspend} />,
  },
  {
    key: "active_jobs",
    label: "ACTIVE JOBS",
    sortable: true,
    width: "w-28",
    render: (cj) => cj.active_jobs,
  },
  {
    key: "last_schedule_time",
    label: "LAST SCHEDULE",
    sortable: true,
    width: "w-32",
    render: (cj) => (cj.last_schedule_time ? formatAge(cj.last_schedule_time) : "-"),
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    width: "w-24",
    render: (cj) => (cj.created_at ? formatAge(cj.created_at) : "-"),
  },
];
