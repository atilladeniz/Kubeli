import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const variants: Record<string, string> = {
  Bound: "bg-green-500/10 text-green-500",
  Pending: "bg-yellow-500/10 text-yellow-500",
  Lost: "bg-destructive/10 text-destructive",
};

export function PVCStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("border-0", variants[status] || "bg-muted text-muted-foreground")}
    >
      {status}
    </Badge>
  );
}
