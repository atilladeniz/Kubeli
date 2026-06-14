import { computeSideBySideDiff } from "../text-diff";

describe("computeSideBySideDiff", () => {
  it("marks identical text as fully equal with no changes", () => {
    const text = "line a\nline b\nline c";
    const { rows, stats } = computeSideBySideDiff(text, text);

    expect(stats).toEqual({ additions: 0, deletions: 0 });
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.left?.type).toBe("equal");
      expect(row.right?.type).toBe("equal");
      expect(row.left?.segments.every((s) => !s.changed)).toBe(true);
    }
  });

  it("pairs a modified line and highlights only the changed words", () => {
    const { rows, stats } = computeSideBySideDiff(
      '"targetRevision": "v1.0.0"',
      '"targetRevision": "v1.1.0"',
    );

    expect(stats).toEqual({ additions: 1, deletions: 1 });
    expect(rows).toHaveLength(1);

    const row = rows[0];
    expect(row.left?.type).toBe("removed");
    expect(row.right?.type).toBe("added");

    // The unchanged key stays unhighlighted; only the value token differs.
    const leftChanged = row.left!.segments.filter((s) => s.changed);
    const rightChanged = row.right!.segments.filter((s) => s.changed);
    expect(leftChanged.map((s) => s.text).join("")).toContain("v1.0.0");
    expect(rightChanged.map((s) => s.text).join("")).toContain("v1.1.0");
    expect(row.left!.segments.some((s) => !s.changed)).toBe(true);
  });

  it("places a pure insertion on the right side with an empty left cell", () => {
    const { rows, stats } = computeSideBySideDiff("a\nb", "a\nb\nc");

    expect(stats).toEqual({ additions: 1, deletions: 0 });
    const added = rows.find((r) => r.right?.type === "added");
    expect(added).toBeDefined();
    expect(added!.left).toBeNull();
    expect(added!.right!.segments.map((s) => s.text).join("")).toBe("c");
    // Pure additions rely on the line background, not word-level pills.
    expect(added!.right!.segments.every((s) => !s.changed)).toBe(true);
  });

  it("places a pure deletion on the left side with an empty right cell", () => {
    const { rows, stats } = computeSideBySideDiff("a\nb\nc", "a\nc");

    expect(stats).toEqual({ additions: 0, deletions: 1 });
    const removed = rows.find((r) => r.left?.type === "removed");
    expect(removed).toBeDefined();
    expect(removed!.right).toBeNull();
    expect(removed!.left!.segments.map((s) => s.text).join("")).toBe("b");
    expect(removed!.left!.segments.every((s) => !s.changed)).toBe(true);
  });

  it("assigns independent, monotonic line numbers per side", () => {
    const { rows } = computeSideBySideDiff("a\nb\nc", "a\nx\nc");

    const leftNums = rows
      .map((r) => r.left?.lineNumber)
      .filter((n): n is number => n != null);
    const rightNums = rows
      .map((r) => r.right?.lineNumber)
      .filter((n): n is number => n != null);

    expect(leftNums).toEqual([1, 2, 3]);
    expect(rightNums).toEqual([1, 2, 3]);
  });
});
