import { render, screen } from "@testing-library/react";
import { ResourceList } from "../ResourceList";
import type { Column } from "../types";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

let mockSearchQuery = "";
jest.mock("@/lib/stores/tabs-store", () => ({
  useTabsStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      activeTabId: "tab-1",
      searchQueries: { "tab-1": mockSearchQuery },
      activeFilters: {},
      setTabSearch: jest.fn(),
      setTabFilter: jest.fn(),
    }),
}));

jest.mock("../components/ResourceListHeader", () => ({
  ResourceListHeader: () => null,
}));

jest.mock("../components/ResourceTable", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  return {
    ResourceTable: ({
      data,
      getRowKey,
    }: {
      data: unknown[];
      getRowKey: (item: unknown) => string;
    }) =>
      React.createElement(
        "div",
        null,
        data.map((item) =>
          React.createElement(
            "div",
            { key: getRowKey(item), "data-testid": "row" },
            getRowKey(item)
          )
        )
      ),
  };
});

interface TestItem {
  uid: string;
  name: string;
  labels: Record<string, string>;
}

const items: TestItem[] = [
  { uid: "uid-a", name: "pod-a", labels: { app: "web" } },
  { uid: "uid-b", name: "pod-b", labels: { app: "api" } },
];

const columnsWithAccessor: Column<TestItem>[] = [
  { key: "name", label: "NAME" },
  {
    key: "labels",
    label: "LABELS",
    getSearchText: (item) =>
      Object.entries(item.labels)
        .map(([k, v]) => `${k}=${v}`)
        .join(", "),
  },
];

const columnsWithoutAccessor: Column<TestItem>[] = [
  { key: "name", label: "NAME" },
  { key: "labels", label: "LABELS" },
];

function renderList(columns: Column<TestItem>[]) {
  return render(
    <ResourceList
      title="Pods"
      data={items}
      columns={columns}
      isLoading={false}
      error={null}
      onRefresh={jest.fn()}
      getRowKey={(item) => item.uid}
    />
  );
}

describe("ResourceList search", () => {
  afterEach(() => {
    mockSearchQuery = "";
  });

  it("matches object cell content via getSearchText", () => {
    // Regression: object values stringify to "[object Object]", so label
    // content was unsearchable without a column-level accessor.
    mockSearchQuery = "app=web";
    renderList(columnsWithAccessor);

    const rows = screen.getAllByTestId("row");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("uid-a");
  });

  it("falls back to matching primitive item fields", () => {
    mockSearchQuery = "pod-b";
    renderList(columnsWithAccessor);

    const rows = screen.getAllByTestId("row");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("uid-b");
  });

  it("does not match object content without getSearchText", () => {
    mockSearchQuery = "app=web";
    renderList(columnsWithoutAccessor);

    expect(screen.queryAllByTestId("row")).toHaveLength(0);
  });

  it("shows all rows when the query is empty", () => {
    renderList(columnsWithAccessor);

    expect(screen.getAllByTestId("row")).toHaveLength(2);
  });
});
