import { cn } from "@/lib/utils";

export function MetadataItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}
