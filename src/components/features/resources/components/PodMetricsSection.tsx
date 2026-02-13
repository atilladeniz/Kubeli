"use client";

import { useEffect, useState, useCallback } from "react";
import { Cpu, HardDrive, RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { getPodMetrics, checkMetricsServer } from "@/lib/tauri/commands";
import type { PodMetrics, ContainerMetricsInfo } from "@/lib/types";
import { useTranslations } from "next-intl";

interface PodMetricsSectionProps {
  podName: string;
  namespace: string;
}

export function PodMetricsSection({ podName, namespace }: PodMetricsSectionProps) {
  const t = useTranslations();
  const { isConnected } = useClusterStore();
  const [metrics, setMetrics] = useState<PodMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metricsAvailable, setMetricsAvailable] = useState(true);

  const fetchMetrics = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const available = await checkMetricsServer();
      if (!available) {
        setMetricsAvailable(false);
        setIsLoading(false);
        return;
      }
      const result = await getPodMetrics(namespace, podName);
      const match = result.find(
        (m) => m.name === podName && m.namespace === namespace
      );
      setMetrics(match || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch metrics");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, podName, namespace]);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 15000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  if (!metricsAvailable) {
    return (
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Cpu className="size-4" />
          {t("resourceDetail.metrics")}
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
          <AlertCircle className="size-3.5" />
          <span>Metrics server not available. Install metrics-server to see resource usage.</span>
        </div>
      </section>
    );
  }

  if (isLoading && !metrics) {
    return (
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Cpu className="size-4" />
          {t("resourceDetail.metrics")}
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="size-3.5 animate-spin" />
          <span>Loading metrics...</span>
        </div>
      </section>
    );
  }

  if (error || !metrics) {
    return null;
  }

  return (
    <section>
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Cpu className="size-4" />
        {t("resourceDetail.metrics")}
      </h3>

      {/* Pod Total Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <MetricCard
          icon={<Cpu className="size-3.5" />}
          label="CPU"
          value={metrics.total_cpu}
          color="blue"
        />
        <MetricCard
          icon={<HardDrive className="size-3.5" />}
          label="Memory"
          value={metrics.total_memory}
          color="purple"
        />
      </div>

      {/* Per-Container Metrics */}
      {metrics.containers.length > 1 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">
            {t("resourceDetail.containers")}
          </h4>
          <div className="space-y-2">
            {metrics.containers.map((container) => (
              <ContainerMetricRow
                key={container.name}
                container={container}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "blue" | "purple";
}) {
  const bgColor = color === "blue" ? "bg-blue-500/10" : "bg-purple-500/10";
  const textColor = color === "blue" ? "text-blue-500" : "text-purple-500";

  return (
    <div className={cn("rounded-md p-3", bgColor)}>
      <div className={cn("flex items-center gap-1.5 text-xs mb-1", textColor)}>
        {icon}
        <span className="font-medium">{label}</span>
      </div>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function ContainerMetricRow({ container }: { container: ContainerMetricsInfo }) {
  return (
    <div className="bg-muted/50 rounded-md p-2.5 text-xs">
      <div className="font-medium mb-1.5">{container.name}</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="text-muted-foreground">CPU: </span>
          <span className="font-medium tabular-nums">{container.cpu.usage}</span>
          {container.cpu.request && (
            <span className="text-muted-foreground"> / {container.cpu.request}</span>
          )}
        </div>
        <div>
          <span className="text-muted-foreground">Memory: </span>
          <span className="font-medium tabular-nums">{container.memory.usage}</span>
          {container.memory.request && (
            <span className="text-muted-foreground"> / {container.memory.request}</span>
          )}
        </div>
      </div>
    </div>
  );
}
