"use client";

import { memo, useMemo } from "react";
import type { LogEntry } from "@/lib/types";
import { LOG_LEVEL_COLORS } from "../types";
import { getLogLevel, formatTimestamp } from "../lib";
import { highlightMessage } from "./highlight";

interface LogLineProps {
  log: LogEntry;
  showTimestamp: boolean;
  timestampLocal?: boolean;
  logColoring?: boolean;
  searchQuery: string;
  useRegex: boolean;
  searchRegex: RegExp | null;
  /** Color class for the pod name prefix; when set, the pod name is shown */
  podColor?: string;
}

/**
 * Renders a single log line as inline content (spans + newline).
 * Must be placed inside a <pre> so that \n produces visible line breaks
 * and ::selection only highlights text, not full-width blocks.
 *
 * When `podColor` is set (aggregated multi-pod viewers), the line is prefixed
 * with a color-coded short pod name so the source replica is identifiable.
 *
 * Memoized to prevent unnecessary re-renders when parent updates.
 * Critical for performance with 10k+ log lines.
 */
export const LogLine = memo(function LogLine({
  log,
  showTimestamp,
  timestampLocal,
  logColoring = true,
  searchQuery,
  useRegex,
  searchRegex,
  podColor,
}: LogLineProps) {
  const logLevel = useMemo(() => getLogLevel(log.message), [log.message]);

  const highlightedMessage = useMemo(
    () => highlightMessage(log.message, searchQuery, useRegex, searchRegex),
    [log.message, searchQuery, useRegex, searchRegex]
  );

  // Pod names typically follow: <deployment>-<replicaset-hash>-<pod-hash>.
  // Show the last two segments for brevity; full name stays in the title.
  const shortPodName = useMemo(() => {
    if (!podColor) return null;
    const parts = log.pod.split("-");
    return parts.length > 2 ? parts.slice(-2).join("-") : log.pod;
  }, [log.pod, podColor]);

  const colorClass = logColoring
    ? LOG_LEVEL_COLORS[logLevel] || LOG_LEVEL_COLORS.default
    : "text-foreground";

  return (
    <>
      {showTimestamp && log.timestamp && (
        <span className="mr-2 text-muted-foreground/60">
          {formatTimestamp(log.timestamp, timestampLocal)}
        </span>
      )}
      {shortPodName && (
        <span className={`mr-2 font-semibold ${podColor}`} title={log.pod}>
          [{shortPodName}]
        </span>
      )}
      <span className={colorClass}>
        {highlightedMessage}
      </span>
      {"\n"}
    </>
  );
});
