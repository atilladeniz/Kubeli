import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getStatusBadgeToneClass, type StatusBadgeTone } from "./statusBadgeStyles";

const variants: Record<string, StatusBadgeTone> = {
  ready: "success",
  notready: "warning",
  reconciling: "info",
  failed: "danger",
  unknown: "neutral",
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
      className={cn(
        "border font-medium",
        getStatusBadgeToneClass(variants[status] || "neutral")
      )}
    >
      {labels[status] || status}
    </Badge>
  );
}
