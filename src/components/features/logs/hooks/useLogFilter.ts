"use client";

import { useState, useMemo } from "react";
import type { LogEntry } from "@/lib/types";
import { compileRegex, validateRegex, getLogLevel } from "../lib";

interface UseLogFilterOptions {
  logs: LogEntry[];
}

interface UseLogFilterReturn {
  /** Current search query */
  searchQuery: string;
  /** Set search query */
  setSearchQuery: (query: string) => void;
  /** Whether regex mode is enabled */
  useRegex: boolean;
  /** Toggle regex mode */
  setUseRegex: (enabled: boolean) => void;
  /** Current log level filter */
  logLevel: string;
  /** Set log level filter */
  setLogLevel: (level: string) => void;
  /** Regex validation error message */
  regexError: string | null;
  /** Compiled search regex (null if invalid or not using regex) */
  searchRegex: RegExp | null;
  /** Filtered logs based on search and level */
  filteredLogs: LogEntry[];
}

/**
 * Hook for managing log filtering state and logic.
 * Handles search (text and regex), log level filtering, and regex validation.
 */
export function useLogFilter({ logs }: UseLogFilterOptions): UseLogFilterReturn {
  const [searchQuery, setSearchQuery] = useState("");
  const [useRegex, setUseRegex] = useState(false);
  const [logLevel, setLogLevel] = useState<string>("all");

  // Validate and compile regex
  const regexError = useMemo(() => {
    if (!searchQuery || !useRegex) return null;
    return validateRegex(searchQuery);
  }, [searchQuery, useRegex]);

  const searchRegex = useMemo(() => {
    if (!searchQuery || !useRegex || regexError) return null;
    return compileRegex(searchQuery);
  }, [searchQuery, useRegex, regexError]);

  // Filter logs based on search and log level
  const filteredLogs = useMemo(() => {
    let result = logs;

    // Filter by search query
    if (searchQuery) {
      if (useRegex && searchRegex) {
        result = result.filter((log) => searchRegex.test(log.message));
      } else if (!useRegex) {
        const query = searchQuery.toLowerCase();
        result = result.filter((log) => log.message.toLowerCase().includes(query));
      }
    }

    // Filter by log level - reuse getLogLevel from utils
    if (logLevel !== "all") {
      result = result.filter((log) => getLogLevel(log.message) === logLevel);
    }

    return result;
  }, [logs, searchQuery, logLevel, useRegex, searchRegex]);

  return {
    searchQuery,
    setSearchQuery,
    useRegex,
    setUseRegex,
    logLevel,
    setLogLevel,
    regexError,
    searchRegex,
    filteredLogs,
  };
}
