import type { LogLevel } from "../types";

/**
 * Detects log level from message content.
 * Checks for common log level indicators in the message.
 */
export function getLogLevel(message: string): LogLevel {
  const lower = message.toLowerCase();

  if (lower.includes("error") || lower.includes("fatal") || lower.includes("err")) {
    return "error";
  }
  if (lower.includes("warn") || lower.includes("warning")) {
    return "warn";
  }
  if (lower.includes("info")) {
    return "info";
  }
  if (lower.includes("debug") || lower.includes("trace")) {
    return "debug";
  }
  return "default";
}

/**
 * Formats a timestamp string to show only time portion.
 * Returns HH:MM:SS.mmm format.
 */
export function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toISOString().split("T")[1].slice(0, 12);
  } catch {
    // Fallback: extract time portion from string
    return timestamp.slice(11, 23);
  }
}

/**
 * Escapes special regex characters in a string.
 * Used for safe string-based search highlighting.
 */
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Compiles a regex pattern with error handling.
 * Returns null if the pattern is invalid.
 */
export function compileRegex(pattern: string): RegExp | null {
  if (!pattern) return null;
  try {
    return new RegExp(pattern, "gi");
  } catch {
    return null;
  }
}

/**
 * Validates if a regex pattern is valid.
 * Returns error message if invalid, null if valid.
 */
export function validateRegex(pattern: string): string | null {
  if (!pattern) return null;
  try {
    new RegExp(pattern);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
