"use client";

import React, { memo, useMemo } from "react";
import type { LogEntry } from "@/lib/types";
import { LOG_LEVEL_COLORS } from "../types";
import { getLogLevel, formatTimestamp, escapeRegExp } from "../lib";

interface LogLineProps {
  log: LogEntry;
  showTimestamp: boolean;
  searchQuery: string;
  useRegex: boolean;
  searchRegex: RegExp | null;
}

/**
 * Renders a single log line with optional timestamp and search highlighting.
 * Automatically detects and colors log levels (error, warn, info, debug).
 *
 * Memoized to prevent unnecessary re-renders when parent updates.
 * Critical for performance with 10k+ log lines.
 */
export const LogLine = memo(function LogLine({
  log,
  showTimestamp,
  searchQuery,
  useRegex,
  searchRegex,
}: LogLineProps) {
  const logLevel = useMemo(() => getLogLevel(log.message), [log.message]);

  const highlightedMessage = useMemo(() => {
    if (!searchQuery) return log.message;

    // Use regex for highlighting if enabled
    if (useRegex && searchRegex) {
      return highlightWithRegex(log.message, searchRegex);
    }

    // Simple string search highlighting
    return highlightWithString(log.message, searchQuery);
  }, [log.message, searchQuery, useRegex, searchRegex]);

  return (
    <div className="group flex hover:bg-muted/30">
      {showTimestamp && log.timestamp && (
        <span className="mr-2 shrink-0 text-muted-foreground/60">
          {formatTimestamp(log.timestamp)}
        </span>
      )}
      <span className={LOG_LEVEL_COLORS[logLevel] || LOG_LEVEL_COLORS.default}>
        {highlightedMessage}
      </span>
    </div>
  );
});

/**
 * Highlights matches in text using a regex pattern.
 */
function highlightWithRegex(text: string, regex: RegExp): React.ReactNode {
  const parts = text.split(regex);
  const matches = text.match(regex) || [];
  const result: React.ReactNode[] = [];

  parts.forEach((part, i) => {
    result.push(part);
    if (matches[i]) {
      result.push(
        <mark key={i} className="bg-yellow-500/30 text-yellow-200">
          {matches[i]}
        </mark>
      );
    }
  });

  return result;
}

/** Maximum query length for highlighting to prevent performance issues */
const MAX_HIGHLIGHT_QUERY_LENGTH = 200;

/**
 * Highlights matches in text using simple string matching.
 * Uses escapeRegExp to safely handle special characters in the query.
 * Query is length-limited to prevent ReDoS attacks.
 */
function highlightWithString(text: string, query: string): React.ReactNode {
  // Prevent ReDoS by limiting query length
  if (!query || query.length > MAX_HIGHLIGHT_QUERY_LENGTH) {
    return text;
  }

  // escapeRegExp makes the pattern safe by escaping all special regex characters
  const regex = new RegExp(`(${escapeRegExp(query)})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-500/30 text-yellow-200">
        {part}
      </mark>
    ) : (
      part
    )
  );
}
