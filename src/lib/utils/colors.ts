/**
 * Rainbow color palette for namespace/resource color coding.
 * Colors are designed to be distinguishable and accessible.
 */

export interface NamespaceColor {
  /** Tailwind background class for dots/indicators */
  dot: string;
  /** Tailwind border class for containers */
  border: string;
  /** Tailwind left border class for table rows */
  borderLeft: string;
  /** Tailwind background class with low opacity for containers */
  bgLight: string;
  /** Tailwind text class */
  text: string;
  /** Raw HSL value for custom usage */
  hsl: string;
}

/**
 * Rainbow palette with 16 distinct Tailwind colors.
 * Red excluded - reserved for error states.
 */
export const RAINBOW_PALETTE: NamespaceColor[] = [
  // Orange
  { dot: "bg-orange-500", border: "border-orange-500/30", borderLeft: "border-l-orange-500", bgLight: "bg-orange-500/5", text: "text-orange-500", hsl: "hsl(25, 95%, 53%)" },
  // Amber
  { dot: "bg-amber-500", border: "border-amber-500/30", borderLeft: "border-l-amber-500", bgLight: "bg-amber-500/5", text: "text-amber-500", hsl: "hsl(38, 92%, 50%)" },
  // Yellow
  { dot: "bg-yellow-500", border: "border-yellow-500/30", borderLeft: "border-l-yellow-500", bgLight: "bg-yellow-500/5", text: "text-yellow-500", hsl: "hsl(48, 96%, 53%)" },
  // Lime
  { dot: "bg-lime-500", border: "border-lime-500/30", borderLeft: "border-l-lime-500", bgLight: "bg-lime-500/5", text: "text-lime-500", hsl: "hsl(84, 81%, 44%)" },
  // Green
  { dot: "bg-green-500", border: "border-green-500/30", borderLeft: "border-l-green-500", bgLight: "bg-green-500/5", text: "text-green-500", hsl: "hsl(142, 71%, 45%)" },
  // Emerald
  { dot: "bg-emerald-500", border: "border-emerald-500/30", borderLeft: "border-l-emerald-500", bgLight: "bg-emerald-500/5", text: "text-emerald-500", hsl: "hsl(160, 84%, 39%)" },
  // Teal
  { dot: "bg-teal-500", border: "border-teal-500/30", borderLeft: "border-l-teal-500", bgLight: "bg-teal-500/5", text: "text-teal-500", hsl: "hsl(173, 80%, 40%)" },
  // Cyan
  { dot: "bg-cyan-500", border: "border-cyan-500/30", borderLeft: "border-l-cyan-500", bgLight: "bg-cyan-500/5", text: "text-cyan-500", hsl: "hsl(189, 94%, 43%)" },
  // Sky
  { dot: "bg-sky-500", border: "border-sky-500/30", borderLeft: "border-l-sky-500", bgLight: "bg-sky-500/5", text: "text-sky-500", hsl: "hsl(199, 89%, 48%)" },
  // Blue
  { dot: "bg-blue-500", border: "border-blue-500/30", borderLeft: "border-l-blue-500", bgLight: "bg-blue-500/5", text: "text-blue-500", hsl: "hsl(217, 91%, 60%)" },
  // Indigo
  { dot: "bg-indigo-500", border: "border-indigo-500/30", borderLeft: "border-l-indigo-500", bgLight: "bg-indigo-500/5", text: "text-indigo-500", hsl: "hsl(239, 84%, 67%)" },
  // Violet
  { dot: "bg-violet-500", border: "border-violet-500/30", borderLeft: "border-l-violet-500", bgLight: "bg-violet-500/5", text: "text-violet-500", hsl: "hsl(258, 90%, 66%)" },
  // Purple
  { dot: "bg-purple-500", border: "border-purple-500/30", borderLeft: "border-l-purple-500", bgLight: "bg-purple-500/5", text: "text-purple-500", hsl: "hsl(271, 91%, 65%)" },
  // Fuchsia
  { dot: "bg-fuchsia-500", border: "border-fuchsia-500/30", borderLeft: "border-l-fuchsia-500", bgLight: "bg-fuchsia-500/5", text: "text-fuchsia-500", hsl: "hsl(292, 84%, 61%)" },
  // Pink
  { dot: "bg-pink-500", border: "border-pink-500/30", borderLeft: "border-l-pink-500", bgLight: "bg-pink-500/5", text: "text-pink-500", hsl: "hsl(330, 81%, 60%)" },
  // Rose
  { dot: "bg-rose-500", border: "border-rose-500/30", borderLeft: "border-l-rose-500", bgLight: "bg-rose-500/5", text: "text-rose-500", hsl: "hsl(350, 89%, 60%)" },
];

/**
 * DJB2 hash function - better distribution than simple hash.
 * Used for deterministic color assignment with fewer collisions.
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    // hash * 33 + char
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

/**
 * Get a color from the rainbow palette based on namespace name.
 * Uses hash-based assignment for deterministic colors.
 */
export function getNamespaceColor(namespace: string): NamespaceColor {
  const index = hashString(namespace) % RAINBOW_PALETTE.length;
  return RAINBOW_PALETTE[index];
}

/**
 * Get a color by index (for sequential assignment).
 */
export function getColorByIndex(index: number): NamespaceColor {
  return RAINBOW_PALETTE[index % RAINBOW_PALETTE.length];
}
