"use client";

import React, { memo, useMemo } from "react";
import type { LogEntry } from "@/lib/types";
import { LOG_LEVEL_COLORS } from "../types";
import { getLogLevel, formatTimestamp } from "../lib";

interface DeploymentLogLineProps {
  log: LogEntry;
  showTimestamp: boolean;
  searchQuery: string;
  useRegex: boolean;
  searchRegex: RegExp | null;
  /** Color class for the pod name prefix */
  podColor?: string;
}

/**
 * Renders a single log line with pod name prefix for deployment-level aggregated logs.
 * The pod name is color-coded for easy visual identification of which replica
 * generated the message.
 */
export const DeploymentLogLine = memo(function DeploymentLogLine({
  log,
  showTimestamp,
  searchQuery,
  useRegex,
  searchRegex,
  podColor = "text-foreground",
}: DeploymentLogLineProps) {
  const logLevel = useMemo(() => getLogLevel(log.message), [log.message]);

  const highlightedMessage = useMemo(() => {
    if (!searchQuery) return log.message;
    if (useRegex && searchRegex) {
      return highlightWithRegex(log.message, searchRegex);
    }
    return highlightWithString(log.message, searchQuery);
  }, [log.message, searchQuery, useRegex, searchRegex]);

  // Shorten pod name: strip common deployment prefix for readability
  const shortPodName = useMemo(() => {
    // Pod names typically follow: <deployment>-<replicaset-hash>-<pod-hash>
    // Show last two segments for brevity
    const parts = log.pod.split("-");
    if (parts.length > 2) {
      return parts.slice(-2).join("-");
    }
    return log.pod;
  }, [log.pod]);

  return (
    <>
      {showTimestamp && log.timestamp && (
        <span className="mr-2 text-muted-foreground/60">
          {formatTimestamp(log.timestamp)}
        </span>
      )}
      <span className={`mr-2 font-semibold ${podColor}`} title={log.pod}>
        [{shortPodName}]
      </span>
      <span className={LOG_LEVEL_COLORS[logLevel] || LOG_LEVEL_COLORS.default}>
        {highlightedMessage}
      </span>
      {"\n"}
    </>
  );
});

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

const MAX_HIGHLIGHT_QUERY_LENGTH = 200;

function highlightWithString(text: string, query: string): React.ReactNode {
  if (!query || query.length > MAX_HIGHLIGHT_QUERY_LENGTH) {
    return text;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let idx = lowerText.indexOf(lowerQuery, lastIndex);
  let key = 0;

  while (idx !== -1) {
    if (idx > lastIndex) {
      result.push(text.slice(lastIndex, idx));
    }
    result.push(
      <mark key={key++} className="bg-yellow-500/30 text-yellow-200">
        {text.slice(idx, idx + query.length)}
      </mark>
    );
    lastIndex = idx + query.length;
    idx = lowerText.indexOf(lowerQuery, lastIndex);
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result.length > 0 ? result : text;
}
