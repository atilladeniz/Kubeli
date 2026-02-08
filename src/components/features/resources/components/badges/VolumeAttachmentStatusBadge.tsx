import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getStatusBadgeToneClass } from "./statusBadgeStyles";

export function VolumeAttachmentStatusBadge({ attached }: { attached: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border font-medium",
        getStatusBadgeToneClass(attached ? "success" : "warning")
      )}
    >
      {attached ? "Attached" : "Pending"}
    </Badge>
  );
}
