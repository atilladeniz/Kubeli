import { render } from "@testing-library/react";
import { LogContent } from "../LogContent";
import type { LogEntry } from "@/lib/types";

const makeLogs = (count: number): LogEntry[] =>
  Array.from({ length: count }, (_, i) => ({
    message: `log line ${i}`,
    timestamp: "2024-01-01T10:00:00Z",
    container: "main",
    pod: "test-pod",
    namespace: "default",
    seq: i,
  }));

const renderContent = (logs: LogEntry[]) =>
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
});
