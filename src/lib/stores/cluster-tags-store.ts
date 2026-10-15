import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const CLUSTER_TAG_PALETTE = [
  "#3b82f6",
  "#06b6d4",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#64748b",
] as const;

export type ClusterTagColor = (typeof CLUSTER_TAG_PALETTE)[number];

export interface ClusterTagDefinition {
  id: string;
  name: string;
  color: ClusterTagColor;
  kind: "builtin" | "custom";
}

export const BUILT_IN_CLUSTER_TAGS: readonly ClusterTagDefinition[] = [
  { id: "integration", name: "integration", color: CLUSTER_TAG_PALETTE[0], kind: "builtin" },
  { id: "staging", name: "staging", color: CLUSTER_TAG_PALETTE[3], kind: "builtin" },
  { id: "production", name: "production", color: CLUSTER_TAG_PALETTE[4], kind: "builtin" },
];

interface ClusterTagsState {
  customTags: ClusterTagDefinition[];
  assignments: Record<string, string[]>;
  addCustomTag: (name: string, color: ClusterTagColor) => string | null;
  toggleTagAssignment: (clusterContext: string, tagId: string) => void;
  removeCustomTag: (tagId: string) => void;
}

export const useClusterTagsStore = create<ClusterTagsState>()(
  persist(
    (set, get) => ({
      customTags: [],
      assignments: {},

      addCustomTag: (name, color) => {
        const trimmedName = name.trim();
        const normalizedName = trimmedName.toLowerCase();
        const state = get();
        const nameExists = [
          ...BUILT_IN_CLUSTER_TAGS,
          ...state.customTags,
        ].some((tag) => tag.name.toLowerCase() === normalizedName);

        if (!normalizedName || nameExists) return null;

        const id = `custom:${normalizedName}`;
        set({
          customTags: [
            ...state.customTags,
            { id, name: trimmedName, color, kind: "custom" },
          ],
        });
        return id;
      },

      toggleTagAssignment: (clusterContext, tagId) => {
        const state = get();
        const tagExists =
          BUILT_IN_CLUSTER_TAGS.some((tag) => tag.id === tagId) ||
          state.customTags.some((tag) => tag.id === tagId);
        if (!clusterContext || !tagExists) return;

        const assigned = state.assignments[clusterContext] ?? [];
        const nextAssigned = assigned.includes(tagId)
          ? assigned.filter((id) => id !== tagId)
          : [...assigned, tagId];
        const assignments = { ...state.assignments };

        if (nextAssigned.length > 0) {
          assignments[clusterContext] = nextAssigned;
        } else {
          delete assignments[clusterContext];
        }

        set({ assignments });
      },

      removeCustomTag: (tagId) => {
        const state = get();
        if (!state.customTags.some((tag) => tag.id === tagId)) return;

        const assignments = Object.fromEntries(
          Object.entries(state.assignments)
            .map(([context, tagIds]) => [
              context,
              tagIds.filter((id) => id !== tagId),
            ])
            .filter(([, tagIds]) => tagIds.length > 0),
        );

        set({
          customTags: state.customTags.filter((tag) => tag.id !== tagId),
          assignments,
        });
      },
    }),
    {
      name: "kubeli-cluster-tags",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        customTags: state.customTags,
        assignments: state.assignments,
      }),
    },
  ),
);