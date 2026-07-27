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

const renderLine = (
  message: string,
  query: string,
  useRegex: boolean,
  extraProps: Partial<React.ComponentProps<typeof LogLine>> = {}
) =>
  render(
    <pre>
      <LogLine
        log={log(message)}
        showTimestamp={false}
        searchQuery={query}
        useRegex={useRegex}
        searchRegex={useRegex ? compileRegex(query) : null}
        {...extraProps}
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

  // Regression: split() with user capture groups injected the captures into
  // the parts array, duplicating text and marking the wrong spans.
  it("handles regex patterns with capture groups without corrupting the text", () => {
    const { container } = renderLine("x ERROR y WARN z", "(ERROR|WARN)", true);
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(2);
    expect(marks[0].textContent).toBe("ERROR");
    expect(marks[1].textContent).toBe("WARN");
    expect(container.textContent).toBe("x ERROR y WARN z\n");
  });
});

const ESC = "\x1b";

describe("LogLine ANSI rendering", () => {
  it("renders escape codes as styles instead of literal text", () => {
    const { container } = renderLine(`${ESC}[31mERROR${ESC}[0m refused`, "", false);

    expect(container.textContent).toBe("ERROR refused\n");
    const colored = container.querySelector("span[style]");
    expect(colored).toHaveStyle({ color: "#cd3131" });
    expect(colored?.textContent).toBe("ERROR");
  });

  it("strips codes without styling when ansiColors is off", () => {
    const { container } = renderLine(`${ESC}[31mERROR${ESC}[0m refused`, "", false, {
      ansiColors: false,
    });

    expect(container.textContent).toBe("ERROR refused\n");
    expect(container.querySelector("span[style]")).toBeNull();
  });

  it("applies bold and underline", () => {
    const { container } = renderLine(`${ESC}[1;4mheading`, "", false);
    const styled = container.querySelector("span[style]");
    expect(styled).toHaveStyle({ fontWeight: "bold", textDecoration: "underline" });
  });

  // The two features slice the same message on different boundaries: ANSI by
  // style runs, search by match. Both must survive.
  it("highlights a search match inside a colored segment", () => {
    const { container } = renderLine(
      `${ESC}[31mconnection refused${ESC}[0m ok`,
      "refused",
      false
    );

    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe("refused");
    expect(container.textContent).toBe("connection refused ok\n");
  });

  it("splits a match that spans a color change, keeping both styles", () => {
    // "error" starts in the red run and finishes in the plain one
    const { container } = renderLine(`${ESC}[31merr${ESC}[0mor here`, "error", false);

    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(2);
    expect(Array.from(marks, (m) => m.textContent).join("")).toBe("error");
    expect(container.textContent).toBe("error here\n");
  });

  it("matches search against stripped text, so codes cannot hide a phrase", () => {
    // An escape sits in the middle of the searched phrase
    const { container } = renderLine(`conn${ESC}[31mection`, "connection", false);

    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBeGreaterThan(0);
    expect(Array.from(marks, (m) => m.textContent).join("")).toBe("connection");
  });

  it("highlights regex matches across colored segments", () => {
    const { container } = renderLine(
      `${ESC}[31mERROR${ESC}[0m x ${ESC}[33mWARN${ESC}[0m`,
      "(ERROR|WARN)",
      true
    );

    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(2);
    expect(container.textContent).toBe("ERROR x WARN\n");
  });

  it("detects the log level through leading escape codes", () => {
    // Without stripping, \b before "ERROR" never matches after "[31m"
    const { container } = renderLine(`${ESC}[31mERROR${ESC}[0m boom`, "", false);
    // Level coloring yields to ANSI, so the wrapper stays neutral
    expect(container.querySelector(".text-destructive")).toBeNull();
    expect(container.textContent).toBe("ERROR boom\n");
  });

  it("keeps level-based coloring for lines without escape codes", () => {
    const { container } = renderLine("ERROR plain line", "", false);
    expect(container.querySelector(".text-destructive")).not.toBeNull();
  });
});
