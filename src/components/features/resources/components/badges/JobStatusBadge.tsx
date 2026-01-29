import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const variants: Record<string, string> = {
  Complete: "bg-green-500/10 text-green-500",
  Running: "bg-blue-500/10 text-blue-500",
  Failed: "bg-destructive/10 text-destructive",
  Pending: "bg-yellow-500/10 text-yellow-500",
};

export function JobStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("border-0", variants[status] || "bg-muted text-muted-foreground")}
    >
      {status}
    </Badge>
  );
}
