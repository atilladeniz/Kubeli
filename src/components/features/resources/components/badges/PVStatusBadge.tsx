import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const variants: Record<string, string> = {
  Available: "bg-green-500/10 text-green-500",
  Bound: "bg-blue-500/10 text-blue-500",
  Released: "bg-yellow-500/10 text-yellow-500",
  Failed: "bg-destructive/10 text-destructive",
  Pending: "bg-yellow-500/10 text-yellow-500",
};

export function PVStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("border-0", variants[status] || "bg-muted text-muted-foreground")}
    >
      {status}
    </Badge>
  );
}
