import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getStatusBadgeToneClass, type StatusBadgeTone } from "./statusBadgeStyles";

const variants: Record<string, StatusBadgeTone> = {
  Available: "success",
  Bound: "info",
  Released: "warning",
  Failed: "danger",
  Pending: "warning",
};

export function PVStatusBadge({ status }: { status: string }) {
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
