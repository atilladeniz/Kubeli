import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Named colors; the UI maps them to Tailwind classes (see TagChip). */
export const CLUSTER_TAG_COLORS = [
  "blue",
  "cyan",
  "green",
  "amber",
  "red",
  "pink",
  "violet",
  "slate",
] as const;

export type ClusterTagColor = (typeof CLUSTER_TAG_COLORS)[number];

export interface ClusterTag {
  id: string;
  name: string;
  color: ClusterTagColor;
}

/** Built-in tags have fixed ids and names: they can be recolored, not renamed or deleted. */
export const BUILT_IN_TAG_IDS = ["production", "staging", "integration"] as const;

export const isBuiltInTag = (id: string) =>
  (BUILT_IN_TAG_IDS as readonly string[]).includes(id);

/** Production gets a tinted chip so it stands out on every card. */
export const isProductionTag = (id: string) => id === "production";

const DEFAULT_TAGS: ClusterTag[] = [
  { id: "production", name: "production", color: "red" },
  { id: "staging", name: "staging", color: "amber" },
  { id: "integration", name: "integration", color: "blue" },
];

const normalize = (name: string) => name.trim().toLowerCase();

/** First color no tag uses yet; red stays reserved for production. */
export function nextTagColor(tags: ClusterTag[]): ClusterTagColor {
  const candidates = CLUSTER_TAG_COLORS.filter((color) => color !== "red");
  const used = new Set(tags.map((tag) => tag.color));
  return (
    candidates.find((color) => !used.has(color)) ??
    candidates[tags.length % candidates.length]
  );
}

const EMPTY_IDS: string[] = [];

interface ClusterTagsState {
  tags: ClusterTag[];
  /** cluster context -> assigned tag ids */
  assignments: Record<string, string[]>;
  /** Returns the new tag's id, or null when the name is blank or taken. */
  createTag: (name: string) => string | null;
  /** Returns false when the name is blank, taken, or the tag is built-in. */
  renameTag: (id: string, name: string) => boolean;
  setTagColor: (id: string, color: ClusterTagColor) => void;
  deleteTag: (id: string) => void;
  toggleTag: (context: string, id: string) => void;
}

export const useClusterTagsStore = create<ClusterTagsState>()(
  persist(
    (set, get) => {
      const nameTaken = (name: string, exceptId?: string) =>
        get().tags.some(
          (tag) => tag.id !== exceptId && normalize(tag.name) === normalize(name),
        );

      return {
        tags: DEFAULT_TAGS,
        assignments: {},

        createTag: (name) => {
          const trimmed = name.trim();
          if (!trimmed || nameTaken(trimmed)) return null;

          const { tags } = get();
          // Ids never derive from the name, so renaming keeps assignments.
          const id = `tag-${crypto.randomUUID()}`;
          set({ tags: [...tags, { id, name: trimmed, color: nextTagColor(tags) }] });
          return id;
        },

        renameTag: (id, name) => {
          const trimmed = name.trim();
          if (!trimmed || isBuiltInTag(id) || nameTaken(trimmed, id)) return false;
          set({
            tags: get().tags.map((tag) =>
              tag.id === id ? { ...tag, name: trimmed } : tag,
            ),
          });
          return true;
        },

        setTagColor: (id, color) =>
          set({
            tags: get().tags.map((tag) => (tag.id === id ? { ...tag, color } : tag)),
          }),

        deleteTag: (id) => {
          if (isBuiltInTag(id)) return;
          const assignments: Record<string, string[]> = {};
          for (const [context, ids] of Object.entries(get().assignments)) {
            const rest = ids.filter((tagId) => tagId !== id);
            if (rest.length > 0) assignments[context] = rest;
          }
          set({ tags: get().tags.filter((tag) => tag.id !== id), assignments });
        },

        toggleTag: (context, id) => {
          const { tags, assignments } = get();
          if (!context || !tags.some((tag) => tag.id === id)) return;

          const current = assignments[context] ?? EMPTY_IDS;
          const next = current.includes(id)
            ? current.filter((tagId) => tagId !== id)
            : [...current, id];
          const rest = { ...assignments };
          delete rest[context];
          set({ assignments: next.length > 0 ? { ...rest, [context]: next } : rest });
        },
      };
    },
    {
      name: "kubeli-cluster-tags",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ tags, assignments }) => ({ tags, assignments }),
    },
  ),
);

/** Tag ids assigned to one cluster; stable reference for selectors. */
export const useAssignedTagIds = (context: string) =>
  useClusterTagsStore((state) => state.assignments[context] ?? EMPTY_IDS);

/** Assigned tags in tag-list order (built-ins first, so production leads). */
export const tagsForIds = (tags: ClusterTag[], ids: string[]) =>
  tags.filter((tag) => ids.includes(tag.id));

/** How many clusters carry each tag. */
export function countTagUsage(assignments: Record<string, string[]>) {
  const counts = new Map<string, number>();
  for (const ids of Object.values(assignments)) {
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}
