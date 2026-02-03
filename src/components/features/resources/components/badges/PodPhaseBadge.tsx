import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const variants: Record<string, string> = {
  Running: "bg-green-500/10 text-green-500",
  Pending: "bg-yellow-500/10 text-yellow-500",
  Succeeded: "bg-blue-500/10 text-blue-500",
  Failed: "bg-destructive/10 text-destructive",
  Terminating: "bg-muted text-muted-foreground",
  Unknown: "bg-muted text-muted-foreground",
  CrashLoopBackOff: "bg-destructive/10 text-destructive",
  Error: "bg-destructive/10 text-destructive",
  ImagePullBackOff: "bg-yellow-500/10 text-yellow-500",
  ErrImagePull: "bg-yellow-500/10 text-yellow-500",
  CreateContainerConfigError: "bg-destructive/10 text-destructive",
  OOMKilled: "bg-destructive/10 text-destructive",
  PodInitializing: "bg-yellow-500/10 text-yellow-500",
};

function getVariant(phase: string): string {
  if (variants[phase]) return variants[phase];
  if (phase.startsWith("Init:")) return "bg-yellow-500/10 text-yellow-500";
  return variants.Unknown;
}

export function PodPhaseBadge({ phase }: { phase: string }) {
  return (
    <Badge variant="outline" className={cn("border-0", getVariant(phase))}>
      {phase}
    </Badge>
  );
}
