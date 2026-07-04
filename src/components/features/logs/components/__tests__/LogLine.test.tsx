import { render } from "@testing-library/react";
import { LogLine } from "../LogLine";
import { compileRegex } from "../../lib";
import type { LogEntry } from "@/lib/types";

const log = (message: string): LogEntry => ({
  message,
  timestamp: "2024-01-01T10:00:00Z",
  container: "main",
  pod: "test-pod",
  namespace: "default",
});

const renderLine = (message: string, query: string, useRegex: boolean) =>
  render(
    <pre>
      <LogLine
        log={log(message)}
        showTimestamp={false}
        searchQuery={query}
        useRegex={useRegex}
        searchRegex={useRegex ? compileRegex(query) : null}
      />
    </pre>
  );

describe("LogLine highlighting", () => {
  // Regression: compileRegex dropped the "g" flag (correct for .test()
  // filtering), but highlighting reused the same regex with match/split and
  // only marked the first occurrence per line.
  it("highlights every regex match in a line, not just the first", () => {
    const { container } = renderLine("foo bar foo baz foo", "foo", true);
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(3);
  });

  // Regression: string highlighting used regex.test(part) on a "g" regex,
  // whose stateful lastIndex skipped every other match.
  it("highlights every string match in a line", () => {
    const { container } = renderLine("err one err two err three", "err", false);
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(3);
  });
});
