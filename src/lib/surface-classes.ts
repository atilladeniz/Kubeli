/**
 * Maps a surface level (1–8) to its bg + shadow utility classes.
 *
 * Levels clamp to [1, 8]. `shadowLevel` defaults to `level` but can be pinned
 * so a component keeps a constant shadow weight regardless of nesting depth
 * (e.g. a dropdown always reads shadow-surface-4 whether it opens on the page
 * or inside a dialog, even though its bg tracks the substrate).
 */
const BG = [
  "bg-surface-1",
  "bg-surface-2",
  "bg-surface-3",
  "bg-surface-4",
  "bg-surface-5",
  "bg-surface-6",
  "bg-surface-7",
  "bg-surface-8",
] as const;

const SHADOW = [
  "shadow-surface-1",
  "shadow-surface-2",
  "shadow-surface-3",
  "shadow-surface-4",
  "shadow-surface-5",
  "shadow-surface-6",
  "shadow-surface-7",
  "shadow-surface-8",
] as const;

const clamp = (n: number) => Math.min(Math.max(Math.round(n), 1), 8);

export function surfaceClasses(level: number, shadowLevel?: number): string {
  const l = clamp(level);
  const s = clamp(shadowLevel ?? level);
  return `${BG[l - 1]} ${SHADOW[s - 1]}`;
}
