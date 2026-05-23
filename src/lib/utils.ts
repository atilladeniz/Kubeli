import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Compact relative time. Returns "5m", "2h", "6d", the supplied justNowLabel
// for spans under one minute, or a locale-formatted date for spans >= 7 days.
// Accepts epoch ms, ISO string, or Date — callers pass whatever they have.
export function formatRelativeTime(
  input: number | string | Date,
  justNowLabel: string,
): string {
  const ts =
    typeof input === "number"
      ? input
      : input instanceof Date
        ? input.getTime()
        : new Date(input).getTime();
  const diffMs = Math.max(0, Date.now() - ts);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return justNowLabel;
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return new Date(ts).toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" });
}
