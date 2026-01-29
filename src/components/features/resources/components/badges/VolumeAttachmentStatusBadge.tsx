import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function VolumeAttachmentStatusBadge({ attached }: { attached: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-0",
        attached ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"
      )}
    >
      {attached ? "Attached" : "Pending"}
    </Badge>
  );
}
