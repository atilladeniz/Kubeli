import { fireEvent, render } from "@testing-library/react";
import { ResourceTable } from "../ResourceTable";
import type { Column, ContextMenuItemDef } from "../../types";

interface Item {
  name: string;
  status: string;
}

const columns: Column<Item>[] = [
  { key: "name", label: "Name" },
  { key: "status", label: "Status" },
];

const makeItems = (count: number): Item[] =>
  Array.from({ length: count }, (_, i) => ({
    name: `pod-${i}`,
    status: "Running",
  }));

const baseProps = {
  columns,
  getRowKey: (item: Item) => item.name,
  sortKey: null,
  sortDirection: "asc" as const,
  onSort: jest.fn(),
  hasBulkActions: false,
  selectedKeys: new Set<string>(),
  allSelected: false,
  someSelected: false,
  onToggleSelectAll: jest.fn(),
  onToggleSelect: jest.fn(),
};

const dataRows = (container: HTMLElement) =>
  container.querySelectorAll("tbody tr[data-slot='table-row']");

beforeEach(() => {
  // jsdom gives every element zero size, so the virtualizer would render
  // nothing. Pretend the scroll container is 600px tall (virtual-core
  // measures the scroll element via offsetWidth/offsetHeight).
  jest
    .spyOn(HTMLElement.prototype, "offsetHeight", "get")
    .mockReturnValue(600);
  jest
    .spyOn(HTMLElement.prototype, "offsetWidth", "get")
    .mockReturnValue(800);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("ResourceTable virtualization", () => {
  it("renders only a small window of a 1000-row dataset", () => {
    const { container } = render(
      <ResourceTable {...baseProps} data={makeItems(1000)} />
    );

    const rows = dataRows(container);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(100);

    // First row is visible, off-screen tail is not mounted.
    expect(container.textContent).toContain("pod-0");
    expect(container.textContent).not.toContain("pod-999");
  });

  it("renders the correct cell content for visible rows", () => {
    const { container } = render(
      <ResourceTable {...baseProps} data={makeItems(3)} />
    );

    const rows = dataRows(container);
    expect(rows).toHaveLength(3);
    const cells = rows[1].querySelectorAll("td");
    expect(cells[0].textContent).toBe("pod-1");
    expect(cells[1].textContent).toBe("Running");
  });

  // Regression: contextMenuItems(item) used to be called for every row on
  // every render, building the full menu definition array eagerly. The menu
  // must now be built lazily, only when a row's context menu opens.
  it("does not build context menu items during initial render", () => {
    const contextMenuItems = jest.fn(
      (item: Item): ContextMenuItemDef[] => [
        { label: `Delete ${item.name}`, onClick: jest.fn() },
      ]
    );

    render(
      <ResourceTable
        {...baseProps}
        data={makeItems(1000)}
        contextMenuItems={contextMenuItems}
      />
    );

    expect(contextMenuItems).not.toHaveBeenCalled();
  });

  // Regression: rows were sized by the flat ROW_HEIGHT estimate only. Rows
  // whose real height differs (PodMetricsCell grows a usage bar and sparkline
  // once metrics arrive) made getTotalSize() wrong, so scrolling to the bottom
  // overshot the real end and snapped back -- visible as jitter. Every row must
  // carry a data-index so the virtualizer can measure it and correct the size.
  it("marks every rendered row with its data index for measurement", () => {
    const { container } = render(
      <ResourceTable {...baseProps} data={makeItems(1000)} />
    );

    const rows = dataRows(container);
    expect(rows.length).toBeGreaterThan(0);

    const indices = Array.from(rows, (row) =>
      row.getAttribute("data-index")
    );
    expect(indices.every((i) => i !== null)).toBe(true);

    // Indices are the real positions in `data`, contiguous and ascending --
    // measurements would be attributed to the wrong rows otherwise.
    const numeric = indices.map(Number);
    expect(numeric).toEqual(
      Array.from({ length: numeric.length }, (_, i) => numeric[0] + i)
    );
  });
});

describe("ResourceTable keyboard navigation", () => {
  const grid = (container: HTMLElement) =>
    container.querySelector("[role='grid']") as HTMLElement;

  const focusedRow = (container: HTMLElement) =>
    container.querySelector("tbody tr[data-focused]") as HTMLElement | null;

  const press = (container: HTMLElement, key: string) =>
    fireEvent.keyDown(grid(container), { key });

  it("exposes the grid as a single tab stop", () => {
    const { container } = render(<ResourceTable {...baseProps} data={makeItems(5)} />);

    expect(grid(container)).toHaveAttribute("tabindex", "0");
    // Per-row tab stops would put thousands of entries in the tab order
    const rowTabStops = container.querySelectorAll("tbody tr[tabindex]");
    expect(rowTabStops).toHaveLength(0);
  });

  it("enters at the first row and steps with the arrow keys", () => {
    const { container } = render(<ResourceTable {...baseProps} data={makeItems(5)} />);

    expect(focusedRow(container)).toBeNull();

    press(container, "ArrowDown");
    expect(focusedRow(container)?.textContent).toContain("pod-0");

    press(container, "ArrowDown");
    expect(focusedRow(container)?.textContent).toContain("pod-1");

    press(container, "ArrowUp");
    expect(focusedRow(container)?.textContent).toContain("pod-0");
  });

  it("does not move past the first row", () => {
    const { container } = render(<ResourceTable {...baseProps} data={makeItems(5)} />);

    press(container, "ArrowDown");
    press(container, "ArrowUp");
    press(container, "ArrowUp");
    expect(focusedRow(container)?.textContent).toContain("pod-0");
  });

  it("jumps to the first row with Home", () => {
    const { container } = render(<ResourceTable {...baseProps} data={makeItems(20)} />);

    press(container, "ArrowDown");
    press(container, "ArrowDown");
    press(container, "ArrowDown");
    press(container, "Home");
    expect(focusedRow(container)?.textContent).toContain("pod-0");
  });

  it("points aria-activedescendant at the focused row", () => {
    const { container } = render(<ResourceTable {...baseProps} data={makeItems(5)} />);

    press(container, "ArrowDown");
    const active = grid(container).getAttribute("aria-activedescendant");
    expect(active).toBe("row-pod-0");
    expect(focusedRow(container)).toHaveAttribute("id", active!);
  });

  it("opens the focused row with Enter", () => {
    const onRowClick = jest.fn();
    const { container } = render(
      <ResourceTable {...baseProps} data={makeItems(5)} onRowClick={onRowClick} />
    );

    press(container, "Enter");
    expect(onRowClick).not.toHaveBeenCalled();

    press(container, "ArrowDown");
    press(container, "ArrowDown");
    press(container, "Enter");
    expect(onRowClick).toHaveBeenCalledWith({ name: "pod-1", status: "Running" });
  });

  it("ignores the keys while the user is typing", () => {
    const onRowClick = jest.fn();
    const { container } = render(
      <ResourceTable {...baseProps} data={makeItems(5)} onRowClick={onRowClick} />
    );

    const input = document.createElement("input");
    grid(container).appendChild(input);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(focusedRow(container)).toBeNull();

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("focuses the row that was clicked", () => {
    const onRowClick = jest.fn();
    const { container } = render(
      <ResourceTable {...baseProps} data={makeItems(5)} onRowClick={onRowClick} />
    );

    const rows = dataRows(container);
    fireEvent.click(rows[2]);

    expect(focusedRow(container)?.textContent).toContain("pod-2");

    // Arrow keys continue from the clicked row
    press(container, "ArrowDown");
    expect(focusedRow(container)?.textContent).toContain("pod-3");
  });

  it("keeps the focus on the same resource when rows reorder", () => {
    const items = makeItems(5);
    const { container, rerender } = render(
      <ResourceTable {...baseProps} data={items} />
    );

    press(container, "ArrowDown");
    press(container, "ArrowDown");
    expect(focusedRow(container)?.textContent).toContain("pod-1");

    // A watch update moves pod-1 to the front
    const reordered = [items[1], items[0], ...items.slice(2)];
    rerender(<ResourceTable {...baseProps} data={reordered} />);

    expect(focusedRow(container)?.textContent).toContain("pod-1");
    expect(focusedRow(container)?.getAttribute("data-index")).toBe("0");
  });

  it("keeps a position when the focused row is deleted", () => {
    const items = makeItems(5);
    const { container, rerender } = render(
      <ResourceTable {...baseProps} data={items} />
    );

    press(container, "ArrowDown");
    press(container, "ArrowDown");
    expect(focusedRow(container)?.textContent).toContain("pod-1");

    rerender(
      <ResourceTable {...baseProps} data={items.filter((i) => i.name !== "pod-1")} />
    );

    // Focus does not jump back to the top of the list
    expect(focusedRow(container)?.textContent).toContain("pod-2");
  });

  it("clears the focus when the table empties", () => {
    const { container, rerender } = render(
      <ResourceTable {...baseProps} data={makeItems(5)} />
    );

    press(container, "ArrowDown");
    expect(focusedRow(container)).not.toBeNull();

    rerender(<ResourceTable {...baseProps} data={[]} />);
    expect(focusedRow(container)).toBeNull();
    expect(grid(container).getAttribute("aria-activedescendant")).toBeNull();
  });
});
