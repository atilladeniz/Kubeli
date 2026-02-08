import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getStatusBadgeToneClass } from "./statusBadgeStyles";

export function EventTypeBadge({ type }: { type: string }) {
  const isWarning = type === "Warning";
  return (
    <Badge
      variant="outline"
      className={cn(
        "border font-medium",
        getStatusBadgeToneClass(isWarning ? "warning" : "info")
      )}
    >
      {type}
    </Badge>
  );
}
