import { render } from "@testing-library/react";
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
});
