import { act } from "@testing-library/react";
import { useFavoritesStore, type FavoriteResource } from "../favorites-store";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("FavoritesStore", () => {
  beforeEach(() => {
    localStorageMock.clear();
    useFavoritesStore.setState({
      favorites: {},
      recentResources: [],
      maxRecentItems: 20,
    });
  });

  describe("initial state", () => {
    it("should have empty favorites", () => {
      expect(useFavoritesStore.getState().favorites).toEqual({});
    });

    it("should have empty recent resources", () => {
      expect(useFavoritesStore.getState().recentResources).toEqual([]);
    });

    it("should have maxRecentItems set to 20", () => {
      expect(useFavoritesStore.getState().maxRecentItems).toBe(20);
    });
  });

  describe("addFavorite", () => {
    it("should add a favorite for a cluster", () => {
      act(() => {
        useFavoritesStore.getState().addFavorite("test-cluster", "pods", "nginx", "default");
      });

      const favorites = useFavoritesStore.getState().favorites["test-cluster"];
      expect(favorites).toHaveLength(1);
      expect(favorites[0].name).toBe("nginx");
      expect(favorites[0].resourceType).toBe("pods");
      expect(favorites[0].namespace).toBe("default");
      expect(favorites[0].clusterContext).toBe("test-cluster");
    });

    it("should not add duplicate favorites", () => {
      act(() => {
        useFavoritesStore.getState().addFavorite("test-cluster", "pods", "nginx", "default");
        useFavoritesStore.getState().addFavorite("test-cluster", "pods", "nginx", "default");
      });

      const favorites = useFavoritesStore.getState().favorites["test-cluster"];
      expect(favorites).toHaveLength(1);
    });

    it("should add favorites to different clusters separately", () => {
      act(() => {
        useFavoritesStore.getState().addFavorite("cluster-1", "pods", "nginx", "default");
        useFavoritesStore.getState().addFavorite("cluster-2", "pods", "nginx", "default");
      });

      expect(useFavoritesStore.getState().favorites["cluster-1"]).toHaveLength(1);
      expect(useFavoritesStore.getState().favorites["cluster-2"]).toHaveLength(1);
    });

    it("should assign order based on position", () => {
      act(() => {
        useFavoritesStore.getState().addFavorite("test-cluster", "pods", "pod-1", "default");
        useFavoritesStore.getState().addFavorite("test-cluster", "pods", "pod-2", "default");
        useFavoritesStore.getState().addFavorite("test-cluster", "pods", "pod-3", "default");
      });

      const favorites = useFavoritesStore.getState().favorites["test-cluster"];
      expect(favorites[0].order).toBe(0);
      expect(favorites[1].order).toBe(1);
      expect(favorites[2].order).toBe(2);
    });

    it("should handle favorites without namespace", () => {
      act(() => {
        useFavoritesStore.getState().addFavorite("test-cluster", "nodes", "node-1");
      });

      const favorites = useFavoritesStore.getState().favorites["test-cluster"];
      expect(favorites[0].namespace).toBeUndefined();
    });
  });

  describe("removeFavorite", () => {
    beforeEach(() => {
      act(() => {
        useFavoritesStore.getState().addFavorite("test-cluster", "pods", "pod-1", "default");
        useFavoritesStore.getState().addFavorite("test-cluster", "pods", "pod-2", "default");
        useFavoritesStore.getState().addFavorite("test-cluster", "pods", "pod-3", "default");
      });
    });

    it("should remove a favorite by id", () => {
      const favorites = useFavoritesStore.getState().favorites["test-cluster"];
      const idToRemove = favorites[1].id;

      act(() => {
        useFavoritesStore.getState().removeFavorite("test-cluster", idToRemove);
      });

      const updatedFavorites = useFavoritesStore.getState().favorites["test-cluster"];
      expect(updatedFavorites).toHaveLength(2);
      expect(updatedFavorites.find((f) => f.id === idToRemove)).toBeUndefined();
    });

    it("should reorder remaining favorites after removal", () => {
      const favorites = useFavoritesStore.getState().favorites["test-cluster"];
      const idToRemove = favorites[0].id;

      act(() => {
        useFavoritesStore.getState().removeFavorite("test-cluster", idToRemove);
      });

      const updatedFavorites = useFavoritesStore.getState().favorites["test-cluster"];
      expect(updatedFavorites[0].order).toBe(0);
      expect(updatedFavorites[1].order).toBe(1);
    });
  });

  describe("reorderFavorites", () => {
    beforeEach(() => {
      act(() => {
        useFavoritesStore.getState().addFavorite("test-cluster", "pods", "pod-1", "default");
        useFavoritesStore.getState().addFavorite("test-cluster", "pods", "pod-2", "default");
        useFavoritesStore.getState().addFavorite("test-cluster", "pods", "pod-3", "default");
      });
    });

    it("should reorder favorites", () => {
      const favorites = useFavoritesStore.getState().favorites["test-cluster"];
      const reordered = [favorites[2], favorites[0], favorites[1]];

      act(() => {
        useFavoritesStore.getState().reorderFavorites("test-cluster", reordered);
      });

      const updatedFavorites = useFavoritesStore.getState().favorites["test-cluster"];
      expect(updatedFavorites[0].name).toBe("pod-3");
      expect(updatedFavorites[1].name).toBe("pod-1");
      expect(updatedFavorites[2].name).toBe("pod-2");
      expect(updatedFavorites[0].order).toBe(0);
      expect(updatedFavorites[1].order).toBe(1);
      expect(updatedFavorites[2].order).toBe(2);
    });
  });

  describe("isFavorite", () => {
    beforeEach(() => {
      act(() => {
        useFavoritesStore.getState().addFavorite("test-cluster", "pods", "nginx", "default");
      });
    });

    it("should return true for existing favorite", () => {
      const result = useFavoritesStore.getState().isFavorite("test-cluster", "pods", "nginx", "default");
      expect(result).toBe(true);
    });

    it("should return false for non-existing favorite", () => {
      const result = useFavoritesStore.getState().isFavorite("test-cluster", "pods", "other", "default");
      expect(result).toBe(false);
    });

    it("should return false for different cluster", () => {
      const result = useFavoritesStore.getState().isFavorite("other-cluster", "pods", "nginx", "default");
      expect(result).toBe(false);
    });

    it("should return false for different namespace", () => {
      const result = useFavoritesStore.getState().isFavorite("test-cluster", "pods", "nginx", "kube-system");
      expect(result).toBe(false);
    });
  });

  describe("getFavorites", () => {
    beforeEach(() => {
      act(() => {
        useFavoritesStore.getState().addFavorite("test-cluster", "pods", "pod-3", "default");
        useFavoritesStore.getState().addFavorite("test-cluster", "pods", "pod-1", "default");
        useFavoritesStore.getState().addFavorite("test-cluster", "pods", "pod-2", "default");
      });
    });

    it("should return favorites sorted by order", () => {
      const favorites = useFavoritesStore.getState().getFavorites("test-cluster");
      expect(favorites[0].name).toBe("pod-3");
      expect(favorites[1].name).toBe("pod-1");
      expect(favorites[2].name).toBe("pod-2");
    });

    it("should return empty array for cluster with no favorites", () => {
      const favorites = useFavoritesStore.getState().getFavorites("other-cluster");
      expect(favorites).toEqual([]);
    });
  });

  describe("addRecentResource", () => {
    it("should add a recent resource", () => {
      act(() => {
        useFavoritesStore.getState().addRecentResource("test-cluster", "pods", "nginx", "default");
      });

      const recent = useFavoritesStore.getState().recentResources;
      expect(recent).toHaveLength(1);
      expect(recent[0].name).toBe("nginx");
      expect(recent[0].resourceType).toBe("pods");
    });

    it("should add to front of list", () => {
      act(() => {
        useFavoritesStore.getState().addRecentResource("test-cluster", "pods", "first", "default");
        useFavoritesStore.getState().addRecentResource("test-cluster", "pods", "second", "default");
      });

      const recent = useFavoritesStore.getState().recentResources;
      expect(recent[0].name).toBe("second");
      expect(recent[1].name).toBe("first");
    });

    it("should move existing resource to front", () => {
      act(() => {
        useFavoritesStore.getState().addRecentResource("test-cluster", "pods", "first", "default");
        useFavoritesStore.getState().addRecentResource("test-cluster", "pods", "second", "default");
        useFavoritesStore.getState().addRecentResource("test-cluster", "pods", "first", "default");
      });

      const recent = useFavoritesStore.getState().recentResources;
      expect(recent).toHaveLength(2);
      expect(recent[0].name).toBe("first");
      expect(recent[1].name).toBe("second");
    });

    it("should limit to maxRecentItems", () => {
      useFavoritesStore.setState({ maxRecentItems: 3 });

      act(() => {
        for (let i = 0; i < 5; i++) {
          useFavoritesStore.getState().addRecentResource("test-cluster", "pods", `pod-${i}`, "default");
        }
      });

      const recent = useFavoritesStore.getState().recentResources;
      expect(recent).toHaveLength(3);
      expect(recent[0].name).toBe("pod-4");
      expect(recent[1].name).toBe("pod-3");
      expect(recent[2].name).toBe("pod-2");
    });
  });

  describe("getRecentResources", () => {
    beforeEach(() => {
      act(() => {
        useFavoritesStore.getState().addRecentResource("cluster-1", "pods", "pod-1", "default");
        useFavoritesStore.getState().addRecentResource("cluster-2", "pods", "pod-2", "default");
        useFavoritesStore.getState().addRecentResource("cluster-1", "deployments", "deploy-1", "default");
      });
    });

    it("should return all recent resources when no cluster specified", () => {
      const recent = useFavoritesStore.getState().getRecentResources();
      expect(recent).toHaveLength(3);
    });

    it("should filter by cluster context", () => {
      const recent = useFavoritesStore.getState().getRecentResources("cluster-1");
      expect(recent).toHaveLength(2);
      expect(recent.every((r) => r.clusterContext === "cluster-1")).toBe(true);
    });

    it("should return empty array for cluster with no recent resources", () => {
      const recent = useFavoritesStore.getState().getRecentResources("other-cluster");
      expect(recent).toEqual([]);
    });
  });

  describe("clearRecentResources", () => {
    beforeEach(() => {
      act(() => {
        useFavoritesStore.getState().addRecentResource("test-cluster", "pods", "pod-1", "default");
        useFavoritesStore.getState().addRecentResource("test-cluster", "pods", "pod-2", "default");
      });
    });

    it("should clear all recent resources", () => {
      act(() => {
        useFavoritesStore.getState().clearRecentResources();
      });

      expect(useFavoritesStore.getState().recentResources).toEqual([]);
    });
  });
});
