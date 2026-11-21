import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  tagsForIds,
  useAssignedTagIds,
  useClusterTagsStore,
} from "@/lib/stores/cluster-tags-store";
import { ClusterTagPicker } from "./ClusterTagPicker";
import { TagChip } from "./TagChip";

interface ClusterTagsProps {
  clusterContext: string;
  /** Chips shown before the rest collapses into "+n". */
  max?: number;
  className?: string;
}

/** One non-wrapping row: assigned tags, an overflow counter and the picker. */
export function ClusterTags({ clusterContext, max = 3, className }: ClusterTagsProps) {
  const allTags = useClusterTagsStore((state) => state.tags);
  const ids = useAssignedTagIds(clusterContext);
  const tags = useMemo(() => tagsForIds(allTags, ids), [allTags, ids]);
  const hidden = tags.slice(max);

  return (
    <div className={cn("flex min-w-0 items-center gap-1", className)}>
      {tags.slice(0, max).map((tag) => (
        <TagChip key={tag.id} tag={tag} />
      ))}
      {hidden.length > 0 && (
        <Badge
          variant="outline"
          className="h-5 rounded-md border-surface-border px-1.5 font-normal text-muted-foreground"
          title={hidden.map((tag) => tag.name).join(", ")}
        >
          +{hidden.length}
        </Badge>
      )}
      <ClusterTagPicker clusterContext={clusterContext} hasTags={tags.length > 0} />
    </div>
  );
}
