import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const variants: Record<string, string> = {
  deployed: "bg-green-500/10 text-green-500",
  superseded: "bg-muted text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
  uninstalling: "bg-yellow-500/10 text-yellow-500",
  "pending-install": "bg-blue-500/10 text-blue-500",
  "pending-upgrade": "bg-blue-500/10 text-blue-500",
  "pending-rollback": "bg-yellow-500/10 text-yellow-500",
  uninstalled: "bg-muted text-muted-foreground",
};

export function HelmStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("border-0 text-[10px]", variants[status] || "bg-muted text-muted-foreground")}
    >
      {status}
    </Badge>
  );
}
