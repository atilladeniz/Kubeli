const UNITS = ["Ki", "Mi", "Gi", "Ti", "Pi"] as const;

/**
 * Format a byte count with binary units (Ki, Mi, Gi, Ti, Pi).
 * `decimals` applies from Mi upwards; Ki and B are always whole numbers.
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (!Number.isFinite(bytes) || bytes < 1024) return `${Math.round(bytes)}B`;

  let value = bytes;
  let unit = -1;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }

  const fixed = unit === 0 ? value.toFixed(0) : value.toFixed(decimals);
  return `${fixed}${UNITS[unit]}`;
}
