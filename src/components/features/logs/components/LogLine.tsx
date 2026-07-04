"use client";

import React, { memo, useMemo } from "react";
import type { LogEntry } from "@/lib/types";
import { LOG_LEVEL_COLORS } from "../types";
import { getLogLevel, formatTimestamp, escapeRegExp } from "../lib";

interface LogLineProps {
  log: LogEntry;
  showTimestamp: boolean;
  timestampLocal?: boolean;
  logColoring?: boolean;
  searchQuery: string;
  useRegex: boolean;
  searchRegex: RegExp | null;
}

/**
 * Renders a single log line as inline content (spans + newline).
 * Must be placed inside a <pre> so that \n produces visible line breaks
 * and ::selection only highlights text, not full-width blocks.
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
      <span className={colorClass}>
        {highlightedMessage}
      </span>
      {"\n"}
    </>
  );
});

/**
 * Highlights matches in text using a regex pattern.
 */
function highlightWithRegex(text: string, regex: RegExp): React.ReactNode {
  // The filter regex is deliberately non-global (.test() with "g" is stateful);
  // highlighting needs all occurrences, so build a local global copy. The
  // source already passed validateRegexSafety() in compileRegex (ReDoS check).
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
  const globalRegex = new RegExp(
    regex.source,
    regex.flags.includes("g") ? regex.flags : `${regex.flags}g`
  );
  const parts = text.split(globalRegex);
  const matches = text.match(globalRegex) || [];
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

  // split() with a capture group puts matches at odd indices; checking via
  // regex.test(part) on a global regex is stateful and skips every other match.
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="bg-yellow-500/30 text-yellow-200">
        {part}
      </mark>
    ) : (
      part
    )
  );
}
