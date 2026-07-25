import React from "react";
import { escapeRegExp } from "../lib";

/** Maximum query length for highlighting to prevent performance issues */
const MAX_HIGHLIGHT_QUERY_LENGTH = 200;

/**
 * Highlights matches in text using a regex pattern.
 */
export function highlightWithRegex(text: string, regex: RegExp): React.ReactNode {
  // The filter regex is deliberately non-global (.test() with "g" is stateful);
  // highlighting needs all occurrences, so build a local global copy. The
  // source already passed validateRegexSafety() in compileRegex (ReDoS check).
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
  const globalRegex = new RegExp(
    regex.source,
    regex.flags.includes("g") ? regex.flags : `${regex.flags}g`
  );
  // Slice by match indices instead of split(): split() with user capture
  // groups injects the captures into the parts array and corrupts the output.
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(globalRegex)) {
    if (match[0] === "") continue;
    const index = match.index ?? 0;
    result.push(text.slice(lastIndex, index));
    result.push(
      <mark key={key++} className="bg-yellow-500/30 text-yellow-200">
        {match[0]}
      </mark>
    );
    lastIndex = index + match[0].length;
  }
  result.push(text.slice(lastIndex));

  return result;
}

/**
 * Highlights matches in text using simple string matching.
 * Uses escapeRegExp to safely handle special characters in the query.
 * Query is length-limited to prevent ReDoS attacks.
 */
export function highlightWithString(text: string, query: string): React.ReactNode {
  // Prevent ReDoS by limiting query length
  if (!query || query.length > MAX_HIGHLIGHT_QUERY_LENGTH) {
    return text;
  }

  // escapeRegExp makes the pattern safe by escaping all special regex characters
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
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

/**
 * Applies the active search highlight to a log message.
 * Returns the plain string when no search is active.
 */
export function highlightMessage(
  message: string,
  searchQuery: string,
  useRegex: boolean,
  searchRegex: RegExp | null
): React.ReactNode {
  if (!searchQuery) return message;
  if (useRegex && searchRegex) return highlightWithRegex(message, searchRegex);
  return highlightWithString(message, searchQuery);
}
