import { cn } from "@/lib/utils";

interface StatusRowProps {
  label: string;
  value: number;
  color: "green" | "yellow" | "red" | "blue";
}

const colors = {
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  red: "bg-destructive",
  blue: "bg-blue-500",
};

export function StatusRow({ label, value, color }: StatusRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={cn("size-2 rounded-full", colors[color])} />
        <span className="text-muted-foreground">{label}</span>
      </div>
      <span className="font-medium">{value}</span>
    </div>
  );
}
