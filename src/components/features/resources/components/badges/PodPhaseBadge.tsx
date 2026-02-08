import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getStatusBadgeToneClass, type StatusBadgeTone } from "./statusBadgeStyles";

const variants: Record<string, StatusBadgeTone> = {
  Running: "success",
  Pending: "warning",
  Succeeded: "info",
  Failed: "danger",
  Terminating: "neutral",
  Unknown: "neutral",
  CrashLoopBackOff: "danger",
  Error: "danger",
  ImagePullBackOff: "warning",
  ErrImagePull: "warning",
  CreateContainerConfigError: "danger",
  OOMKilled: "danger",
  PodInitializing: "warning",
};

function getVariant(phase: string): StatusBadgeTone {
  if (variants[phase]) return variants[phase];
  if (phase.startsWith("Init:")) return "warning";
  return variants.Unknown;
}

export function PodPhaseBadge({ phase }: { phase: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("border font-medium", getStatusBadgeToneClass(getVariant(phase)))}
    >
      {phase}
    </Badge>
  );
}
