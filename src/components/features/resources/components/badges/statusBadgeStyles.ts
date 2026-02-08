export type StatusBadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "info"
  | "danger";

const toneClasses: Record<StatusBadgeTone, string> = {
  neutral:
    "border-border/70 bg-muted text-foreground/80 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300 classic-dark:border-zinc-700 classic-dark:bg-zinc-800/70 classic-dark:text-zinc-300",
  success:
    "border-green-300 bg-green-50 text-green-700 dark:border-green-700/60 dark:bg-green-500/15 dark:text-green-300 classic-dark:border-green-700/60 classic-dark:bg-green-500/15 classic-dark:text-green-300",
  warning:
    "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700/60 dark:bg-amber-500/15 dark:text-amber-300 classic-dark:border-amber-700/60 classic-dark:bg-amber-500/15 classic-dark:text-amber-300",
  info:
    "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700/60 dark:bg-blue-500/15 dark:text-blue-300 classic-dark:border-blue-700/60 classic-dark:bg-blue-500/15 classic-dark:text-blue-300",
  danger:
    "border-red-300 bg-red-50 text-red-700 dark:border-red-700/60 dark:bg-red-500/15 dark:text-red-300 classic-dark:border-red-700/60 classic-dark:bg-red-500/15 classic-dark:text-red-300",
};

export function getStatusBadgeToneClass(tone: StatusBadgeTone): string {
  return toneClasses[tone];
}
