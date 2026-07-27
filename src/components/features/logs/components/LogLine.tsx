"use client";

import { memo, useMemo } from "react";
import type { LogEntry } from "@/lib/types";
import { LOG_LEVEL_COLORS } from "../types";
import { getLogLevel, formatTimestamp } from "../lib";
import { hasAnsiCodes, parseAnsi, stripAnsi } from "../lib/ansi";
import { highlightMessage, findMatchRanges, renderStyledSegments } from "./highlight";

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
  /** Render ANSI escape codes as colors/styles instead of stripping them */
  ansiColors?: boolean;
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
  ansiColors = true,
}: LogLineProps) {
  const logLevel = useMemo(() => getLogLevel(log.message), [log.message]);

  // Escape codes are only parsed when the line actually contains them, so the
  // common case stays on the plain-string path.
  const isAnsi = useMemo(
    () => ansiColors && hasAnsiCodes(log.message),
    [ansiColors, log.message]
  );

  const renderedMessage = useMemo(() => {
    if (isAnsi) {
      const segments = parseAnsi(log.message);
      const plain = segments.map((s) => s.text).join("");
      const matches = findMatchRanges(plain, searchQuery, useRegex, searchRegex);
      return renderStyledSegments(segments, matches);
    }
    // ansiColors off (or no codes present): strip so raw escapes never render
    const plain = ansiColors ? log.message : stripAnsi(log.message);
    return highlightMessage(plain, searchQuery, useRegex, searchRegex);
  }, [isAnsi, ansiColors, log.message, searchQuery, useRegex, searchRegex]);

  // Pod names typically follow: <deployment>-<replicaset-hash>-<pod-hash>.
  // Show the last two segments for brevity; full name stays in the title.
  const shortPodName = useMemo(() => {
    if (!podColor) return null;
    const parts = log.pod.split("-");
    return parts.length > 2 ? parts.slice(-2).join("-") : log.pod;
  }, [log.pod, podColor]);

  // ANSI segments carry their own inline colors; the level heuristic would only
  // fight them, so it applies to uncolored lines.
  const colorClass =
    logColoring && !isAnsi
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
        {renderedMessage}
      </span>
      {"\n"}
    </>
  );
});
