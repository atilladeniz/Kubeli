"use client";

import React, { useMemo } from "react";
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
 */
export function LogLine({
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
}

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

/**
 * Highlights matches in text using simple string matching.
 */
function highlightWithString(text: string, query: string): React.ReactNode {
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
