/**
 * Single source of truth for the dashboard keyboard shortcuts.
 *
 * `useDashboardShortcuts` wires the handlers by `id`; `ShortcutsHelpDialog`
 * renders the same list, so a shortcut added here shows up in the help
 * automatically.
 */
export interface DashboardShortcut {
  id: string;
  /** Key or two-key sequence ("g p") as understood by useKeyboardShortcuts */
  key: string;
  /** Cmd on macOS, Ctrl elsewhere */
  mod?: boolean;
  shift?: boolean;
  /** Works while an input is focused */
  global?: boolean;
  group: "navigation" | "actions" | "tabs";
  /** i18n key under `shortcuts.*` */
  labelKey?: string;
  /** i18n key under `navigation.*`, rendered as "Go to <name>" */
  navKey?: string;
  /** Hide this entry from the help dialog (e.g. favorites 2-9, listed once) */
  helpHidden?: boolean;
  /** Override the keys shown in the help dialog */
  helpKeys?: string[];
}

const goTo = (id: string, key: string, navKey: string): DashboardShortcut => ({
  id,
  key,
  group: "navigation",
  navKey,
});

export const DASHBOARD_SHORTCUTS: DashboardShortcut[] = [
  goTo("goto:overview", "g o", "overview"),
  goTo("goto:diagram", "g r", "resourceDiagram"),
  goTo("goto:pods", "g p", "pods"),
  goTo("goto:deployments", "g d", "deployments"),
  goTo("goto:services", "g s", "services"),
  goTo("goto:nodes", "g n", "nodes"),
  goTo("goto:configmaps", "g c", "configMaps"),
  goTo("goto:secrets", "g e", "secrets"),
  goTo("goto:namespaces", "g a", "namespaces"),
  ...Array.from({ length: 9 }, (_, i): DashboardShortcut => ({
    id: `favorite:${i + 1}`,
    key: String(i + 1),
    mod: true,
    group: "navigation",
    labelKey: "favorite",
    helpHidden: i > 0,
    helpKeys: ["1-9"],
  })),
  { id: "search", key: "/", group: "actions", labelKey: "search" },
  { id: "refresh", key: "r", group: "actions", labelKey: "refresh" },
  { id: "create", key: "n", mod: true, global: true, group: "actions", labelKey: "createResource" },
  { id: "ai", key: "g i", group: "actions", labelKey: "toggleAI" },
  { id: "help", key: "?", group: "actions", labelKey: "title" },
  { id: "help:mod", key: "/", mod: true, global: true, group: "actions", labelKey: "title" },
  // Display only: Escape is handled by the dialogs themselves
  { id: "escape", key: "Escape", group: "actions", labelKey: "escape", helpKeys: ["Esc"] },
  { id: "tab:new", key: "t", mod: true, global: true, group: "tabs", labelKey: "newTab" },
  { id: "tab:close", key: "w", mod: true, global: true, group: "tabs", labelKey: "closeTab" },
  { id: "tab:next", key: "Tab", mod: true, global: true, group: "tabs", labelKey: "nextTab" },
  {
    id: "tab:previous",
    key: "Tab",
    mod: true,
    shift: true,
    global: true,
    group: "tabs",
    labelKey: "previousTab",
  },
];

/** Keys to display for a shortcut; `combo` = pressed together, else in sequence */
export function shortcutKeys(
  shortcut: DashboardShortcut,
  modKey: string
): { keys: string[]; combo: boolean } {
  const key =
    shortcut.helpKeys ??
    [shortcut.mod && shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key];
  if (shortcut.mod || shortcut.shift) {
    return {
      keys: [...(shortcut.mod ? [modKey] : []), ...(shortcut.shift ? ["Shift"] : []), ...key],
      combo: true,
    };
  }
  return { keys: shortcut.helpKeys ?? shortcut.key.split(" "), combo: false };
}
