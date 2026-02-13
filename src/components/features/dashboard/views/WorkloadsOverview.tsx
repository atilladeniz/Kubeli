"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClusterStore } from "@/lib/stores/cluster-store";
import {
  usePods,
  useDeployments,
  useReplicaSets,
  useDaemonSets,
  useStatefulSets,
  useJobs,
  useCronJobs,
} from "@/lib/hooks/useK8sResources";
import { getEffectivePodStatus } from "../../resources/columns";
import { SummaryCard } from "../components/SummaryCard";
import { StatusRow } from "../components/StatusRow";

export function WorkloadsOverview() {
  const t = useTranslations("workloads");
  const { currentNamespace } = useClusterStore();
  const { data: pods } = usePods();
  const { data: deployments } = useDeployments();
  const { data: replicaSets } = useReplicaSets();
  const { data: daemonSets } = useDaemonSets();
  const { data: statefulSets } = useStatefulSets();
  const { data: jobs } = useJobs();
  const { data: cronJobs } = useCronJobs();

  // Pod statistics - use effective status for accurate health reporting
  const runningPods = pods.filter((p) => getEffectivePodStatus(p) === "Running").length;
  const pendingPods = pods.filter((p) => p.phase === "Pending").length;
  const unhealthyPods = pods.filter((p) => p.phase === "Running" && getEffectivePodStatus(p) !== "Running").length;
  const failedPods = pods.filter((p) => p.phase === "Failed").length;
  const succeededPods = pods.filter((p) => p.phase === "Succeeded").length;

  // Deployment statistics
  const healthyDeployments = deployments.filter((d) => d.ready_replicas === d.replicas && d.replicas > 0).length;
  const degradedDeployments = deployments.filter((d) => d.ready_replicas < d.replicas && d.ready_replicas > 0).length;
  const failedDeployments = deployments.filter((d) => d.ready_replicas === 0 && d.replicas > 0).length;

  // DaemonSet statistics
  const healthyDaemonSets = daemonSets.filter((ds) => ds.number_ready === ds.desired_number_scheduled).length;

  // StatefulSet statistics
  const healthyStatefulSets = statefulSets.filter((sts) => sts.ready_replicas === sts.replicas && sts.replicas > 0).length;

  // Job statistics
  const completedJobs = jobs.filter((j) => j.status === "Complete").length;
  const runningJobs = jobs.filter((j) => j.status === "Running").length;
  const failedJobs = jobs.filter((j) => j.status === "Failed").length;

  // CronJob statistics
  const activeCronJobs = cronJobs.filter((cj) => !cj.suspend).length;
  const suspendedCronJobs = cronJobs.filter((cj) => cj.suspend).length;

  return (
    <div className="@container h-full overflow-auto p-4 @2xl:p-6">
      <div className="mb-4 @2xl:mb-6">
        <h1 className="text-2xl font-bold">{t("overview")}</h1>
        <p className="text-muted-foreground">
          {currentNamespace ? t("namespaceLabel", { namespace: currentNamespace }) : t("allNamespaces")}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 @2xl:mb-8 grid grid-cols-2 @3xl:grid-cols-4 gap-3 @2xl:gap-4">
        <SummaryCard
          title={t("pods")}
          value={pods.length}
          subtitle={t("countRunning", { count: runningPods })}
          status={failedPods > 0 || unhealthyPods > 0 ? "error" : pendingPods > 0 ? "warning" : "healthy"}
        />
        <SummaryCard
          title={t("deployments")}
          value={deployments.length}
          subtitle={t("countHealthy", { count: healthyDeployments })}
          status={failedDeployments > 0 ? "error" : degradedDeployments > 0 ? "warning" : "healthy"}
        />
        <SummaryCard
          title={t("statefulsets")}
          value={statefulSets.length}
          subtitle={t("countHealthy", { count: healthyStatefulSets })}
          status={healthyStatefulSets === statefulSets.length ? "healthy" : "warning"}
        />
        <SummaryCard
          title={t("daemonsets")}
          value={daemonSets.length}
          subtitle={t("countHealthy", { count: healthyDaemonSets })}
          status={healthyDaemonSets === daemonSets.length ? "healthy" : "warning"}
        />
      </div>

      {/* Detailed Status */}
      <div className="grid grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-3 gap-4 @2xl:gap-6 mb-6 @2xl:mb-8">
        {/* Pod Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("podStatus")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatusRow label={t("running")} value={runningPods} color="green" />
            <StatusRow label={t("pending")} value={pendingPods} color="yellow" />
            <StatusRow label={t("unhealthy")} value={unhealthyPods} color="red" />
            <StatusRow label={t("failed")} value={failedPods} color="red" />
            <StatusRow label={t("succeeded")} value={succeededPods} color="blue" />
          </CardContent>
        </Card>

        {/* Deployment Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("deploymentStatus")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatusRow label={t("healthy")} value={healthyDeployments} color="green" />
            <StatusRow label={t("degraded")} value={degradedDeployments} color="yellow" />
            <StatusRow label={t("failed")} value={failedDeployments} color="red" />
          </CardContent>
        </Card>

        {/* Job Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("jobStatus")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatusRow label={t("complete")} value={completedJobs} color="green" />
            <StatusRow label={t("running")} value={runningJobs} color="blue" />
            <StatusRow label={t("failed")} value={failedJobs} color="red" />
          </CardContent>
        </Card>
      </div>

      {/* Secondary Resources */}
      <div className="grid grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-3 gap-4 @2xl:gap-6">
        {/* ReplicaSets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("replicasets")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{replicaSets.length}</div>
            <p className="text-sm text-muted-foreground">
              {t("fullyReady", { count: replicaSets.filter((rs) => rs.ready_replicas === rs.replicas).length })}
            </p>
          </CardContent>
        </Card>

        {/* CronJobs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("cronjobs")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatusRow label={t("active")} value={activeCronJobs} color="green" />
            <StatusRow label={t("suspended")} value={suspendedCronJobs} color="yellow" />
          </CardContent>
        </Card>

        {/* Total Workloads */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("totalWorkloads")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {deployments.length + statefulSets.length + daemonSets.length + jobs.length + cronJobs.length}
            </div>
            <p className="text-sm text-muted-foreground">
              {t("acrossAllTypes")}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
