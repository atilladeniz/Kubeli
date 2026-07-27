import { render } from "@testing-library/react";
import { LogContent } from "../LogContent";
import type { PodColorEntry } from "@/lib/hooks/useWorkloadLogs";
import type { LogEntry } from "@/lib/types";

const makeLogs = (count: number, pod = "test-pod"): LogEntry[] =>
  Array.from({ length: count }, (_, i) => ({
    message: `log line ${i}`,
    timestamp: "2024-01-01T10:00:00Z",
    container: "main",
    pod,
    namespace: "default",
    seq: i,
  }));

const renderContent = (
  logs: LogEntry[],
  extraProps: Partial<React.ComponentProps<typeof LogContent>> = {}
) =>
  render(
    <LogContent
      logs={logs}
      isLoading={false}
      searchQuery=""
      showTimestamps={false}
      useRegex={false}
      searchRegex={null}
      onScroll={jest.fn()}
      onStartStream={jest.fn()}
      loadingText="Loading"
      searchingText="No matches"
      noLogsText="No logs"
      followText="Follow"
      copyLabel="Copy"
      copiedLabel="Copied"
      {...extraProps}
    />
  );

describe("LogContent virtualization", () => {
  beforeEach(() => {
    // jsdom reports zero-size elements; give the virtualizer a real viewport
    // (scroll container) and a fixed line height (leading-5 = 20px).
    // @tanstack/virtual-core measures via offsetWidth/offsetHeight.
    jest
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockImplementation(function (this: HTMLElement) {
        return this.hasAttribute("data-index") ? 20 : 600;
      });
    jest.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(800);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders only a subset of 5000 log entries", () => {
    const { container } = renderContent(makeLogs(5000));
    const lines = container.querySelectorAll("[data-index]");
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThan(200);
  });

  it("shows the correct messages for visible lines", () => {
    const { container } = renderContent(makeLogs(5000));
    const lines = container.querySelectorAll("[data-index]");
    lines.forEach((line) => {
      const index = Number(line.getAttribute("data-index"));
      expect(line.textContent).toBe(`log line ${index}\n`);
    });
    // Viewport starts at the top, so line 0 is visible and the tail is not.
    expect(container.textContent).toContain("log line 0");
    expect(container.textContent).not.toContain("log line 4999");
  });

  it("sizes the inner container to the total virtual height", () => {
    const { container } = renderContent(makeLogs(5000));
    const inner = container.querySelector("pre");
    // 5000 lines * 20px per line
    expect(inner?.style.height).toBe(`${5000 * 20}px`);
  });

  it("renders the empty state without a virtual container", () => {
    const { container, getByText } = renderContent([]);
    expect(container.querySelector("pre")).toBeNull();
    expect(getByText("No logs")).toBeInTheDocument();
  });

  it("hides the Follow button when streaming is disabled", () => {
    const { queryByText } = renderContent([], { streamDisabled: true });
    expect(queryByText("Follow")).toBeNull();
  });
});

describe("LogContent aggregated (multi-pod) mode", () => {
  beforeEach(() => {
    jest
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockImplementation(function (this: HTMLElement) {
        return this.hasAttribute("data-index") ? 20 : 600;
      });
    jest.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(800);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const podColorMap = new Map<string, PodColorEntry>([
    ["demo-web-7d4b8c-abcde", { text: "text-blue-400", bg: "bg-blue-400" }],
  ]);

  it("prefixes lines with a shortened, color-coded pod name", () => {
    const { container } = renderContent(makeLogs(3, "demo-web-7d4b8c-abcde"), {
      podColorMap,
    });
    const firstLine = container.querySelector("[data-index]");
    // Last two name segments only, full name kept in the title attribute.
    expect(firstLine?.textContent).toBe("[7d4b8c-abcde]log line 0\n");
    const prefix = firstLine?.querySelector("span[title]");
    expect(prefix).toHaveAttribute("title", "demo-web-7d4b8c-abcde");
    expect(prefix?.className).toContain("text-blue-400");
  });

  it("omits the pod prefix when no color map is given", () => {
    const { container } = renderContent(makeLogs(3, "demo-web-7d4b8c-abcde"));
    const firstLine = container.querySelector("[data-index]");
    expect(firstLine?.textContent).toBe("log line 0\n");
    expect(firstLine?.querySelector("span[title]")).toBeNull();
  });

  it("falls back to the plain pod name for names with two or fewer segments", () => {
    const shortNameMap = new Map<string, PodColorEntry>([
      ["db-0", { text: "text-green-400", bg: "bg-green-400" }],
    ]);
    const { container } = renderContent(makeLogs(1, "db-0"), {
      podColorMap: shortNameMap,
    });
    expect(container.querySelector("[data-index]")?.textContent).toBe("[db-0]log line 0\n");
  });
});
