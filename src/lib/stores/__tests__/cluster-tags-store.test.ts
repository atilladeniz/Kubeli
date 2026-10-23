import { act } from "@testing-library/react";
import {
  BUILT_IN_CLUSTER_TAGS,
  useClusterTagsStore,
} from "../cluster-tags-store";

describe("ClusterTagsStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useClusterTagsStore.setState({ customTags: [], assignments: {} });
  });

  it("provides fixed colors for the built-in tags", () => {
    expect(BUILT_IN_CLUSTER_TAGS.map(({ id, color }) => [id, color])).toEqual([
      ["integration", "#3b82f6"],
      ["staging", "#f59e0b"],
      ["production", "#ef4444"],
    ]);
  });

  it("trims custom names and rejects blank or duplicate names", () => {
    let tagId: string | null = null;
    act(() => {
      tagId = useClusterTagsStore.getState().addCustomTag("  qa  ", "#06b6d4");
      useClusterTagsStore.getState().addCustomTag("QA", "#ec4899");
      useClusterTagsStore.getState().addCustomTag("  ", "#ec4899");
    });

    expect(tagId).toBe("custom:qa");
    expect(useClusterTagsStore.getState().customTags).toEqual([
      { id: "custom:qa", name: "qa", color: "#06b6d4", kind: "custom" },
    ]);
  });

  it("keeps assignments separate by cluster and ignores unknown tags", () => {
    act(() => {
      useClusterTagsStore.getState().toggleTagAssignment("cluster-a", "staging");
      useClusterTagsStore.getState().toggleTagAssignment("cluster-b", "production");
      useClusterTagsStore.getState().toggleTagAssignment("cluster-a", "missing");
    });

    expect(useClusterTagsStore.getState().assignments).toEqual({
      "cluster-a": ["staging"],
      "cluster-b": ["production"],
    });
  });

  it("removes a custom tag from every cluster when deleted", () => {
    let tagId: string | null = null;
    act(() => {
      tagId = useClusterTagsStore.getState().addCustomTag("qa", "#06b6d4");
      useClusterTagsStore.getState().toggleTagAssignment("cluster-a", tagId!);
      useClusterTagsStore.getState().toggleTagAssignment("cluster-b", tagId!);
      useClusterTagsStore.getState().toggleTagAssignment("cluster-a", "staging");
      useClusterTagsStore.getState().removeCustomTag(tagId!);
    });

    expect(useClusterTagsStore.getState().customTags).toEqual([]);
    expect(useClusterTagsStore.getState().assignments).toEqual({
      "cluster-a": ["staging"],
    });
  });

  it("persists custom definitions and assignments", async () => {
    act(() => {
      const tagId = useClusterTagsStore.getState().addCustomTag("qa", "#06b6d4");
      useClusterTagsStore.getState().toggleTagAssignment("cluster-a", tagId!);
    });

    await act(async () => {
      await useClusterTagsStore.persist.rehydrate();
    });

    expect(useClusterTagsStore.getState().customTags).toEqual([
      { id: "custom:qa", name: "qa", color: "#06b6d4", kind: "custom" },
    ]);
    expect(useClusterTagsStore.getState().assignments).toEqual({
      "cluster-a": ["custom:qa"],
    });
  });
});