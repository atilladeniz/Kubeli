import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  countTagUsage,
  useAssignedTagIds,
  useClusterTagsStore,
} from "@/lib/stores/cluster-tags-store";
import { ClusterTagEditor } from "./ClusterTagEditor";
import { TagDot } from "./TagChip";

interface ClusterTagPickerProps {
  clusterContext: string;
  hasTags: boolean;
}

/** "+" chip that opens one popover to toggle, create and (via "Edit tags") manage tags. */
export function ClusterTagPicker({ clusterContext, hasTags }: ClusterTagPickerProps) {
  const t = useTranslations("cluster");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");

  const tags = useClusterTagsStore((state) => state.tags);
  const assignments = useClusterTagsStore((state) => state.assignments);
  const toggleTag = useClusterTagsStore((state) => state.toggleTag);
  const createTag = useClusterTagsStore((state) => state.createTag);
  const assignedIds = useAssignedTagIds(clusterContext);
  const usage = useMemo(() => countTagUsage(assignments), [assignments]);

  const query = search.trim();
  const queryLower = query.toLowerCase();
  // ponytail: substring match instead of cmdk's fuzzy score, so Enter on an
  // unknown name always lands on "Create" instead of a fuzzy hit.
  const matches = tags.filter((tag) => tag.name.toLowerCase().includes(queryLower));
  const canCreate =
    query.length > 0 && !tags.some((tag) => tag.name.toLowerCase() === queryLower);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setSearch("");
      setEditing(false);
    }
  };

  const handleCreate = () => {
    const id = createTag(query);
    if (id) toggleTag(clusterContext, id);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t("editClusterTags")}
          title={t("editClusterTags")}
          className="h-5 shrink-0 gap-1 rounded-md border border-dashed border-surface-border px-1.5 text-xs font-normal text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-3" />
          {!hasTags && t("addClusterTag")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        {editing ? (
          <ClusterTagEditor onBack={() => setEditing(false)} />
        ) : (
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={t("searchOrCreateTag")}
              autoFocus
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-64">
              <CommandGroup>
                {matches.map((tag) => {
                  const assigned = assignedIds.includes(tag.id);
                  return (
                    <CommandItem
                      key={tag.id}
                      value={tag.id}
                      aria-checked={assigned}
                      onSelect={() => toggleTag(clusterContext, tag.id)}
                    >
                      <Check className={cn("size-4", !assigned && "opacity-0")} />
                      <TagDot tag={tag} className="size-2" />
                      <span className="flex-1 truncate" title={tag.name}>
                        {tag.name}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {usage.get(tag.id) ?? 0}
                      </span>
                    </CommandItem>
                  );
                })}
                {canCreate && (
                  <CommandItem value="__create__" onSelect={handleCreate}>
                    <Plus className="size-4" />
                    <span className="truncate">{t("createClusterTag", { name: query })}</span>
                  </CommandItem>
                )}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem value="__edit__" onSelect={() => setEditing(true)}>
                  <Pencil className="size-4" />
                  {t("manageClusterTags")}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
