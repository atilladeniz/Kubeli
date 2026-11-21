import { useMemo, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, Lock, Plus, Trash2 } from "lucide-react";
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

// Bare input that reads as text until hovered/focused, so custom and built-in
// names line up (both use px-2 inside the same column).
const INLINE_INPUT =
  "h-7 min-w-0 flex-1 rounded-md bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground hover:bg-accent/60 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring aria-invalid:text-destructive aria-invalid:ring-destructive";

const isNameTaken = (tags: ClusterTag[], name: string, exceptId?: string) =>
  tags.some(
    (tag) => tag.id !== exceptId && tag.name.toLowerCase() === name.trim().toLowerCase(),
  );

/** Edit mode of the tag popover: create, rename, recolor and delete tags in place. */
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
      <div className="flex h-10 items-center gap-1 border-b px-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          ref={backRef}
          autoFocus
          aria-label={tCommon("back")}
          onClick={onBack}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium">{t("editTagsTitle")}</span>
      </div>
      <ul className="max-h-72 overflow-y-auto px-1 py-1">
        {tags.map((tag) => (
          <TagEditorRow
            key={tag.id}
            tag={tag}
            usage={usage.get(tag.id) ?? 0}
            onDeleted={() => backRef.current?.focus()}
          />
        ))}
      </ul>
      <NewTagForm />
    </div>
  );
}

function NewTagForm() {
  const t = useTranslations("cluster");
  const tags = useClusterTagsStore((state) => state.tags);
  const createTag = useClusterTagsStore((state) => state.createTag);
  const [name, setName] = useState("");
  const taken = isNameTaken(tags, name);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (createTag(name)) setName("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex h-12 items-center gap-1 border-t px-2 pr-3">
      <span className="flex size-8 shrink-0 items-center justify-center text-muted-foreground">
        <Plus className="size-4" aria-hidden />
      </span>
      <Input
        value={name}
        placeholder={t("newTagPlaceholder")}
        aria-label={t("newTagPlaceholder")}
        aria-invalid={taken}
        title={taken ? t("clusterTagNameExists") : undefined}
        className="h-8 flex-1 rounded-md px-2 text-sm"
        onChange={(event) => setName(event.target.value)}
      />
    </form>
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

  const nameTaken = isNameTaken(tags, name, tag.id);
  const invalid = !name.trim() || nameTaken;

  // Invalid names never reach the store; leaving the field restores the old one.
  const commitName = () => {
    if (invalid || !renameTag(tag.id, name)) setName(tag.name);
  };

  if (confirmingDelete) {
    return (
      <li className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-2">
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
    <li className="flex h-9 items-center gap-1 px-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            aria-label={t("clusterTagColorFor", { name: tag.name })}
            title={t("clusterTagColorFor", { name: tag.name })}
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
        <span className="flex h-7 min-w-0 flex-1 items-center gap-1.5 px-2 text-sm" title={tag.name}>
          <span className="truncate">{tag.name}</span>
          <Lock
            className="size-3 shrink-0 text-muted-foreground/70"
            aria-label={t("builtInTag")}
          />
        </span>
      ) : (
        <input
          value={name}
          aria-label={t("clusterTagName")}
          aria-invalid={invalid}
          title={nameTaken ? t("clusterTagNameExists") : undefined}
          spellCheck={false}
          className={INLINE_INPUT}
          onChange={(event) => setName(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitName();
          }}
        />
      )}

      <span
        className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground"
        title={t("tagUsage", { count: usage })}
      >
        {usage}
      </span>

      {builtIn ? (
        // Keeps the usage column aligned with deletable rows.
        <span aria-hidden className="size-8 shrink-0" />
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-muted-foreground hover:text-destructive"
          autoFocus={refocusDelete}
          aria-label={t("deleteClusterTagNamed", { name: tag.name })}
          title={t("deleteClusterTagNamed", { name: tag.name })}
          onClick={() => setConfirmingDelete(true)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      )}
    </li>
  );
}
