import { cn } from "@/lib/utils";

interface MetricsProgressBarProps {
  percentage: number;
  used: string;
  total: string;
  color: "blue" | "purple" | "green" | "red";
}

const colors = {
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  green: "bg-green-500",
  red: "bg-destructive",
};

const bgColors = {
  blue: "bg-blue-500/20",
  purple: "bg-purple-500/20",
  green: "bg-green-500/20",
  red: "bg-destructive/20",
};

export function MetricsProgressBar({ percentage, used, total, color }: MetricsProgressBarProps) {
  const clampedPercentage = Math.min(100, Math.max(0, percentage));
  const isWarning = percentage > 80;
  const isCritical = percentage > 90;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{used} / {total}</span>
        <span className={cn(
          "font-medium",
          isCritical ? "text-destructive" : isWarning ? "text-yellow-500" : "text-foreground"
        )}>
          {percentage.toFixed(1)}%
        </span>
      </div>
      <div className={cn("h-2 rounded-full overflow-hidden", bgColors[color])}>
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            isCritical ? "bg-destructive" : isWarning ? "bg-yellow-500" : colors[color]
          )}
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
    </div>
  );
}
