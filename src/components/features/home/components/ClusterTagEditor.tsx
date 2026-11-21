import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, Lock, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CLUSTER_TAG_COLORS,
  type ClusterTag,
  type ClusterTagColor,
  countTagUsage,
  isBuiltInTag,
  useClusterTagsStore,
} from "@/lib/stores/cluster-tags-store";
import { TAG_DOT_CLASS, TagDot } from "./TagChip";

/** Edit mode of the tag popover: rename, recolor and delete tags in place. */
export function ClusterTagEditor({ onBack }: { onBack: () => void }) {
  const t = useTranslations("cluster");
  const tCommon = useTranslations("common");
  const tags = useClusterTagsStore((state) => state.tags);
  const assignments = useClusterTagsStore((state) => state.assignments);
  const usage = useMemo(() => countTagUsage(assignments), [assignments]);
  // The pick view (and its focused input) unmounts when this view opens, so
  // focus lands on Back; it returns there after a delete removes its row.
  const backRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 border-b px-1.5 py-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7"
          ref={backRef}
          autoFocus
          aria-label={tCommon("back")}
          onClick={onBack}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium">{t("manageClusterTags")}</span>
      </div>
      <ul className="max-h-72 overflow-y-auto p-1">
        {tags.map((tag) => (
          <TagEditorRow
            key={tag.id}
            tag={tag}
            usage={usage.get(tag.id) ?? 0}
            onDeleted={() => backRef.current?.focus()}
          />
        ))}
      </ul>
    </div>
  );
}

interface TagEditorRowProps {
  tag: ClusterTag;
  usage: number;
  onDeleted: () => void;
}

function TagEditorRow({ tag, usage, onDeleted }: TagEditorRowProps) {
  const t = useTranslations("cluster");
  const tCommon = useTranslations("common");
  const tags = useClusterTagsStore((state) => state.tags);
  const renameTag = useClusterTagsStore((state) => state.renameTag);
  const setTagColor = useClusterTagsStore((state) => state.setTagColor);
  const deleteTag = useClusterTagsStore((state) => state.deleteTag);
  const [name, setName] = useState(tag.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Set when the confirm is cancelled so the remounted trash button takes focus.
  const [refocusDelete, setRefocusDelete] = useState(false);
  const builtIn = isBuiltInTag(tag.id);

  const trimmed = name.trim();
  const nameTaken = tags.some(
    (other) => other.id !== tag.id && other.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const invalid = !trimmed || nameTaken;

  // Invalid names never reach the store; leaving the field restores the old one.
  const commitName = () => {
    if (invalid || !renameTag(tag.id, trimmed)) setName(tag.name);
  };

  if (confirmingDelete) {
    return (
      <li className="m-0.5 space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-2">
        <p className="text-xs">{t("deleteClusterTagConfirm", { name: tag.name, count: usage })}</p>
        <div className="flex justify-end gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            autoFocus
            onClick={() => {
              setConfirmingDelete(false);
              setRefocusDelete(true);
            }}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              deleteTag(tag.id);
              onDeleted();
            }}
          >
            {t("deleteClusterTag")}
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-1.5 rounded-md px-1 py-0.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7 shrink-0"
            aria-label={t("clusterTagColorFor", { name: tag.name })}
          >
            <TagDot tag={tag} className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup
            value={tag.color}
            onValueChange={(color) => setTagColor(tag.id, color as ClusterTagColor)}
          >
            {CLUSTER_TAG_COLORS.map((color) => (
              <DropdownMenuRadioItem key={color} value={color}>
                <span
                  aria-hidden
                  className={cn("size-2.5 rounded-full", TAG_DOT_CLASS[color])}
                />
                {t(`tagColors.${color}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {builtIn ? (
        <span className="flex-1 truncate px-2 text-sm" title={tag.name}>
          {tag.name}
        </span>
      ) : (
        <Input
          value={name}
          aria-label={t("clusterTagName")}
          aria-invalid={invalid}
          title={nameTaken ? t("clusterTagNameExists") : undefined}
          className="h-7 flex-1 px-2 text-sm"
          onChange={(event) => setName(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitName();
          }}
        />
      )}

      <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">
        {usage}
      </span>

      {builtIn ? (
        <span
          className="flex size-7 shrink-0 items-center justify-center text-muted-foreground"
          title={t("builtInTag")}
        >
          <Lock className="size-3.5" aria-label={t("builtInTag")} />
        </span>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
          autoFocus={refocusDelete}
          aria-label={t("deleteClusterTagNamed", { name: tag.name })}
          onClick={() => setConfirmingDelete(true)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      )}
    </li>
  );
}
