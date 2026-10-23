import { useClusterTagsStore } from "@/lib/stores/cluster-tags-store";
import { Badge } from "@/components/ui/badge";
import {
    BUILT_IN_CLUSTER_TAGS,
} from "@/lib/stores/cluster-tags-store";

const EMPTY_TAG_IDS: string[] = [];

interface TagListProps {
    clusterContext: string;
    className?: string;
    inline?: boolean;
}

export function TagList({
    clusterContext,
    className = "",
    inline = false,
}: TagListProps) {
    const customTags = useClusterTagsStore((state) => state.customTags);
    const assignments = useClusterTagsStore((state) => state.assignments);
    const assignedTagIds = assignments[clusterContext] ?? EMPTY_TAG_IDS;
    const allTags = [...BUILT_IN_CLUSTER_TAGS, ...customTags];
    const assignedTags = allTags.filter((tag) => assignedTagIds.includes(tag.id));

    const badges = assignedTags.map((tag) => (
        <Badge
            key={tag.id}
            variant="outline"
            className="max-w-32 truncate border px-1 py-0 text-xs font-normal"
            title={tag.name}
            style={{
                color: `color-mix(in srgb, ${tag.color} 35%, var(--foreground))`,
                borderColor: `${tag.color}66`,
                backgroundColor: `${tag.color}1a`,
            }}
        >
            {tag.name}
        </Badge>
    ));

    if (inline) return <>{badges}</>;

    return (
        <div className={`flex min-w-0 flex-wrap items-center justify-end gap-1 ${className}`}>
            {badges}
        </div>
    );
}