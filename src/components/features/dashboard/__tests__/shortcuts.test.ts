import { DASHBOARD_SHORTCUTS, shortcutKeys } from "../shortcuts";

const byId = (id: string) => {
  const s = DASHBOARD_SHORTCUTS.find((x) => x.id === id);
  if (!s) throw new Error(`missing shortcut ${id}`);
  return s;
};

describe("DASHBOARD_SHORTCUTS registry", () => {
  it("has unique ids and a label for every entry", () => {
    const ids = DASHBOARD_SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of DASHBOARD_SHORTCUTS) {
      expect(s.labelKey || s.navKey).toBeTruthy();
    }
  });

  it("binds every key combination only once", () => {
    const bindings = DASHBOARD_SHORTCUTS.map(
      (s) => `${s.key}|${s.mod ? "mod" : ""}|${s.shift ? "shift" : ""}`
    );
    expect(new Set(bindings).size).toBe(bindings.length);
  });

  // Regression: the help dialog was a hand-written list that omitted g i,
  // Cmd+1-9 and Cmd+Tab. Everything the handler binds is now in one list.
  it("contains the shortcuts the old help dialog forgot", () => {
    expect(byId("ai").key).toBe("g i");
    expect(byId("favorite:1").mod).toBe(true);
    expect(byId("tab:next").key).toBe("Tab");
    expect(byId("tab:previous").shift).toBe(true);
  });

  it("opens the help with Cmd/Ctrl+/ as well as ?", () => {
    expect(byId("help").key).toBe("?");
    expect(byId("help:mod")).toMatchObject({ key: "/", mod: true });
  });
});

describe("shortcutKeys", () => {
  it("shows a sequence as separate keys", () => {
    expect(shortcutKeys(byId("goto:pods"), "⌘")).toEqual({ keys: ["g", "p"], combo: false });
  });

  it("shows modifier combos with the platform key", () => {
    expect(shortcutKeys(byId("create"), "Ctrl")).toEqual({ keys: ["Ctrl", "N"], combo: true });
    expect(shortcutKeys(byId("tab:previous"), "⌘")).toEqual({
      keys: ["⌘", "Shift", "Tab"],
      combo: true,
    });
  });

  it("lists the favorites once as 1-9", () => {
    expect(shortcutKeys(byId("favorite:1"), "⌘").keys).toEqual(["⌘", "1-9"]);
    expect(DASHBOARD_SHORTCUTS.filter((s) => s.id.startsWith("favorite:") && !s.helpHidden)).toHaveLength(1);
  });
});
