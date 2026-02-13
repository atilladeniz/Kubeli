"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { PodMetrics, ContainerMetricsInfo } from "@/lib/types";
import { getHistorySnapshot, type MetricsSnapshot } from "@/lib/hooks/useMetricsHistory";
import { Sparkline } from "./Sparkline";

interface PodMetricsCellProps {
  podName: string;
  namespace: string;
  metricsMap: Map<string, PodMetrics>;
  type: "cpu" | "memory";
  loading?: boolean;
}

/** Format nanocores to human-readable CPU string */
export function formatCpuNanoCores(nanoCores: number): string {
  if (nanoCores >= 1_000_000_000) {
    return `${(nanoCores / 1_000_000_000).toFixed(2)}`;
  }
  const milli = nanoCores / 1_000_000;
  if (milli >= 1) {
    return `${Math.round(milli)}m`;
  }
  if (nanoCores > 0) {
    return milli >= 0.1 ? `${milli.toFixed(1)}m` : `${milli.toFixed(2)}m`;
  }
  return "0m";
}

/** Format bytes to human-readable memory string */
export function formatMemoryBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)}Gi`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)}Mi`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}Ki`;
  return `${bytes}B`;
}

interface MetricConfig {
  getValue: (m: PodMetrics) => number;
  getRequest: (containers: ContainerMetricsInfo[]) => number;
  getSparkValue: (s: MetricsSnapshot) => number;
  format: (v: number) => string;
  sparkColor: string;
  barColor: string;
}

const cpuConfig: MetricConfig = {
  getValue: (m) => m.total_cpu_nano_cores,
  getRequest: (containers) => containers.reduce((sum, c) =>
    c.cpu.request ? sum + parseCpuToMilliCores(c.cpu.request) : sum, 0),
  getSparkValue: (s) => s.cpuNanoCores,
  format: formatCpuNanoCores,
  sparkColor: "#3b82f6",
  barColor: "bg-blue-500",
};

const memoryConfig: MetricConfig = {
  getValue: (m) => m.total_memory_bytes,
  getRequest: (containers) => containers.reduce((sum, c) =>
    c.memory.request ? sum + parseMemoryToBytes(c.memory.request) : sum, 0),
  getSparkValue: (s) => s.memoryBytes,
  format: formatMemoryBytes,
  sparkColor: "#a855f7",
  barColor: "bg-purple-500",
};

export function PodMetricsCell({ podName, namespace, metricsMap, type, loading }: PodMetricsCellProps) {
  const key = `${namespace}/${podName}`;
  const metrics = metricsMap.get(key);

  if (loading) {
    return (
      <div className="flex items-center gap-2 min-w-[100px]">
        <Skeleton className="h-4 w-11 rounded" />
        <Skeleton className="h-3 w-8 rounded" />
      </div>
    );
  }

  if (!metrics) {
    return <span className="text-muted-foreground text-xs">-</span>;
  }

  return (
    <MetricCellInner
      metrics={metrics}
      historyKey={key}
      config={type === "cpu" ? cpuConfig : memoryConfig}
    />
  );
}

function MetricCellInner({
  metrics,
  historyKey,
  config,
}: {
  metrics: PodMetrics;
  historyKey: string;
  config: MetricConfig;
}) {
  const value = config.getValue(metrics);
  const usage = config === cpuConfig ? value / 1_000_000 : value;
  const totalRequest = config.getRequest(metrics.containers);
  const percentage = totalRequest > 0 ? (usage / totalRequest) * 100 : 0;
  const hasRequest = totalRequest > 0;
  const sparkValues = getHistorySnapshot(historyKey).map(config.getSparkValue);

  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      {sparkValues.length >= 2 && (
        <Sparkline values={sparkValues} color={config.sparkColor} width={44} height={16} />
      )}
      <div className="flex flex-col gap-0.5 flex-1">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium tabular-nums">
            {config.format(value)}
          </span>
          {hasRequest && (
            <span
              className={cn(
                "text-[10px] tabular-nums",
                percentage > 90
                  ? "text-destructive"
                  : percentage > 80
                    ? "text-yellow-500"
                    : "text-muted-foreground"
              )}
            >
              {percentage.toFixed(0)}%
            </span>
          )}
        </div>
        {hasRequest && (
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                percentage > 90
                  ? "bg-destructive"
                  : percentage > 80
                    ? "bg-yellow-500"
                    : config.barColor
              )}
              style={{ width: `${Math.min(100, percentage)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function parseCpuToMilliCores(value: string): number {
  const trimmed = value.trim();
  if (trimmed.endsWith("m")) {
    return parseFloat(trimmed.slice(0, -1));
  }
  if (trimmed.endsWith("n")) {
    return parseFloat(trimmed.slice(0, -1)) / 1_000_000;
  }
  return parseFloat(trimmed) * 1000;
}

function parseMemoryToBytes(value: string): number {
  const trimmed = value.trim();
  const units: Record<string, number> = {
    Ki: 1024,
    Mi: 1024 ** 2,
    Gi: 1024 ** 3,
    Ti: 1024 ** 4,
    K: 1000,
    M: 1000 ** 2,
    G: 1000 ** 3,
    T: 1000 ** 4,
  };

  for (const [suffix, multiplier] of Object.entries(units)) {
    if (trimmed.endsWith(suffix)) {
      return parseFloat(trimmed.slice(0, -suffix.length)) * multiplier;
    }
  }

  return parseFloat(trimmed);
}
