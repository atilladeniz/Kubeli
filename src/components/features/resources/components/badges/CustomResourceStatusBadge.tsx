"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type StatusBadgeTone, getStatusBadgeToneClass } from "./statusBadgeStyles";

const statusToneMap: Record<string, StatusBadgeTone> = {
  // Positive / healthy
  Ready: "success",
  Established: "success",
  Available: "success",
  Healthy: "success",
  Synced: "success",
  Reconciled: "success",
  Running: "success",
  Active: "success",
  Bound: "success",
  Complete: "success",
  Succeeded: "success",
  True: "success",

  // In progress
  Pending: "info",
  Reconciling: "info",
  Progressing: "info",
  Creating: "info",

  // Warnings
  Degraded: "warning",
  Suspended: "warning",
  Unknown: "warning",
  NotReady: "warning",
  Stalled: "warning",

  // Failures
  Failed: "danger",
  Error: "danger",
  CrashLoopBackOff: "danger",
  False: "danger",
  DependencyNotReady: "danger",
};

function getTone(status: string): StatusBadgeTone {
  return statusToneMap[status] ?? "neutral";
}

export function CustomResourceStatusBadge({ status }: { status: string }) {
  const tone = getTone(status);

  return (
    <Badge
      variant="outline"
      className={cn("border font-medium", getStatusBadgeToneClass(tone))}
    >
      {status}
    </Badge>
  );
}
