import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  type ClusterTag,
  type ClusterTagColor,
  isProductionTag,
} from "@/lib/stores/cluster-tags-store";

export const TAG_DOT_CLASS: Record<ClusterTagColor, string> = {
  blue: "bg-blue-500",
  cyan: "bg-cyan-500",
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  pink: "bg-pink-500",
  violet: "bg-violet-500",
  slate: "bg-slate-400",
};

export function TagDot({ tag, className }: { tag: ClusterTag; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        TAG_DOT_CLASS[tag.color],
        className,
      )}
    />
  );
}

/** Neutral chip with a color dot; only production is tinted. */
export function TagChip({ tag }: { tag: ClusterTag }) {
  return (
    <Badge
      variant="outline"
      title={tag.name}
      className={cn(
        "h-5 max-w-32 shrink rounded-md px-1.5 font-normal",
        isProductionTag(tag.id)
          ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-200"
          : "border-surface-border bg-muted/50",
      )}
    >
      <TagDot tag={tag} />
      <span className="truncate">{tag.name}</span>
    </Badge>
  );
}
