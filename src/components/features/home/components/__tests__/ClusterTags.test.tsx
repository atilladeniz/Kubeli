import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClusterTags } from "../ClusterTags";
import { matchesClusterFilter, pruneTagFilter, UNTAGGED } from "../ClusterTagFilter";
import { useClusterTagsStore } from "@/lib/stores/cluster-tags-store";
import type { Cluster } from "@/lib/types";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values?.name ? `${key}:${values.name}` : key,
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const initial = useClusterTagsStore.getState();
const CONTEXT = "cluster-a";

beforeAll(() => {
  global.ResizeObserver = ResizeObserverMock;
  Element.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  localStorage.clear();
  useClusterTagsStore.setState({ tags: initial.tags, assignments: {} });
});

describe("ClusterTags", () => {
  it("shows at most three chips and collapses the rest into +n", () => {
    const ids = ["production", "staging", "integration"];
    for (const name of ["qa", "gpu"]) ids.push(useClusterTagsStore.getState().createTag(name)!);
    useClusterTagsStore.setState({ assignments: { [CONTEXT]: ids } });

    render(<ClusterTags clusterContext={CONTEXT} />);

    expect(screen.getByText("production")).toBeInTheDocument();
    expect(screen.queryByText("qa")).not.toBeInTheDocument();
    expect(screen.getByText("+2")).toHaveAttribute("title", "qa, gpu");
  });

  it("labels the trigger 'Add tag' only while the cluster has no tags", () => {
    const { rerender } = render(<ClusterTags clusterContext={CONTEXT} />);
    expect(screen.getByRole("button", { name: "editClusterTags" })).toHaveTextContent("addClusterTag");

    useClusterTagsStore.setState({ assignments: { [CONTEXT]: ["staging"] } });
    rerender(<ClusterTags clusterContext={CONTEXT} />);
    expect(screen.getByRole("button", { name: "editClusterTags" })).not.toHaveTextContent("addClusterTag");
  });

  it("toggles tags and keeps the popover open", async () => {
    const user = userEvent.setup();
    render(<ClusterTags clusterContext={CONTEXT} />);

    await user.click(screen.getByRole("button", { name: "editClusterTags" }));
    await user.click(screen.getByRole("option", { name: /staging/ }));
    await user.click(screen.getByRole("option", { name: /production/ }));

    expect(useClusterTagsStore.getState().assignments[CONTEXT]).toEqual(["staging", "production"]);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("creates and assigns an unknown name on Enter, even if it fuzzy-matches an existing tag", async () => {
    const user = userEvent.setup();
    render(<ClusterTags clusterContext={CONTEXT} />);

    await user.click(screen.getByRole("button", { name: "editClusterTags" }));
    // "prd" fuzzy-matches "production"; Enter must still create "prd".
    await user.type(screen.getByPlaceholderText("searchOrCreateTag"), "prd{Enter}");

    const { tags, assignments } = useClusterTagsStore.getState();
    const created = tags.find((tag) => tag.name === "prd");
    expect(created).toBeDefined();
    expect(assignments[CONTEXT]).toEqual([created!.id]);
  });

  it("renames inline in edit mode and deletes after confirming", async () => {
    const user = userEvent.setup();
    const id = useClusterTagsStore.getState().createTag("qa")!;
    useClusterTagsStore.getState().toggleTag(CONTEXT, id);
    render(<ClusterTags clusterContext={CONTEXT} />);

    await user.click(screen.getByRole("button", { name: "editClusterTags" }));
    await user.click(screen.getByRole("option", { name: /manageClusterTags/ }));

    const input = screen.getByDisplayValue("qa");
    await user.clear(input);
    await user.type(input, "quality{Enter}");
    expect(useClusterTagsStore.getState().tags.find((tag) => tag.id === id)?.name).toBe("quality");

    await user.click(screen.getByRole("button", { name: "deleteClusterTagNamed:quality" }));
    const confirm = screen.getByText(/deleteClusterTagConfirm/).closest("li")!;
    await user.click(within(confirm).getByRole("button", { name: "deleteClusterTag" }));

    expect(useClusterTagsStore.getState().tags.some((tag) => tag.id === id)).toBe(false);
    expect(useClusterTagsStore.getState().assignments).toEqual({});
  });

  it("creates a tag from the edit view and rejects duplicates there", async () => {
    const user = userEvent.setup();
    render(<ClusterTags clusterContext={CONTEXT} />);

    await user.click(screen.getByRole("button", { name: "editClusterTags" }));
    await user.click(screen.getByRole("option", { name: /manageClusterTags/ }));
    const input = screen.getByPlaceholderText("newTagPlaceholder");

    await user.type(input, "Staging");
    expect(screen.getByRole("button", { name: "addClusterTag" })).toBeDisabled();

    await user.clear(input);
    await user.type(input, "qa{Enter}");
    expect(useClusterTagsStore.getState().tags.some((tag) => tag.name === "qa")).toBe(true);
    expect(screen.getByDisplayValue("qa")).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("restores the old name when a rename collides", async () => {
    const user = userEvent.setup();
    useClusterTagsStore.getState().createTag("qa");
    render(<ClusterTags clusterContext={CONTEXT} />);

    await user.click(screen.getByRole("button", { name: "editClusterTags" }));
    await user.click(screen.getByRole("option", { name: /manageClusterTags/ }));
    const input = screen.getByDisplayValue("qa");
    await user.clear(input);
    await user.type(input, "Staging");
    expect(input).toHaveAttribute("aria-invalid", "true");
    await user.tab();

    expect(input).toHaveValue("qa");
    expect(useClusterTagsStore.getState().tags.some((tag) => tag.name === "qa")).toBe(true);
  });
});

describe("keyboard focus", () => {
  it("stays inside the popover across edit mode, delete confirm and back", async () => {
    const user = userEvent.setup();
    useClusterTagsStore.getState().createTag("qa");
    render(<ClusterTags clusterContext={CONTEXT} />);
    const inPopover = () =>
      expect(document.activeElement?.closest("[data-slot=popover-content]")).not.toBeNull();

    await user.tab();
    await user.keyboard("{Enter}");
    expect(screen.getByPlaceholderText("searchOrCreateTag")).toHaveFocus();

    // Last item is "Edit tags…"
    await user.keyboard("{End}{Enter}");
    expect(screen.getByRole("button", { name: "back" })).toHaveFocus();

    screen.getByRole("button", { name: "deleteClusterTagNamed:qa" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "cancel" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "deleteClusterTagNamed:qa" })).toHaveFocus();

    await user.keyboard("{Enter}");
    await user.tab();
    expect(screen.getByRole("button", { name: "deleteClusterTag" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "back" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getByPlaceholderText("searchOrCreateTag")).toHaveFocus();
    inPopover();
  });
});

describe("pruneTagFilter", () => {
  const clusters = [{ context: "a" }, { context: "b" }] as Cluster[];

  it("drops tags no cluster carries and untagged when every cluster has tags", () => {
    expect(pruneTagFilter(["x", "gone", UNTAGGED], clusters, { a: ["x"] })).toEqual(["x", UNTAGGED]);
    expect(pruneTagFilter(["x", UNTAGGED], clusters, { a: ["x"], b: ["y"] })).toEqual(["x"]);
    expect(pruneTagFilter([], clusters, {})).toEqual([]);
  });
});

describe("matchesClusterFilter", () => {
  const cluster = { name: "prod-eu", context: "arn:prod-eu" } as Cluster;

  it("matches search against name, context and tag names", () => {
    expect(matchesClusterFilter(cluster, [], [], [], "eu")).toBe(true);
    expect(matchesClusterFilter(cluster, ["t1"], ["payments"], [], "pay")).toBe(true);
    expect(matchesClusterFilter(cluster, [], [], [], "pay")).toBe(false);
  });

  it("ORs selected tags and supports the untagged option", () => {
    expect(matchesClusterFilter(cluster, ["a"], ["a"], ["a", "b"], "")).toBe(true);
    expect(matchesClusterFilter(cluster, ["c"], ["c"], ["a", "b"], "")).toBe(false);
    expect(matchesClusterFilter(cluster, [], [], [UNTAGGED], "")).toBe(true);
    expect(matchesClusterFilter(cluster, ["a"], ["a"], [UNTAGGED], "")).toBe(false);
  });
});
