"use client";

import { useEffect, useState, useCallback, memo } from "react";
import { Cpu, HardDrive, RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { getPodMetrics } from "@/lib/tauri/commands";
import { useMetricsHistory } from "@/lib/hooks/useMetricsHistory";
import { useMetricsAvailability } from "@/lib/hooks/useMetrics";
import { MetricsChart } from "./MetricsChart";
import { formatCpuNanoCores, formatMemoryBytes } from "./PodMetricsCell";
import type { ContainerMetricsInfo } from "@/lib/types";
import { useTranslations } from "next-intl";

interface PodMetricsSectionProps {
  podName: string;
  namespace: string;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
      <Cpu className="size-4" />
      {title}
    </h3>
  );
}

export function PodMetricsSection({ podName, namespace }: PodMetricsSectionProps) {
  const t = useTranslations();
  const { isConnected } = useClusterStore();
  const { available: metricsAvailable, checking } = useMetricsAvailability();
  const history = useMetricsHistory(podName, namespace);
  const sectionTitle = t("resourceDetail.metrics");

  // One-time fetch for per-container breakdown (not available in history snapshots)
  const [containers, setContainers] = useState<ContainerMetricsInfo[] | null>(null);
  const fetchContainers = useCallback(async () => {
    if (!isConnected) return;
    try {
      const result = await getPodMetrics(namespace, podName);
      const match = result.find(
        (m) => m.name === podName && m.namespace === namespace,
      );
      if (match) setContainers(match.containers);
    } catch {
      // Silently ignore - container breakdown is supplementary
    }
  }, [isConnected, podName, namespace]);

  useEffect(() => {
    const timer = setTimeout(fetchContainers, 0);
    return () => clearTimeout(timer);
  }, [fetchContainers]);

  // Derive current values from the latest history snapshot
  const latest = history.length > 0 ? history[history.length - 1] : null;

  if (checking || (!metricsAvailable && !checking) || history.length < 1) {
    return (
      <section>
        <SectionHeader title={sectionTitle} />
        {checking ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="size-3.5 animate-spin" />
            <span>Loading metrics...</span>
          </div>
        ) : !metricsAvailable ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
            <AlertCircle className="size-3.5" />
            <span>Metrics server not available. Install metrics-server to see resource usage.</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="size-3.5 animate-spin" />
            <span>Loading metrics...</span>
          </div>
        )}
      </section>
    );
  }

  return (
    <section>
      <SectionHeader title={sectionTitle} />

      {/* Pod Total Metrics */}
      {latest && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <MetricCard
            icon={<Cpu className="size-3.5" />}
            label="CPU"
            value={formatCpuNanoCores(latest.cpuNanoCores)}
            color="blue"
          />
          <MetricCard
            icon={<HardDrive className="size-3.5" />}
            label="Memory"
            value={formatMemoryBytes(latest.memoryBytes)}
            color="purple"
          />
        </div>
      )}

      {/* Time-Series Charts */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
            <Cpu className="size-3" />
            <span>CPU over time</span>
          </div>
          <MetricsChart history={history} type="cpu" height={120} />
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
            <HardDrive className="size-3" />
            <span>Memory over time</span>
          </div>
          <MetricsChart history={history} type="memory" height={120} />
        </div>
      </div>

      {/* Per-Container Metrics */}
      {containers && containers.length > 1 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">
            {t("resourceDetail.containers")}
          </h4>
          <div className="space-y-2">
            {containers.map((container) => (
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

const MetricCard = memo(function MetricCard({
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
});

const ContainerMetricRow = memo(function ContainerMetricRow({ container }: { container: ContainerMetricsInfo }) {
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
});
