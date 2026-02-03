"use client";

import { useTranslations } from "next-intl";
import { Cpu, HardDrive, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClusterStore } from "@/lib/stores/cluster-store";
import {
  usePods,
  useDeployments,
  useServices,
  useNodes,
} from "@/lib/hooks/useK8sResources";
import { getEffectivePodStatus } from "../../resources/columns";
import { useClusterMetrics } from "@/lib/hooks/useMetrics";
import { SummaryCard } from "../components/SummaryCard";
import { StatusRow } from "../components/StatusRow";
import { MetricsProgressBar } from "../components/MetricsProgressBar";

export function ClusterOverview() {
  const t = useTranslations();
  const { currentCluster } = useClusterStore();
  const { data: pods } = usePods();
  const { data: deployments } = useDeployments();
  const { data: services } = useServices();
  const { data: nodes } = useNodes();
  const { summary: metrics, metricsAvailable, isLoading: metricsLoading } = useClusterMetrics({
    autoRefresh: true,
    refreshInterval: 15000,
  });

  const runningPods = pods.filter((p) => getEffectivePodStatus(p) === "Running").length;
  const pendingPods = pods.filter((p) => p.phase === "Pending").length;
  const unhealthyPods = pods.filter((p) => p.phase === "Running" && getEffectivePodStatus(p) !== "Running").length;
  const failedPods = pods.filter((p) => p.phase === "Failed").length;

  const readyNodes = nodes.filter((n) => n.status === "Ready").length;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("navigation.overview")}</h1>
        <p className="text-muted-foreground">{currentCluster?.name || t("cluster.noCluster")}</p>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid grid-cols-4 gap-4">
        <SummaryCard
          title={t("navigation.nodes")}
          value={nodes.length}
          subtitle={`${readyNodes} ${t("workloads.ready").toLowerCase()}`}
          status={readyNodes === nodes.length ? "healthy" : "warning"}
        />
        <SummaryCard
          title={t("navigation.pods")}
          value={pods.length}
          subtitle={`${runningPods} ${t("pods.running").toLowerCase()}`}
          status={failedPods > 0 || unhealthyPods > 0 ? "error" : pendingPods > 0 ? "warning" : "healthy"}
        />
        <SummaryCard
          title={t("navigation.deployments")}
          value={deployments.length}
          status="healthy"
        />
        <SummaryCard
          title={t("navigation.services")}
          value={services.length}
          status="healthy"
        />
      </div>

      {/* Metrics Section */}
      {metricsAvailable && metrics && (
        <div className="mb-8 grid grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Cpu className="size-4" />
                {t("metrics.cpuUsage")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MetricsProgressBar
                percentage={metrics.cpu.percentage}
                used={metrics.cpu.usage}
                total={metrics.cpu.allocatable}
                color="blue"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <HardDrive className="size-4" />
                {t("metrics.memoryUsage")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MetricsProgressBar
                percentage={metrics.memory.percentage}
                used={metrics.memory.usage}
                total={metrics.memory.allocatable}
                color="purple"
              />
            </CardContent>
          </Card>
        </div>
      )}

      {!metricsAvailable && !metricsLoading && (
        <Card className="mb-8 border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="flex items-center gap-3 py-4">
            <Info className="size-5 text-yellow-500" />
            <div>
              <p className="text-sm font-medium">{t("metrics.metricsNotAvailable")}</p>
              <p className="text-xs text-muted-foreground">
                {t("metrics.metricsNotAvailableHint")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resource Status */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("navigation.pods")} {t("common.status")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatusRow label={t("pods.running")} value={runningPods} color="green" />
            <StatusRow label={t("pods.pending")} value={pendingPods} color="yellow" />
            <StatusRow label={t("pods.unhealthy")} value={unhealthyPods} color="red" />
            <StatusRow label={t("pods.failed")} value={failedPods} color="red" />
            <StatusRow
              label={t("pods.succeeded")}
              value={pods.filter((p) => p.phase === "Succeeded").length}
              color="blue"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("navigation.nodes")} {t("common.status")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatusRow label={t("workloads.ready")} value={readyNodes} color="green" />
            <StatusRow label={t("metrics.notReady")} value={nodes.length - readyNodes} color="red" />
          </CardContent>
        </Card>
      </div>

      {/* Top Resource Consumers */}
      {metricsAvailable && metrics && (metrics.top_cpu_pods.length > 0 || metrics.top_memory_pods.length > 0) && (
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Cpu className="size-4" />
                {t("metrics.topCpuConsumers")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {metrics.top_cpu_pods.slice(0, 5).map((pod) => (
                <div key={`${pod.namespace}/${pod.name}`} className="flex items-center justify-between text-sm">
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="truncate font-medium">{pod.name}</span>
                    <span className="text-xs text-muted-foreground">{pod.namespace}</span>
                  </div>
                  <span className="ml-2 font-mono text-muted-foreground">{pod.total_cpu}</span>
                </div>
              ))}
              {metrics.top_cpu_pods.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("metrics.noPodMetrics")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HardDrive className="size-4" />
                {t("metrics.topMemoryConsumers")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {metrics.top_memory_pods.slice(0, 5).map((pod) => (
                <div key={`${pod.namespace}/${pod.name}`} className="flex items-center justify-between text-sm">
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="truncate font-medium">{pod.name}</span>
                    <span className="text-xs text-muted-foreground">{pod.namespace}</span>
                  </div>
                  <span className="ml-2 font-mono text-muted-foreground">{pod.total_memory}</span>
                </div>
              ))}
              {metrics.top_memory_pods.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("metrics.noPodMetrics")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
