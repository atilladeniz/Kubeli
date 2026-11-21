import { act } from "@testing-library/react";
import { countTagUsage, useClusterTagsStore } from "../cluster-tags-store";

const store = () => useClusterTagsStore.getState();
const initial = useClusterTagsStore.getState();

describe("ClusterTagsStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useClusterTagsStore.setState({ tags: initial.tags, assignments: {} });
  });

  it("ships production, staging and integration as built-ins", () => {
    expect(store().tags.map(({ id, color }) => [id, color])).toEqual([
      ["production", "red"],
      ["staging", "amber"],
      ["integration", "blue"],
    ]);
  });

  it("trims names and rejects blank or case-insensitive duplicates", () => {
    let id: string | null = null;
    act(() => {
      id = store().createTag("  qa  ");
    });
    expect(id).toMatch(/^tag-/);
    expect(store().createTag("QA")).toBeNull();
    expect(store().createTag("Production")).toBeNull();
    expect(store().createTag("   ")).toBeNull();
    expect(store().tags.map((tag) => tag.name)).toContain("qa");
  });

  it("keeps assignments when a tag is renamed", () => {
    act(() => {
      const id = store().createTag("qa")!;
      store().toggleTag("cluster-a", id);
      expect(store().renameTag(id, "quality")).toBe(true);
    });
    const [tagId] = store().assignments["cluster-a"];
    expect(store().tags.find((tag) => tag.id === tagId)?.name).toBe("quality");
  });

  it("refuses to rename built-ins or to a taken name", () => {
    act(() => {
      store().createTag("qa");
    });
    const qa = store().tags.find((tag) => tag.name === "qa")!;
    expect(store().renameTag("production", "prod")).toBe(false);
    expect(store().renameTag(qa.id, "staging")).toBe(false);
    expect(store().renameTag(qa.id, " ")).toBe(false);
  });

  it("toggles per cluster, ignores unknown tags and drops empty entries", () => {
    act(() => {
      store().toggleTag("cluster-a", "staging");
      store().toggleTag("cluster-b", "production");
      store().toggleTag("cluster-a", "missing");
      store().toggleTag("cluster-b", "production");
    });
    expect(store().assignments).toEqual({ "cluster-a": ["staging"] });
  });

  it("deletes custom tags everywhere but never built-ins", () => {
    act(() => {
      const id = store().createTag("qa")!;
      store().toggleTag("cluster-a", id);
      store().toggleTag("cluster-b", id);
      store().toggleTag("cluster-b", "production");
      store().deleteTag(id);
      store().deleteTag("production");
    });
    expect(store().tags.some((tag) => tag.name === "qa")).toBe(false);
    expect(store().tags.some((tag) => tag.id === "production")).toBe(true);
    expect(store().assignments).toEqual({ "cluster-b": ["production"] });
  });

  it("recolors any tag and persists tags with assignments", () => {
    act(() => {
      store().setTagColor("production", "pink");
      store().toggleTag("cluster-a", "production");
    });
    const persisted = JSON.parse(localStorage.getItem("kubeli-cluster-tags")!);
    expect(persisted.state.tags[0]).toEqual({ id: "production", name: "production", color: "pink" });
    expect(persisted.state.assignments).toEqual({ "cluster-a": ["production"] });
  });

  it("counts how many clusters use each tag", () => {
    expect(countTagUsage({ a: ["x", "y"], b: ["x"] })).toEqual(
      new Map([["x", 2], ["y", 1]]),
    );
  });
});
