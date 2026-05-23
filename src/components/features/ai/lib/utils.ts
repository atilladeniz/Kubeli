import type { SessionSummary } from "@/lib/tauri/commands";
export { formatRelativeTime } from "@/lib/utils";

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
