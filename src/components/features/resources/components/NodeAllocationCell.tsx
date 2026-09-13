"use client";

import { cn } from "@/lib/utils";
import type { NodeInfo } from "@/lib/types";

/** Above this share of allocatable the bar turns red */
const CRITICAL_PERCENT = 90;
/** Above this share of allocatable the bar turns yellow */
const WARNING_PERCENT = 75;

export type AllocationKind = "pods" | "cpu" | "memory";

/** Millicores as the cluster writes them: "1.5" for whole cores, else "750m" */
export function formatMilliCores(milli: number): string {
  if (milli >= 1000) {
    const cores = milli / 1000;
    return Number.isInteger(cores) ? `${cores}` : cores.toFixed(2);
  }
  return `${milli}m`;
}

/** Bytes in the binary units Kubernetes quantities use */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 4) return `${(bytes / 1024 ** 4).toFixed(2)}Ti`;
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)}Gi`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)}Mi`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}Ki`;
  return `${bytes}B`;
}

interface Allocation {
  used: number;
  total: number;
  label: string;
  barColor: string;
}

/**
 * Reads the used/allocatable pair for one kind off the node.
 *
 * Requests are what the scheduler goes by, so this is how full a node is for
 * scheduling purposes, not how busy it is - that is what the metrics server
 * answers, and it may not be installed.
 */
export function nodeAllocation(node: NodeInfo, kind: AllocationKind): Allocation {
  switch (kind) {
    case "pods":
      return {
        used: node.pods_scheduled,
        total: node.pods_allocatable ?? 0,
        label: `${node.pods_scheduled} / ${node.pods_allocatable ?? "?"}`,
        barColor: "bg-emerald-500",
      };
    case "cpu":
      return {
        used: node.cpu_requests_milli,
        total: node.cpu_allocatable_milli,
        label: `${formatMilliCores(node.cpu_requests_milli)} / ${formatMilliCores(node.cpu_allocatable_milli)}`,
        barColor: "bg-blue-500",
      };
    case "memory":
      return {
        used: node.memory_requests_bytes,
        total: node.memory_allocatable_bytes,
        label: `${formatBytes(node.memory_requests_bytes)} / ${formatBytes(node.memory_allocatable_bytes)}`,
        barColor: "bg-purple-500",
      };
  }
}

export function NodeAllocationCell({ node, kind }: { node: NodeInfo; kind: AllocationKind }) {
  const { used, total, label, barColor } = nodeAllocation(node, kind);

  // No allocatable value means the node never reported one, or the pod list
  // was not readable. A bar against an unknown total would be a lie.
  if (total <= 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  const percentage = (used / total) * 100;
  const critical = percentage > CRITICAL_PERCENT;
  const warning = !critical && percentage > WARNING_PERCENT;

  return (
    <div className="flex flex-col gap-0.5 min-w-[110px]" data-testid={`node-${kind}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="tabular-nums text-xs">{label}</span>
        <span
          className={cn(
            "tabular-nums text-xs",
            critical ? "text-destructive" : warning ? "text-yellow-500" : "text-muted-foreground"
          )}
        >
          {percentage.toFixed(0)}%
        </span>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            critical ? "bg-destructive" : warning ? "bg-yellow-500" : barColor
          )}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
    </div>
  );
}
