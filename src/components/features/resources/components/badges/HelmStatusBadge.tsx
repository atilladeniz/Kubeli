import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getStatusBadgeToneClass, type StatusBadgeTone } from "./statusBadgeStyles";

const variants: Record<string, StatusBadgeTone> = {
  deployed: "success",
  superseded: "neutral",
  failed: "danger",
  uninstalling: "warning",
  "pending-install": "info",
  "pending-upgrade": "info",
  "pending-rollback": "warning",
  uninstalled: "neutral",
};

export function HelmStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border font-medium",
        getStatusBadgeToneClass(variants[status] || "neutral")
      )}
    >
      {status}
    </Badge>
  );
}
