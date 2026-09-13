/**
 * Where the arrow keys move a focused row to.
 *
 * Kept apart from the table so the movement rules can be tested without a DOM:
 * the virtualizer only renders a window of rows, so the focused row is an
 * index the table owns, not whichever element happens to hold DOM focus.
 */

/** Rows a PageUp/PageDown jumps over */
export const PAGE_SIZE = 10;

export type NavigationKey =
  | "ArrowDown"
  | "ArrowUp"
  | "Home"
  | "End"
  | "PageDown"
  | "PageUp";

const NAVIGATION_KEYS: ReadonlySet<string> = new Set([
  "ArrowDown",
  "ArrowUp",
  "Home",
  "End",
  "PageDown",
  "PageUp",
]);

export function isNavigationKey(key: string): key is NavigationKey {
  return NAVIGATION_KEYS.has(key);
}

/**
 * The row index a navigation key moves to, or null when nothing should move.
 *
 * `current` is null before the first keypress: the first Down or Up then takes
 * the first row rather than the second, so a table can be entered without
 * clicking. Movement is clamped, so holding Down at the end does nothing
 * instead of wrapping to the top, which would lose the user's place.
 */
export function nextFocusIndex(
  key: NavigationKey,
  current: number | null,
  count: number
): number | null {
  if (count <= 0) return null;

  const last = count - 1;
  if (current === null) {
    return key === "ArrowUp" || key === "End" || key === "PageUp" ? last : 0;
  }

  const clamp = (index: number) => Math.min(last, Math.max(0, index));

  switch (key) {
    case "ArrowDown":
      return clamp(current + 1);
    case "ArrowUp":
      return clamp(current - 1);
    case "PageDown":
      return clamp(current + PAGE_SIZE);
    case "PageUp":
      return clamp(current - PAGE_SIZE);
    case "Home":
      return 0;
    case "End":
      return last;
  }
}

/**
 * True while the user is typing, so table keys stay out of the way.
 *
 * Monaco and xterm both render a focusable textarea, so the tag check covers
 * them; the role check catches the command palette's combobox input.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;

  const role = target.getAttribute("role");
  return role === "textbox" || role === "combobox";
}

/**
 * Keeps the focused index pointing at the same row after the data changes.
 *
 * A watch update reorders or removes rows underneath the user. Following the
 * row key keeps the focus on the resource the user was looking at; when that
 * resource is gone, the position is held instead so focus does not jump to the
 * top of the list.
 */
export function reconcileFocusIndex(
  focusedKey: string | null,
  keys: string[],
  previousIndex: number | null
): number | null {
  if (keys.length === 0) return null;
  if (focusedKey === null) return previousIndex === null ? null : Math.min(previousIndex, keys.length - 1);

  const found = keys.indexOf(focusedKey);
  if (found !== -1) return found;
  if (previousIndex === null) return null;
  return Math.min(previousIndex, keys.length - 1);
}
