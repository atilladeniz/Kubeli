import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// A favorite resource reference
export interface FavoriteResource {
  id: string; // unique id
  resourceType: string; // e.g., "pods", "deployments", "services"
  name: string;
  namespace?: string;
  clusterContext: string;
  addedAt: number;
  order: number;
}

// Recent resource access
export interface RecentResource {
  resourceType: string;
  name: string;
  namespace?: string;
  clusterContext: string;
  accessedAt: number;
}

interface FavoritesState {
  // Favorites per cluster (keyed by cluster context)
  favorites: Record<string, FavoriteResource[]>;

  // Recent resources (last 20 across all clusters)
  recentResources: RecentResource[];

  // Max recent items to keep
  maxRecentItems: number;

  // Actions
  addFavorite: (
    clusterContext: string,
    resourceType: string,
    name: string,
    namespace?: string
  ) => void;
  removeFavorite: (clusterContext: string, id: string) => void;
  reorderFavorites: (clusterContext: string, favorites: FavoriteResource[]) => void;
  isFavorite: (
    clusterContext: string,
    resourceType: string,
    name: string,
    namespace?: string
  ) => boolean;
  getFavorites: (clusterContext: string) => FavoriteResource[];

  // Recent resources
  addRecentResource: (
    clusterContext: string,
    resourceType: string,
    name: string,
    namespace?: string
  ) => void;
  getRecentResources: (clusterContext?: string) => RecentResource[];
  clearRecentResources: () => void;
}

// Generate unique ID
const generateId = () => `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: {},
      recentResources: [],
      maxRecentItems: 20,

      addFavorite: (clusterContext, resourceType, name, namespace) => {
        const state = get();
        const clusterFavorites = state.favorites[clusterContext] || [];

        // Check if already exists
        const exists = clusterFavorites.some(
          (f) =>
            f.resourceType === resourceType &&
            f.name === name &&
            f.namespace === namespace
        );

        if (exists) return;

        const newFavorite: FavoriteResource = {
          id: generateId(),
          resourceType,
          name,
          namespace,
          clusterContext,
          addedAt: Date.now(),
          order: clusterFavorites.length,
        };

        set({
          favorites: {
            ...state.favorites,
            [clusterContext]: [...clusterFavorites, newFavorite],
          },
        });
      },

      removeFavorite: (clusterContext, id) => {
        const state = get();
        const clusterFavorites = state.favorites[clusterContext] || [];

        set({
          favorites: {
            ...state.favorites,
            [clusterContext]: clusterFavorites
              .filter((f) => f.id !== id)
              .map((f, index) => ({ ...f, order: index })),
          },
        });
      },

      reorderFavorites: (clusterContext, favorites) => {
        const state = get();
        set({
          favorites: {
            ...state.favorites,
            [clusterContext]: favorites.map((f, index) => ({ ...f, order: index })),
          },
        });
      },

      isFavorite: (clusterContext, resourceType, name, namespace) => {
        const state = get();
        const clusterFavorites = state.favorites[clusterContext] || [];
        return clusterFavorites.some(
          (f) =>
            f.resourceType === resourceType &&
            f.name === name &&
            f.namespace === namespace
        );
      },

      getFavorites: (clusterContext) => {
        const state = get();
        return (state.favorites[clusterContext] || []).sort(
          (a, b) => a.order - b.order
        );
      },

      addRecentResource: (clusterContext, resourceType, name, namespace) => {
        const state = get();

        // Remove existing entry for same resource
        const filtered = state.recentResources.filter(
          (r) =>
            !(
              r.clusterContext === clusterContext &&
              r.resourceType === resourceType &&
              r.name === name &&
              r.namespace === namespace
            )
        );

        const newRecent: RecentResource = {
          resourceType,
          name,
          namespace,
          clusterContext,
          accessedAt: Date.now(),
        };

        // Add to front and limit to maxRecentItems
        const updated = [newRecent, ...filtered].slice(0, state.maxRecentItems);

        set({ recentResources: updated });
      },

      getRecentResources: (clusterContext) => {
        const state = get();
        if (clusterContext) {
          return state.recentResources.filter(
            (r) => r.clusterContext === clusterContext
          );
        }
        return state.recentResources;
      },

      clearRecentResources: () => {
        set({ recentResources: [] });
      },
    }),
    {
      name: "kubeli-favorites",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        favorites: state.favorites,
        recentResources: state.recentResources,
      }),
    }
  )
);
