import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagList } from "../TagList";
import { ClusterTagPicker } from "../ClusterTagPicker";
import { useClusterTagsStore } from "@/lib/stores/cluster-tags-store";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

jest.mock("next-intl", () => ({
  useTranslations: () => {
    const translate = (key: string, values?: Record<string, string | number>) =>
      values ? `${key}:${values.index ?? values.color}` : key;
    return translate;
  },
}));

describe("TagList", () => {
  beforeAll(() => {
    global.ResizeObserver = ResizeObserverMock;
  });

  beforeEach(() => {
    localStorage.clear();
    useClusterTagsStore.setState({ customTags: [], assignments: {} });
  });

  it("keeps the menu open for tag selection and closes on outside click", async () => {
    const user = userEvent.setup();
    render(
      <>
        <TagList clusterContext="cluster-a" />
        <ClusterTagPicker
          variant="ghost"
          size="icon-sm"
          className="size-7"
          clusterContext="cluster-a"
        />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "manageClusterTags" }));
    await user.click(
      screen.getByRole("menuitemcheckbox", { name: "integration" }),
    );
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.click(screen.getByRole("menuitemcheckbox", { name: "staging" }));

    expect(useClusterTagsStore.getState().assignments).toEqual({
      "cluster-a": ["integration", "staging"],
    });
    expect(screen.getAllByText("integration")).toHaveLength(2);

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("wraps the tag row and truncates long tag names", () => {
    const longName = "production-environment-with-an-extra-long-name";
    useClusterTagsStore.setState({
      customTags: [
        { id: "custom:long", name: longName, color: "#06b6d4", kind: "custom" },
      ],
      assignments: { "cluster-a": ["custom:long"] },
    });

    const { container } = render(<TagList clusterContext="cluster-a" />);
    const badge = screen.getByText(longName);

    expect(container.firstElementChild).toHaveClass("flex-wrap");
    expect(container.firstElementChild).toHaveClass("justify-end");
    expect(badge).toHaveClass("max-w-32", "truncate");
    expect(badge).toHaveAttribute("title", longName);
  });

  it("keeps the tag dropdown bounded and custom list scrollable", async () => {
    const user = userEvent.setup();
    useClusterTagsStore.setState({
      customTags: [
        { id: "custom:qa", name: "qa", color: "#06b6d4", kind: "custom" },
      ],
      assignments: {},
    });
    render(
      <ClusterTagPicker
        variant="ghost"
        size="icon-sm"
        className="size-7"
        clusterContext="cluster-a"
      />,
    );

    await user.click(screen.getByRole("button", { name: "manageClusterTags" }));
    expect(screen.getByRole("menu")).toHaveClass("max-h-64");
    await user.click(screen.getByRole("menuitem", { name: "manageClusterTags" }));

    expect(screen.getByRole("list")).toHaveClass(
      "max-h-64",
      "overflow-y-auto",
      "p-2",
    );
  });

  it("moves between delete buttons with up and down arrows", async () => {
    const user = userEvent.setup();
    useClusterTagsStore.setState({
      customTags: [
        { id: "custom:qa", name: "qa", color: "#06b6d4", kind: "custom" },
        { id: "custom:ops", name: "ops", color: "#22c55e", kind: "custom" },
      ],
      assignments: {},
    });
    render(
      <ClusterTagPicker
        variant="ghost"
        size="icon-sm"
        className="size-7"
        clusterContext="cluster-a"
      />,
    );

    await user.click(screen.getByRole("button", { name: "manageClusterTags" }));
    await user.click(screen.getByRole("menuitem", { name: "manageClusterTags" }));

    const deleteButtons = screen.getAllByRole("button", {
      name: /deleteClusterTag/,
    });
    expect(deleteButtons[0]).toHaveAttribute("tabindex", "0");
    expect(deleteButtons[1]).toHaveAttribute("tabindex", "-1");

    deleteButtons[0].focus();
    await user.keyboard("{ArrowDown}");
    expect(deleteButtons[1]).toHaveFocus();
    expect(deleteButtons[0]).toHaveAttribute("tabindex", "-1");
    expect(deleteButtons[1]).toHaveAttribute("tabindex", "0");

    await user.keyboard("{ArrowUp}");
    expect(deleteButtons[0]).toHaveFocus();
  });

  it("moves focus to the next tag when deleting and to the name field when empty", async () => {
    const user = userEvent.setup();
    useClusterTagsStore.setState({
      customTags: [
        { id: "custom:qa", name: "qa", color: "#06b6d4", kind: "custom" },
        { id: "custom:ops", name: "ops", color: "#22c55e", kind: "custom" },
      ],
      assignments: {},
    });
    render(
      <ClusterTagPicker
        variant="ghost"
        size="icon-sm"
        className="size-7"
        clusterContext="cluster-a"
      />,
    );

    await user.click(screen.getByRole("button", { name: "manageClusterTags" }));
    await user.click(screen.getByRole("menuitem", { name: "manageClusterTags" }));

    await user.click(screen.getByRole("button", { name: "deleteClusterTag qa" }));
    const opsDeleteButton = screen.getByRole("button", {
      name: "deleteClusterTag ops",
    });
    await waitFor(() => expect(opsDeleteButton).toHaveFocus());

    await user.click(opsDeleteButton);
    await waitFor(() =>
      expect(screen.getByLabelText("clusterTagName")).toHaveFocus(),
    );
  });

  it("creates and assigns a custom tag with its selected color", async () => {
    const user = userEvent.setup();
    render(
      <>
        <TagList clusterContext="cluster-a" />
        <ClusterTagPicker
          variant="ghost"
          size="icon-sm"
          className="size-7"
          clusterContext="cluster-a"
        />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "manageClusterTags" }));
    await user.click(screen.getByRole("menuitem", { name: "manageClusterTags" }));
    fireEvent.change(screen.getByLabelText("clusterTagName"), {
      target: { value: "qa" },
    });
    const secondColor = screen.getByRole("radio", {
      name: "selectClusterTagColorOption:2",
    });
    await user.click(secondColor);
    expect(secondColor).toHaveAttribute("aria-checked", "true");
    expect(secondColor).toHaveFocus();
    await user.keyboard("{ArrowRight>}");
    const thirdColor = screen.getByRole("radio", {
      name: "selectClusterTagColorOption:3",
    });
    await waitFor(() => {
      expect(thirdColor).toHaveFocus();
      expect(thirdColor).toHaveAttribute("aria-checked", "true");
    });
    await user.keyboard("{/ArrowRight}");
    await user.click(
      screen.getByRole("radio", {
        name: "selectClusterTagColorOption:6",
      }),
    );
    await user.click(screen.getByRole("button", { name: "createClusterTag" }));

    expect(useClusterTagsStore.getState().customTags).toEqual([
      { id: "custom:qa", name: "qa", color: "#ec4899", kind: "custom" },
    ]);
    expect(useClusterTagsStore.getState().assignments["cluster-a"]).toEqual([
      "custom:qa",
    ]);
    const tagBadges = screen
      .getAllByText("qa")
      .filter((element) => element.getAttribute("data-slot") === "badge");

    expect(tagBadges).toHaveLength(2);
    for (const badge of tagBadges) {
      expect(badge).toHaveClass("text-foreground");
      expect(badge.getAttribute("style")).toContain(
        "color-mix(in srgb, #ec4899 35%, var(--foreground))",
      );
      expect(badge.style.borderColor).not.toBe("");
      expect(badge.style.backgroundColor).not.toBe("");
    }
  });
});