import { stripAnsi, hasAnsiCodes, parseAnsi } from "../ansi";

const ESC = "\x1b";

describe("hasAnsiCodes", () => {
  it("detects escape sequences", () => {
    expect(hasAnsiCodes(`${ESC}[31mred${ESC}[0m`)).toBe(true);
  });

  it("returns false for plain text", () => {
    expect(hasAnsiCodes("plain log line")).toBe(false);
    // A literal bracket is not an escape
    expect(hasAnsiCodes("[31m not an escape")).toBe(false);
  });
});

describe("stripAnsi", () => {
  it("removes color codes and keeps the text", () => {
    expect(stripAnsi(`${ESC}[31mERROR${ESC}[0m connection refused`)).toBe(
      "ERROR connection refused"
    );
  });

  it("removes non-SGR sequences like cursor moves and erases", () => {
    expect(stripAnsi(`${ESC}[2K${ESC}[1Gprogress`)).toBe("progress");
  });

  it("leaves plain text untouched", () => {
    expect(stripAnsi("nothing to strip")).toBe("nothing to strip");
  });

  it("handles truecolor sequences", () => {
    expect(stripAnsi(`${ESC}[38;2;255;100;0mwarn${ESC}[0m`)).toBe("warn");
  });

  it.each([
    ["BEL", `${ESC}]8;;https://example.com\x07link${ESC}]8;;\x07`],
    ["ST", `${ESC}]8;;https://example.com${ESC}\\link${ESC}]8;;${ESC}\\`],
  ])("removes OSC hyperlinks terminated by %s", (_terminator, text) => {
    expect(stripAnsi(text)).toBe("link");
  });

  it("removes an unterminated OSC sequence instead of leaking control text", () => {
    expect(stripAnsi(`${ESC}]8;;https://example.com`)).toBe("");
  });
});

describe("parseAnsi", () => {
  it("returns one unstyled segment for plain text", () => {
    expect(parseAnsi("hello")).toEqual([{ text: "hello", style: {}, start: 0 }]);
  });

  it("splits on color changes and tracks stripped offsets", () => {
    const segments = parseAnsi(`plain ${ESC}[31mred${ESC}[0m tail`);
    expect(segments.map((s) => s.text)).toEqual(["plain ", "red", " tail"]);
    // Offsets index into the stripped text "plain red tail"
    expect(segments.map((s) => s.start)).toEqual([0, 6, 9]);
    expect(segments[1].style.color).toBe("#cd3131");
    expect(segments[2].style.color).toBeUndefined();
  });

  it("keeps offsets aligned with stripAnsi output", () => {
    const raw = `${ESC}[1;33mWARN${ESC}[0m disk ${ESC}[31m91%${ESC}[0m full`;
    const segments = parseAnsi(raw);
    const plain = stripAnsi(raw);

    expect(segments.map((s) => s.text).join("")).toBe(plain);
    for (const segment of segments) {
      expect(plain.slice(segment.start, segment.start + segment.text.length)).toBe(
        segment.text
      );
    }
  });

  it("accumulates attributes until reset", () => {
    const [, styled] = parseAnsi(`a${ESC}[1m${ESC}[4mbold-underline`);
    expect(styled.style.fontWeight).toBe("bold");
    expect(styled.style.textDecoration).toBe("underline");
  });

  it("clears individual attributes without dropping the rest", () => {
    const segments = parseAnsi(`${ESC}[1;31mboth${ESC}[22mred-only`);
    const last = segments[segments.length - 1];
    expect(last.style.fontWeight).toBeUndefined();
    expect(last.style.color).toBe("#cd3131");
  });

  it("maps dim to reduced opacity", () => {
    const [, dim] = parseAnsi(`x${ESC}[2mfaint`);
    expect(dim.style.opacity).toBe(0.6);
  });

  it("resolves 256-color indices", () => {
    const [, cube] = parseAnsi(`x${ESC}[38;5;196mbright`);
    expect(cube.style.color).toBe("rgb(255, 0, 0)");

    const [, gray] = parseAnsi(`x${ESC}[38;5;244mgray`);
    expect(gray.style.color).toBe("rgb(128, 128, 128)");
  });

  it("resolves truecolor", () => {
    const [, rgb] = parseAnsi(`x${ESC}[38;2;12;34;56mcustom`);
    expect(rgb.style.color).toBe("rgb(12, 34, 56)");
  });

  it("applies background colors", () => {
    const [, bg] = parseAnsi(`x${ESC}[41mon-red`);
    expect(bg.style.backgroundColor).toBe("#cd3131");
  });

  it("uses bright variants for the 90-97 range", () => {
    const [, bright] = parseAnsi(`x${ESC}[91mbright-red`);
    expect(bright.style.color).toBe("#f14c4c");
  });

  it("treats a bare ESC[m as a full reset", () => {
    const segments = parseAnsi(`${ESC}[31mred${ESC}[mplain`);
    expect(segments[segments.length - 1].style).toEqual({});
  });

  it("drops non-SGR sequences without splitting the text", () => {
    const segments = parseAnsi(`before${ESC}[2Kafter`);
    expect(segments.map((s) => s.text).join("")).toBe("beforeafter");
    expect(segments.every((s) => Object.keys(s.style).length === 0)).toBe(true);
  });

  it("drops OSC hyperlinks while preserving SGR styles and offsets", () => {
    const raw = `${ESC}]8;;https://example.com\x07${ESC}[31mlink${ESC}[0m${ESC}]8;;\x07 tail`;
    const segments = parseAnsi(raw);
    const plain = stripAnsi(raw);

    expect(plain).toBe("link tail");
    expect(segments.map((segment) => segment.text).join("")).toBe(plain);
    expect(segments[0].style.color).toBe("#cd3131");
    expect(segments.map((segment) => segment.start)).toEqual([0, 4]);
  });

  it("survives a malformed extended color sequence", () => {
    // 38 with no mode byte following
    const segments = parseAnsi(`x${ESC}[38mtail`);
    expect(segments.map((s) => s.text).join("")).toBe("xtail");
  });
});
