import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const variants: Record<string, string> = {
  ready: "bg-green-500/10 text-green-500",
  notready: "bg-yellow-500/10 text-yellow-500",
  reconciling: "bg-blue-500/10 text-blue-500",
  failed: "bg-destructive/10 text-destructive",
  unknown: "bg-muted text-muted-foreground",
};

const labels: Record<string, string> = {
  ready: "Ready",
  notready: "Not Ready",
  reconciling: "Reconciling",
  failed: "Failed",
  unknown: "Unknown",
};

export function FluxKustomizationStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("border-0 text-[10px]", variants[status] || "bg-muted text-muted-foreground")}
    >
      {labels[status] || status}
    </Badge>
  );
}
