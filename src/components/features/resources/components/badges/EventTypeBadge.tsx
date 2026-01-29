import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function EventTypeBadge({ type }: { type: string }) {
  const isWarning = type === "Warning";
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-0",
        isWarning
          ? "bg-yellow-500/10 text-yellow-500"
          : "bg-blue-500/10 text-blue-500"
      )}
    >
      {type}
    </Badge>
  );
}
