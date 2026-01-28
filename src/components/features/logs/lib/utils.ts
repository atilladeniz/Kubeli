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

/** Maximum allowed regex pattern length to prevent ReDoS */
const MAX_REGEX_LENGTH = 200;

/**
 * Detects potentially dangerous regex patterns that could cause ReDoS.
 * Checks for nested quantifiers like (a+)+, (a*)+, (a+)*, etc.
 */
function isReDoSVulnerable(pattern: string): boolean {
  // Detect nested quantifiers: (group)+, (group)*, (group){n,}
  // These patterns can cause catastrophic backtracking
  const nestedQuantifierPattern = /\([^)]*[+*][^)]*\)[+*{]/;
  const overlappingAlternation = /\([^|)]*\|[^|)]*\)[+*]/;

  return nestedQuantifierPattern.test(pattern) || overlappingAlternation.test(pattern);
}

/**
 * Validates regex pattern for safety (ReDoS prevention).
 * Returns error message if unsafe, null if safe.
 */
function validateRegexSafety(pattern: string): string | null {
  if (pattern.length > MAX_REGEX_LENGTH) {
    return `Pattern too long (max ${MAX_REGEX_LENGTH} characters)`;
  }
  if (isReDoSVulnerable(pattern)) {
    return "Pattern contains potentially unsafe nested quantifiers";
  }
  return null;
}

/**
 * Compiles a regex pattern with error handling and ReDoS protection.
 * Returns null if the pattern is invalid or unsafe.
 */
export function compileRegex(pattern: string): RegExp | null {
  if (!pattern) return null;

  // Check for ReDoS vulnerability first
  const safetyError = validateRegexSafety(pattern);
  if (safetyError) return null;

  try {
    return new RegExp(pattern, "gi");
  } catch {
    return null;
  }
}

/**
 * Validates if a regex pattern is valid and safe.
 * Returns error message if invalid/unsafe, null if valid.
 */
export function validateRegex(pattern: string): string | null {
  if (!pattern) return null;

  // Check for ReDoS vulnerability first
  const safetyError = validateRegexSafety(pattern);
  if (safetyError) return safetyError;

  try {
    new RegExp(pattern);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
