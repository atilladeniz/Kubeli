import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Cluster } from "@/lib/types";
import { useClusterTagsStore } from "@/lib/stores/cluster-tags-store";
import { TagDot } from "./TagChip";

/** Filter value for clusters without any tag. */
export const UNTAGGED = "__untagged__";

/**
 * True when a cluster passes the tag filter (OR across selected tags) and the
 * search, which matches name, context and tag names.
 */
export function matchesClusterFilter(
  cluster: Cluster,
  tagIds: string[],
  tagNames: string[],
  filter: string[],
  search: string,
) {
  const query = search.trim().toLowerCase();
  const matchesSearch =
    !query ||
    cluster.name.toLowerCase().includes(query) ||
    cluster.context.toLowerCase().includes(query) ||
    tagNames.some((name) => name.toLowerCase().includes(query));
  const matchesTags =
    filter.length === 0 ||
    (filter.includes(UNTAGGED) && tagIds.length === 0) ||
    tagIds.some((id) => filter.includes(id));
  return matchesSearch && matchesTags;
}

/**
 * Drops selected filter entries whose pill is gone (tag deleted or no longer
 * assigned), so a stale selection can never hide clusters without a way out.
 */
export function pruneTagFilter(
  filter: string[],
  clusters: Cluster[],
  assignments: Record<string, string[]>,
) {
  const used = new Set(clusters.flatMap((c) => assignments[c.context] ?? []));
  const hasUntagged = clusters.some((c) => !assignments[c.context]);
  return filter.filter((id) => (id === UNTAGGED ? hasUntagged : used.has(id)));
}

interface ClusterTagFilterProps {
  clusters: Cluster[];
  value: string[];
  onChange: (value: string[]) => void;
}

/** Tag pills above the cluster list; hidden until at least one tag is in use. */
export function ClusterTagFilter({ clusters, value, onChange }: ClusterTagFilterProps) {
  const t = useTranslations("cluster");
  const tags = useClusterTagsStore((state) => state.tags);
  const assignments = useClusterTagsStore((state) => state.assignments);

  const { counts, untagged } = useMemo(() => {
    const counts = new Map<string, number>();
    let untagged = 0;
    for (const cluster of clusters) {
      const ids = assignments[cluster.context] ?? [];
      if (ids.length === 0) untagged++;
      for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return { counts, untagged };
  }, [clusters, assignments]);

  const usedTags = tags.filter((tag) => counts.has(tag.id));
  if (usedTags.length === 0) return null;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-xs text-muted-foreground">{t("filterByTag")}</span>
      <ToggleGroup
        type="multiple"
        variant="outline"
        size="sm"
        spacing={1}
        value={value}
        onValueChange={onChange}
        aria-label={t("filterByTag")}
        className="flex-wrap"
      >
        {usedTags.map((tag) => (
          <ToggleGroupItem
            key={tag.id}
            value={tag.id}
            className="h-7 max-w-48 gap-1.5 rounded-full px-2.5 text-xs font-normal"
            title={tag.name}
          >
            <TagDot tag={tag} className="size-2" />
            <span className="truncate">{tag.name}</span>
            <span className="tabular-nums text-muted-foreground">{counts.get(tag.id)}</span>
          </ToggleGroupItem>
        ))}
        {untagged > 0 && (
          <ToggleGroupItem
            value={UNTAGGED}
            className="h-7 gap-1.5 rounded-full px-2.5 text-xs font-normal"
          >
            {t("untagged")}
            <span className="tabular-nums text-muted-foreground">{untagged}</span>
          </ToggleGroupItem>
        )}
      </ToggleGroup>
    </div>
  );
}
