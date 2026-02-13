"use client";

import { cn } from "@/lib/utils";
import type { PodMetrics } from "@/lib/types";

interface PodMetricsCellProps {
  podName: string;
  namespace: string;
  metricsMap: Map<string, PodMetrics>;
  type: "cpu" | "memory";
}

export function PodMetricsCell({
  podName,
  namespace,
  metricsMap,
  type,
}: PodMetricsCellProps) {
  const key = `${namespace}/${podName}`;
  const metrics = metricsMap.get(key);

  if (!metrics) {
    return <span className="text-muted-foreground text-xs">-</span>;
  }

  if (type === "cpu") {
    return <CpuCell metrics={metrics} />;
  }

  return <MemoryCell metrics={metrics} />;
}

function CpuCell({ metrics }: { metrics: PodMetrics }) {
  const nanoCores = metrics.total_cpu_nano_cores;
  const milliCores = nanoCores / 1_000_000;

  // Find total request/limit from containers
  const totalRequest = metrics.containers.reduce((sum, c) => {
    if (c.cpu.request) return sum + parseCpuToMilliCores(c.cpu.request);
    return sum;
  }, 0);

  const percentage = totalRequest > 0 ? (milliCores / totalRequest) * 100 : 0;
  const hasRequest = totalRequest > 0;

  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex flex-col gap-0.5 flex-1">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium tabular-nums">
            {metrics.total_cpu}
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
                    : "bg-blue-500"
              )}
              style={{ width: `${Math.min(100, percentage)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function MemoryCell({ metrics }: { metrics: PodMetrics }) {
  const usageBytes = metrics.total_memory_bytes;

  // Find total request from containers
  const totalRequest = metrics.containers.reduce((sum, c) => {
    if (c.memory.request) return sum + parseMemoryToBytes(c.memory.request);
    return sum;
  }, 0);

  const percentage = totalRequest > 0 ? (usageBytes / totalRequest) * 100 : 0;
  const hasRequest = totalRequest > 0;

  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex flex-col gap-0.5 flex-1">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium tabular-nums">
            {metrics.total_memory}
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
                    : "bg-purple-500"
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
