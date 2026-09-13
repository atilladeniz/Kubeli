import {
  isNavigationKey,
  isTypingTarget,
  nextFocusIndex,
  reconcileFocusIndex,
  PAGE_SIZE,
} from "../table-navigation";

describe("isNavigationKey", () => {
  it("accepts the movement keys and nothing else", () => {
    for (const key of ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"]) {
      expect(isNavigationKey(key)).toBe(true);
    }
    for (const key of ["Enter", "Escape", "a", "ArrowLeft", "Tab"]) {
      expect(isNavigationKey(key)).toBe(false);
    }
  });
});

describe("nextFocusIndex", () => {
  it("enters the table at the first row on Down and the last on Up", () => {
    expect(nextFocusIndex("ArrowDown", null, 5)).toBe(0);
    expect(nextFocusIndex("ArrowUp", null, 5)).toBe(4);
    expect(nextFocusIndex("End", null, 5)).toBe(4);
    expect(nextFocusIndex("PageUp", null, 5)).toBe(4);
  });

  it("steps one row at a time", () => {
    expect(nextFocusIndex("ArrowDown", 2, 5)).toBe(3);
    expect(nextFocusIndex("ArrowUp", 2, 5)).toBe(1);
  });

  it("clamps instead of wrapping at both ends", () => {
    expect(nextFocusIndex("ArrowDown", 4, 5)).toBe(4);
    expect(nextFocusIndex("ArrowUp", 0, 5)).toBe(0);
  });

  it("jumps a page and clamps", () => {
    expect(nextFocusIndex("PageDown", 0, 100)).toBe(PAGE_SIZE);
    expect(nextFocusIndex("PageUp", 100, 200)).toBe(100 - PAGE_SIZE);
    expect(nextFocusIndex("PageDown", 95, 100)).toBe(99);
    expect(nextFocusIndex("PageUp", 3, 100)).toBe(0);
  });

  it("jumps to the ends", () => {
    expect(nextFocusIndex("Home", 7, 10)).toBe(0);
    expect(nextFocusIndex("End", 7, 10)).toBe(9);
  });

  it("does nothing in an empty table", () => {
    expect(nextFocusIndex("ArrowDown", null, 0)).toBeNull();
    expect(nextFocusIndex("Home", 3, 0)).toBeNull();
  });
});

describe("isTypingTarget", () => {
  const el = (tag: string, attrs: Record<string, string> = {}) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };

  it("recognises the fields the user types into", () => {
    expect(isTypingTarget(el("input"))).toBe(true);
    // Monaco and xterm both render a focusable textarea
    expect(isTypingTarget(el("textarea"))).toBe(true);
    expect(isTypingTarget(el("select"))).toBe(true);
    expect(isTypingTarget(el("div", { role: "combobox" }))).toBe(true);
    expect(isTypingTarget(el("div", { role: "textbox" }))).toBe(true);
  });

  it("treats a contenteditable element as typing", () => {
    const node = el("div");
    Object.defineProperty(node, "isContentEditable", { value: true });
    expect(isTypingTarget(node)).toBe(true);
  });

  it("lets ordinary elements and null through", () => {
    expect(isTypingTarget(el("div"))).toBe(false);
    expect(isTypingTarget(el("tr"))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("reconcileFocusIndex", () => {
  const keys = ["a", "b", "c"];

  it("follows the focused row when the list reorders", () => {
    expect(reconcileFocusIndex("c", ["c", "a", "b"], 2)).toBe(0);
  });

  it("holds the position when the focused row disappears", () => {
    // "b" was deleted; staying at index 1 keeps the user near where they were
    expect(reconcileFocusIndex("b", ["a", "c"], 1)).toBe(1);
  });

  it("clamps when the list shrank past the old position", () => {
    expect(reconcileFocusIndex("c", ["a"], 2)).toBe(0);
  });

  it("clears focus for an empty list", () => {
    expect(reconcileFocusIndex("a", [], 0)).toBeNull();
  });

  it("stays unfocused when nothing was focused", () => {
    expect(reconcileFocusIndex(null, keys, null)).toBeNull();
  });
});
