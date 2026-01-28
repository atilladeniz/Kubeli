import type { SessionSummary } from "@/lib/tauri/commands";

/**
 * Format a date string as relative time (e.g., "5m", "2h", "3d").
 * @param dateStr - ISO date string
 * @param justNowLabel - Label for times less than 1 minute ago
 */
export function formatRelativeTime(dateStr: string, justNowLabel: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return justNowLabel;
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" });
}

/**
 * Get session title or generate fallback from creation date.
 */
export function getSessionTitle(session: SessionSummary): string {
  if (session.title) return session.title;
  const date = new Date(session.created_at);
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
