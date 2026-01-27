import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  title: string;
  value: number;
  subtitle?: string;
  status: "healthy" | "warning" | "error";
}

const statusColors = {
  healthy: "border-green-500/30 bg-green-500/5",
  warning: "border-yellow-500/30 bg-yellow-500/5",
  error: "border-destructive/30 bg-destructive/5",
};

export function SummaryCard({ title, value, subtitle, status }: SummaryCardProps) {
  return (
    <Card className={cn("py-4", statusColors[status])}>
      <CardContent className="p-0 px-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-3xl font-bold">{value}</p>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
