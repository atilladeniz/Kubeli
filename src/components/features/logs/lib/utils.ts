import type { LogLevel } from "../types";

/**
 * Detects log level from message content.
 * Checks for common log level indicators in the message.
 */
// Word-bounded: bare substrings misclassify (e.g. "transferred" contains "err").
const LEVEL_PATTERNS: [RegExp, LogLevel][] = [
  [/\b(?:error|fatal|err)\b/i, "error"],
  [/\b(?:warn|warning)\b/i, "warn"],
  [/\binfo\b/i, "info"],
  [/\b(?:debug|trace)\b/i, "debug"],
];

export function getLogLevel(message: string): LogLevel {
  for (const [pattern, level] of LEVEL_PATTERNS) {
    if (pattern.test(message)) {
      return level;
    }
  }
  return "default";
}

/**
 * Formats a timestamp string to show only time portion.
 * Returns HH:MM:SS.mmm format in UTC or local time.
 */
export function formatTimestamp(timestamp: string, local?: boolean): string {
  try {
    const date = new Date(timestamp);
    if (local) {
      const h = String(date.getHours()).padStart(2, "0");
      const m = String(date.getMinutes()).padStart(2, "0");
      const s = String(date.getSeconds()).padStart(2, "0");
      const ms = String(date.getMilliseconds()).padStart(3, "0");
      return `${h}:${m}:${s}.${ms}`;
    }
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
    // No "g" flag: .test() on a global regex is stateful (lastIndex persists
    // across calls) and silently skips matches when reused for filtering.
    return new RegExp(pattern, "i");
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
