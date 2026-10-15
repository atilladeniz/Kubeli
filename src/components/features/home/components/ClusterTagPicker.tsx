import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type FormEvent,
} from "react";
import { useTranslations } from "next-intl";
import { TagPlus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  BUILT_IN_CLUSTER_TAGS,
  CLUSTER_TAG_PALETTE,
  type ClusterTagColor,
  useClusterTagsStore,
} from "@/lib/stores/cluster-tags-store";

const EMPTY_TAG_IDS: string[] = [];

interface ClusterTagPickerProps {
  clusterContext: string;
  variant: NonNullable<ComponentProps<typeof Button>["variant"]>;
  size: NonNullable<ComponentProps<typeof Button>["size"]>;
  className: string;
}

export function ClusterTagPicker({
  clusterContext,
  variant,
  size,
  className,
}: ClusterTagPickerProps) {
  const t = useTranslations("cluster");
  const tCommon = useTranslations("common");
  const customTags = useClusterTagsStore((state) => state.customTags);
  const assignments = useClusterTagsStore((state) => state.assignments);
  const addCustomTag = useClusterTagsStore((state) => state.addCustomTag);
  const toggleTagAssignment = useClusterTagsStore(
    (state) => state.toggleTagAssignment,
  );
  const removeCustomTag = useClusterTagsStore((state) => state.removeCustomTag);
  const assignedTagIds = assignments[clusterContext] ?? EMPTY_TAG_IDS;
  const allTags = [...BUILT_IN_CLUSTER_TAGS, ...customTags];

  const [manageOpen, setManageOpen] = useState(false);
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState<ClusterTagColor>(CLUSTER_TAG_PALETTE[1]);
  const [nameExists, setNameExists] = useState(false);
  const deleteButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingDeleteFocus = useRef<string | null>(null);
  const [focusedDeleteTagId, setFocusedDeleteTagId] = useState<string | null>(null);
  const rovingDeleteTagId = customTags.some(
    (tag) => tag.id === focusedDeleteTagId,
  )
    ? focusedDeleteTagId
    : customTags[0]?.id;

  useEffect(() => {
    const focusTarget = pendingDeleteFocus.current;
    if (!focusTarget) return;

    pendingDeleteFocus.current = null;
    if (focusTarget === "cluster-tag-name") {
      document.getElementById(focusTarget)?.focus();
    } else {
      deleteButtonRefs.current.get(focusTarget)?.focus();
    }
  }, [customTags]);

  const handleDeleteTag = (tagId: string) => {
    const currentIndex = customTags.findIndex((tag) => tag.id === tagId);
    const nextTag = customTags[currentIndex + 1] ?? customTags[currentIndex - 1];
    pendingDeleteFocus.current = nextTag?.id ?? "cluster-tag-name";
    setFocusedDeleteTagId(nextTag?.id ?? null);
    removeCustomTag(tagId);
  };

  const handleCreateTag = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tagName.trim()) return;

    const tagId = addCustomTag(tagName, tagColor);
    if (!tagId) {
      setNameExists(true);
      return;
    }

    toggleTagAssignment(clusterContext, tagId);
    setTagName("");
    setNameExists(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant={variant}
            size={size}
            className={className}
            aria-label={t("manageClusterTags")}
            title={t("manageClusterTags")}
          >
            <TagPlus className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-64">
          <DropdownMenuLabel>{t("clusterTags")}</DropdownMenuLabel>
          {allTags.map((tag) => (
            <DropdownMenuCheckboxItem
              key={tag.id}
              checked={assignedTagIds.includes(tag.id)}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={() =>
                toggleTagAssignment(clusterContext, tag.id)
              }
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              <span className="min-w-0 max-w-48 truncate" title={tag.name}>
                {tag.name}
              </span>
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setManageOpen(true)}>
            {t("manageClusterTags")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("manageClusterTags")}</DialogTitle>
            <DialogDescription>
              {t("manageClusterTagsDescription")}
            </DialogDescription>
          </DialogHeader>

          {customTags.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">{t("customClusterTags")}</h3>
              <ul className="max-h-64 space-y-1 overflow-y-auto p-2">
                {customTags.map((tag) => (
                  <li
                    key={tag.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <Badge
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-7"
                      ref={(element) => {
                        if (element) {
                          deleteButtonRefs.current.set(tag.id, element);
                        } else {
                          deleteButtonRefs.current.delete(tag.id);
                        }
                      }}
                      tabIndex={tag.id === rovingDeleteTagId ? 0 : -1}
                      onFocus={() => setFocusedDeleteTagId(tag.id)}
                      onKeyDown={(event) => {
                        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
                          return;
                        }

                        event.preventDefault();
                        const currentIndex = customTags.findIndex(
                          (item) => item.id === tag.id,
                        );
                        const direction = event.key === "ArrowDown" ? 1 : -1;
                        const nextIndex =
                          (currentIndex + direction + customTags.length) %
                          customTags.length;
                        const nextTag = customTags[nextIndex];
                        setFocusedDeleteTagId(nextTag.id);
                        deleteButtonRefs.current.get(nextTag.id)?.focus();
                      }}
                      aria-label={`${t("deleteClusterTag")} ${tag.name}`}
                      title={t("deleteClusterTag")}
                      onClick={() => handleDeleteTag(tag.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleCreateTag}>
            <div className="space-y-2">
              <label htmlFor="cluster-tag-name" className="text-sm font-medium">
                {t("clusterTagName")}
              </label>
              <Input
                id="cluster-tag-name"
                value={tagName}
                placeholder={t("clusterTagNamePlaceholder")}
                onChange={(event) => {
                  setTagName(event.target.value);
                  setNameExists(false);
                }}
              />
              {nameExists && (
                <p role="alert" className="text-sm text-destructive">
                  {t("clusterTagNameExists")}
                </p>
              )}
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t("clusterTagColor")}</legend>
              <RadioGroup
                value={tagColor}
                onValueChange={(value) =>
                  setTagColor(value as ClusterTagColor)
                }
                orientation="horizontal"
                className="flex flex-wrap gap-2"
                aria-label={t("clusterTagColor")}
              >
                {CLUSTER_TAG_PALETTE.map((color, index) => (
                  <RadioGroupItem
                    key={color}
                    value={color}
                    aria-label={t("selectClusterTagColorOption", {
                      index: index + 1,
                    })}
                    className={`size-7 rounded-full [&_[data-slot=radio-group-indicator]]:hidden ${tagColor === color ? "ring-2 ring-ring ring-offset-2" : ""}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </RadioGroup>
            </fieldset>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setManageOpen(false)}
              >
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={!tagName.trim()}>
                {t("createClusterTag")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}